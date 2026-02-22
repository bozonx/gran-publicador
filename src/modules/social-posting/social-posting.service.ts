import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicationStatus, PostStatus } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaConfig } from '../../config/media.config.js';
import { validatePlatformCredentials } from './utils/credentials-validator.util.js';
import { resolvePlatformParams } from './utils/platform-params-resolver.util.js';
import { SocialPostingRequestFormatter } from './utils/social-posting-request.formatter.js';
import { PublishResponseDto } from './dto/publish-response.dto.js';
import { ShutdownService } from '../../common/services/shutdown.service.js';
import { AppConfig } from '../../config/app.config.js';
import { SocialPostingConfig } from '../../config/social-posting.config.js';
import { PostRequestDto, PostResponseDto, PreviewResponseDto } from './dto/social-posting.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../../generated/prisma/index.js';
import { I18nService } from 'nestjs-i18n';
import { request } from 'undici';
import { MediaService } from '../media/media.service.js';
import { DEFAULT_MICROSERVICE_TIMEOUT_MS } from '../../common/constants/global.constants.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PROCESS_POST_JOB, ProcessPostJobData, PUBLICATIONS_QUEUE } from './publications.queue.js';

@Injectable()
export class SocialPostingService {
  private readonly logger = new Logger(SocialPostingService.name);
  private readonly mediaStorageUrl: string;
  private readonly frontendUrl: string;
  private readonly socialPostingConfig: SocialPostingConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shutdownService: ShutdownService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly i18n: I18nService,
    private readonly mediaService: MediaService,
    @InjectQueue(PUBLICATIONS_QUEUE)
    private readonly publicationsQueue: Queue<ProcessPostJobData>,
  ) {
    const mediaConfig = this.configService.get<MediaConfig>('media')!;
    this.mediaStorageUrl = mediaConfig.serviceUrl || '';
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.frontendUrl = appConfig.frontendUrl || '';
    this.socialPostingConfig = this.configService.get<SocialPostingConfig>('socialPosting')!;
  }

  private async refreshPublicationEffectiveAt(publicationId: string, lastPublishedAt: Date) {
    const agg = await this.prisma.post.aggregate({
      where: {
        publicationId,
        status: PostStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      _max: {
        publishedAt: true,
      },
    });

    const maxPublishedAt = agg._max.publishedAt ?? lastPublishedAt;
    await this.prisma.publication.update({
      where: { id: publicationId },
      data: { effectiveAt: maxPublishedAt },
    });
  }

  /**
   * Test channel connection and credentials using microservice preview endpoint
   */
  async testChannel(
    channelId: string,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    this.logger.log(`[testChannel] Testing connection for channel: ${channelId}`);

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { project: true },
    });

    if (!channel) throw new BadRequestException('Channel not found');

    try {
      const {
        targetChannelId,
        apiKey,
        error: prepError,
      } = await this.prepareChannelForPosting(channel);
      if (prepError) {
        return { success: false, message: `Validation failed: ${prepError}` };
      }

      const request: PostRequestDto = {
        platform: channel.socialMedia,
        body: 'Test connection message from Gran Publicador',
        channelId: targetChannelId,
        auth: {
          apiKey,
        },
      };

      const response = await this.sendRequest<PreviewResponseDto>('preview', request);

      // Check if it's success response based on DTO structure
      if (!response || typeof response !== 'object') {
        return {
          success: false,
          message: 'Invalid response from service',
          details: response,
        };
      }

      const responseAny = response as any;
      if (responseAny.success && responseAny.data && typeof responseAny.data === 'object') {
        const data = responseAny.data;
        if ('valid' in data && data.valid === true) {
          return {
            success: true,
            message: 'Connection and credentials are valid (Preview mode)',
            details: responseAny.data,
          };
        } else {
          return {
            success: false,
            message: 'Platform rejected the preview request',
            details: data.errors || responseAny.data,
          };
        }
      } else {
        return {
          success: false,
          message: responseAny.error?.message || 'Service returned error',
          details: response,
        };
      }
    } catch (error: any) {
      this.logger.error(`[testChannel] Error testing channel: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * Enqueues all posts of a publication for processing
   */
  async enqueuePublication(
    publicationId: string,
    options: { skipLock?: boolean; force?: boolean } = {},
  ): Promise<PublishResponseDto> {
    this.logger.log(
      `[enqueuePublication] Starting publication process for ID: ${publicationId}${options.skipLock ? ' (skipLock)' : ''}${options.force ? ' (force)' : ''}`,
    );

    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: {
        posts: {
          include: {
            channel: { include: { project: true } },
          },
        },
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!publication) {
      this.logger.error(`[enqueuePublication] Publication ${publicationId} not found`);
      throw new BadRequestException('Publication not found');
    }

    if (!this.hasContentOrMedia(publication.content, publication.media)) {
      this.logger.warn(`[enqueuePublication] Publication ${publicationId} has no content or media`);
      throw new BadRequestException('Publication must have content or at least one media file');
    }

    // Atomic status update to prevent race conditions
    if (!options.skipLock) {
      const updateResult = await this.prisma.publication.updateMany({
        where: {
          id: publicationId,
          status: { not: PublicationStatus.PROCESSING },
        },
        data: {
          status: PublicationStatus.PROCESSING,
          processingStartedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        this.logger.warn(
          `[enqueuePublication] Publication ${publicationId} is already being processed or not found`,
        );
        return {
          success: false,
          message: 'Publication is already being processed',
          data: {
            publicationId,
            status: PublicationStatus.PROCESSING,
            publishedCount: 0,
            failedCount: 0,
            results: [],
          },
        };
      }
    }

    const postsToProcess = publication.posts.filter(
      post => post.status === PostStatus.PENDING || options.force,
    );

    if (postsToProcess.length === 0) {
      // Complete immediately if no posts to process
      await this.checkAndUpdatePublicationStatus(publicationId);
      return {
        success: true,
        message: 'No posts to publish',
        data: {
          publicationId,
          status: PublicationStatus.PUBLISHED,
          publishedCount: 0,
          failedCount: 0,
          results: [],
        },
      };
    }

    let enqueuedCount = 0;
    for (const post of postsToProcess) {
      try {
        await this.preparePostPayload(post.id, options.force);
        await this.publicationsQueue.add(
          PROCESS_POST_JOB,
          { postId: post.id, force: options.force },
          {
            jobId: `post-${post.id}-${Date.now()}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        enqueuedCount++;
      } catch (error: any) {
        this.logger.error(`Failed to prepare/enqueue post ${post.id}: ${error.message}`);
        // Status is already set to FAILED by preparePostPayload
      }
    }

    // If none enqueued, we should trigger completion check manually
    if (enqueuedCount === 0) {
      await this.checkAndUpdatePublicationStatus(publicationId);
    }

    return {
      success: true,
      message: `Enqueued ${enqueuedCount} posts for processing`,
      data: {
        publicationId,
        status: PublicationStatus.PROCESSING,
        publishedCount: 0,
        failedCount: 0,
        results: [],
      },
    };
  }

  /**
   * Prepares payload for a single post and saves it to DB.
   * Does NOT send the HTTP request.
   */

  /**
   * Enqueues a single post for processing
   */
  async enqueuePost(
    postId: string,
    options: { force?: boolean } = {},
  ): Promise<PublishResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        channel: { include: { project: true } },
        publication: {
          include: {
            media: { include: { media: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!post) throw new BadRequestException('Post not found');

    // Make sure the publication is marked as PROCESSING
    await this.prisma.publication.updateMany({
      where: {
        id: post.publicationId,
        status: { not: PublicationStatus.PROCESSING },
      },
      data: {
        status: PublicationStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });

    try {
      await this.preparePostPayload(post.id, options.force);
      await this.publicationsQueue.add(
        PROCESS_POST_JOB,
        { postId: post.id, force: options.force },
        {
          jobId: `post-${post.id}-${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return {
        success: true,
        message: 'Post enqueued for processing',
        data: {
          postId,
          status: PostStatus.PENDING, // It's pending until worker picks it up
        },
      };
    } catch (error: any) {
      await this.checkAndUpdatePublicationStatus(post.publicationId);
      throw error;
    }
  }

  async preparePostPayload(postId: string, force: boolean = false): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        channel: { include: { project: true } },
        publication: {
          include: {
            media: { include: { media: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!post) throw new Error(`Post ${postId} not found`);

    try {
      const {
        targetChannelId,
        apiKey,
        error: prepError,
      } = await this.prepareChannelForPosting(post.channel, { ignoreState: force });
      if (prepError) throw new Error(prepError);

      const snapshot = post.postingSnapshot as any;
      if (!snapshot) {
        throw new Error(`Post ${post.id} has no posting snapshot.`);
      }

      const request = SocialPostingRequestFormatter.prepareRequest({
        post,
        channel: post.channel,
        publication: post.publication,
        apiKey,
        targetChannelId,
        mediaStorageUrl: this.mediaStorageUrl,
        publicMediaBaseUrl: this.frontendUrl ? `${this.frontendUrl}/api/v1` : undefined,
        mediaService: this.mediaService,
        snapshot,
      });

      await this.prisma.post.update({
        where: { id: postId },
        data: {
          preparedPayload: request as any,
          errorMessage: null,
        },
      });
    } catch (error: any) {
      this.logger.error(`[preparePostPayload] Failed for post ${postId}: ${error.message}`);
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.FAILED,
          errorMessage: `Preparation failed: ${error.message}`,
        },
      });
      throw error;
    }
  }

  /**
   * Executes a prepared post. Called ONLY by the worker.
   */
  async executePreparedPost(
    postId: string,
  ): Promise<{ success: boolean; error?: string; url?: string }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) throw new Error(`Post ${postId} not found`);
    if (!post.preparedPayload) throw new Error(`Post ${postId} has no preparedPayload`);

    const logPrefix = `[executePreparedPost][Post:${post.id}]`;

    try {
      this.logger.log(`${logPrefix} Sending request to microservice...`);
      const response = await this.sendRequest<PostResponseDto>('post', post.preparedPayload);

      if (response.success && response.data) {
        let publishedAt = new Date();
        if (response.data.publishedAt) {
          const parsed = new Date(response.data.publishedAt);
          if (!isNaN(parsed.getTime())) publishedAt = parsed;
        }

        const meta = (post.meta as any) || {};
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt,
            meta: this.sanitizeJson({
              ...meta,
              attempts: [
                ...(meta.attempts || []),
                { timestamp: new Date().toISOString(), success: true, response: response.data },
              ],
            }),
            errorMessage: null,
            // Clear payload after successful sending to save space? Optional.
            // preparedPayload: null,
          },
        });

        await this.refreshPublicationEffectiveAt(post.publicationId, publishedAt);
        return { success: true, url: response.data.url };
      } else {
        const platformError = response as any;
        const message = Array.isArray(platformError.error?.message)
          ? platformError.error.message.join(', ')
          : platformError.error?.message || 'Unknown error from microservice';

        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.FAILED,
            errorMessage: message,
            meta: this.sanitizeJson({
              ...((post.meta as any) || {}),
              attempts: [
                ...((post.meta as any)?.attempts || []),
                {
                  timestamp: new Date().toISOString(),
                  success: false,
                  response: platformError.error || platformError,
                },
              ],
            }),
          },
        });
        return { success: false, error: message };
      }
    } catch (error: any) {
      this.logger.error(`${logPrefix} Unexpected error: ${error.message}`);
      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.FAILED,
          errorMessage: error.message,
          meta: this.sanitizeJson({
            ...((post.meta as any) || {}),
            attempts: [
              ...((post.meta as any)?.attempts || []),
              {
                timestamp: new Date().toISOString(),
                success: false,
                response: { code: 'INTERNAL_ERROR', message: error.message },
              },
            ],
          }),
        },
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Checks if all posts for a publication are processed, and updates the publication status.
   * If finished, sends notifications.
   */
  async checkAndUpdatePublicationStatus(publicationId: string): Promise<void> {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: { posts: { include: { channel: true } } },
    });

    if (!publication) return;

    const allPosts = publication.posts;
    const isFinished = allPosts.every(
      p => p.status === PostStatus.PUBLISHED || p.status === PostStatus.FAILED,
    );

    if (!isFinished) return; // Still processing

    const successCount = allPosts.filter(p => p.status === PostStatus.PUBLISHED).length;
    const failedCount = allPosts.length - successCount;

    const finalStatus =
      successCount === allPosts.length && allPosts.length > 0
        ? PublicationStatus.PUBLISHED
        : successCount > 0
          ? PublicationStatus.PARTIAL
          : PublicationStatus.FAILED;

    const results = allPosts.map(p => ({
      postId: p.id,
      channelId: p.channelId,
      channelName: p.channel.name,
      platform: p.channel.socialMedia,
      success: p.status === PostStatus.PUBLISHED,
      error: p.errorMessage,
    }));

    await this.prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: finalStatus,
        processingStartedAt: null,
        meta: this.sanitizeJson({
          ...((publication.meta as any) || {}),
          attempts: [
            ...((publication.meta as any)?.attempts || []),
            { timestamp: new Date().toISOString(), successCount, totalCount: allPosts.length },
          ],
          lastResult: {
            timestamp: new Date().toISOString(),
            successCount,
            totalCount: allPosts.length,
          },
        }),
      },
    });

    // Notify creator
    if (
      (finalStatus === PublicationStatus.FAILED || finalStatus === PublicationStatus.PARTIAL) &&
      publication.createdBy
    ) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: publication.createdBy },
          select: { uiLanguage: true },
        });
        const lang = user?.uiLanguage || 'en-US';

        const successList = results
          .filter(r => r.success)
          .map(r => `${r.channelName} (${r.platform})`)
          .join(', ');
        const failedList = results
          .filter(r => !r.success)
          .map(r => `${r.channelName} (${r.platform})`)
          .join(', ');

        let detailMessage = '';
        if (successList) detailMessage += `\n✅ Success: ${successList}`;
        if (failedList) detailMessage += `\n❌ Failed: ${failedList}`;

        const titleKey =
          finalStatus === PublicationStatus.FAILED
            ? 'notifications.PUBLICATION_FAILED_TITLE'
            : 'notifications.PUBLICATION_PARTIAL_FAILED_TITLE';

        await this.notifications.create({
          userId: publication.createdBy,
          type: NotificationType.PUBLICATION_FAILED,
          title: this.i18n.t(titleKey, { lang }),
          message: this.i18n.t('notifications.PUBLICATION_FAILED_MESSAGE', {
            lang,
            args: {
              title:
                publication.title ||
                (publication.content ? publication.content.substring(0, 30) : 'Untitled'),
              finalStatus:
                finalStatus === PublicationStatus.FAILED
                  ? 'failed'
                  : 'was only partially published',
              detailMessage,
            },
          }),
          meta: { publicationId: publication.id, projectId: publication.projectId },
        });
      } catch (error: any) {
        this.logger.error(`Failed to send publication notification: ${error.message}`);
      }
    }
  }

  private async sendRequest<T>(endpoint: string, body: any): Promise<T> {
    const baseUrl = this.socialPostingConfig.serviceUrl.replace(/\/$/, '');
    const url = `${baseUrl}/${endpoint}`;

    const appConfig = this.configService.get<AppConfig>('app')!;
    const timeout =
      (appConfig.microserviceRequestTimeoutSeconds || 60) * 1000 || DEFAULT_MICROSERVICE_TIMEOUT_MS;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.socialPostingConfig.apiToken) {
        headers['Authorization'] = `Bearer ${this.socialPostingConfig.apiToken}`;
      }

      const response = await request(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      if (response.statusCode >= 400) {
        try {
          const errorData = (await response.body.json()) as any;
          return errorData as T;
        } catch {
          throw new Error(`Service returned ${response.statusCode}`);
        }
      }

      return (await response.body.json()) as T;
    } catch (error: any) {
      this.logger.error(`Request to ${url} failed: ${error.message}`);
      throw new Error(`Microservice request failed: ${error.message}`);
    }
  }

  private async prepareChannelForPosting(
    channel: any,
    options: { ignoreState?: boolean } = {},
  ): Promise<{ targetChannelId: string; apiKey: string; error?: string }> {
    const validation = this.validateChannelReady(channel, options);
    if (!validation.valid) {
      return {
        targetChannelId: '',
        apiKey: '',
        error: validation.errors.join(', '),
      };
    }

    const credentials = channel.credentials || {};
    const params = resolvePlatformParams(
      channel.socialMedia,
      channel.channelIdentifier,
      credentials,
    );

    return {
      targetChannelId: params.channelId,
      apiKey: params.apiKey,
    };
  }

  private validateChannelReady(
    channel: any,
    options: { ignoreState?: boolean } = {},
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!options.ignoreState) {
      if (!channel.isActive) errors.push('Channel is not active');
      if (channel.archivedAt) errors.push('Channel is archived');
      if (channel.project?.archivedAt) errors.push('Project is archived');
    }
    if (!channel.channelIdentifier) errors.push('Channel identifier is missing');

    try {
      const credentials = channel.credentials || {};
      const validation = validatePlatformCredentials(channel.socialMedia, credentials);
      if (!validation.valid) errors.push(...validation.errors);
    } catch {
      errors.push('Invalid credentials format');
    }

    return { valid: errors.length === 0, errors };
  }

  private hasContentOrMedia(content: string | null, media: any[]): boolean {
    return Boolean(content?.trim()) || media.length > 0;
  }

  private sanitizeJson(obj: any): any {
    if (!obj) return obj;
    try {
      return JSON.parse(
        JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value)),
      );
    } catch (error: any) {
      if (this.logger) {
        this.logger.warn(`Failed to sanitize JSON object: ${error?.message || error}`);
      }
      return {
        _error: 'Sanitization failed',
        _message: error?.message || String(error),
      };
    }
  }
}
