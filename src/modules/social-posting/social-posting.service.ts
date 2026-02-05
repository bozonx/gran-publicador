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
import { PRESET_SIGNATURES } from '../author-signatures/constants/preset-signatures.constants.js';
import { request } from 'undici';
import { MediaService } from '../media/media.service.js';

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
        platform: channel.socialMedia.toLowerCase(),
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
   * Publish all posts of a publication
   */
  async publishPublication(
    publicationId: string,
    options: { skipLock?: boolean; force?: boolean } = {},
  ): Promise<PublishResponseDto> {
    this.logger.log(
      `[publishPublication] Starting publication process for ID: ${publicationId}${options.skipLock ? ' (skipLock)' : ''}${options.force ? ' (force)' : ''}`,
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
      this.logger.error(`[publishPublication] Publication ${publicationId} not found`);
      throw new BadRequestException('Publication not found');
    }

    if (!this.hasContentOrMedia(publication.content, publication.media)) {
      this.logger.warn(`[publishPublication] Publication ${publicationId} has no content or media`);
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
          `[publishPublication] Publication ${publicationId} is already being processed or not found`,
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

    const results: Array<{
      postId: string;
      channelId: string;
      channelName: string;
      platform: string;
      success: boolean;
      url?: string;
      error?: string;
    }> = [];

    // Reload with all posts to ensure we process everything (ignoring status in manual trigger)
    const publicationWithPosts = await this.prisma.publication.findUnique({
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

    if (!publicationWithPosts) {
      throw new BadRequestException('Publication not found after lock');
    }

    for (const post of publicationWithPosts.posts) {
      // Filter posts that need publishing:
      // 1. Status PENDING (unless forced)
      if (post.status !== PostStatus.PENDING && !options.force) {
        this.logger.debug(`[publishPublication] Skipping post ${post.id} (Status: ${post.status})`);
        continue;
      }

      if (this.shutdownService.isShutdownInProgress()) {
        this.logger.warn(
          `[publishPublication] Shutdown in progress, aborting remaining posts for publication ${publicationId}`,
        );
        results.push({
          postId: post.id,
          channelId: post.channelId,
          channelName: post.channel.name,
          platform: post.channel.socialMedia,
          success: false,
          error: 'Publication aborted due to system shutdown',
        });
        continue;
      }

      try {
        const result = await this.publishSinglePost(post, post.channel, publicationWithPosts, {
          force: options.force,
        });
        this.logger.log(
          `[publishPublication] Post ${post.id} publication result: ${result.success ? 'SUCCESS' : 'FAILED'}${result.error ? ` (${result.error})` : ''}`,
        );
        results.push({
          postId: post.id,
          channelId: post.channelId,
          channelName: post.channel.name,
          platform: post.channel.socialMedia,
          success: result.success,
          url: result.url,
          error: result.error,
        });
      } catch (error: any) {
        this.logger.error(
          `[publishPublication] Error publishing post ${post.id}: ${error.message}`,
          error.stack,
        );
        results.push({
          postId: post.id,
          channelId: post.channelId,
          channelName: post.channel.name,
          platform: post.channel.socialMedia,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const finalStatus =
      successCount === results.length
        ? PublicationStatus.PUBLISHED
        : successCount > 0
          ? PublicationStatus.PARTIAL
          : PublicationStatus.FAILED;

    await this.prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: finalStatus,
        processingStartedAt: null,
        meta: this.sanitizeJson({
          ...((publication.meta as any) || {}),
          attempts: [
            ...((publication.meta as any)?.attempts || []),
            {
              timestamp: new Date().toISOString(),
              successCount,
              totalCount: results.length,
            },
          ],
          lastResult: {
            timestamp: new Date().toISOString(),
            successCount,
            totalCount: results.length,
          },
        }),
      },
    });

    // Notify creator about failed or partial publication
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

        const title = this.i18n.t(titleKey, { lang });
        const message = this.i18n.t('notifications.PUBLICATION_FAILED_MESSAGE', {
          lang,
          args: {
            title:
              publication.title ||
              (publication.content ? publication.content.substring(0, 30) : 'Untitled'),
            finalStatus:
              finalStatus === PublicationStatus.FAILED ? 'failed' : 'was only partially published',
            detailMessage,
          },
        });

        await this.notifications.create({
          userId: publication.createdBy,
          type: NotificationType.PUBLICATION_FAILED,
          title,
          message,
          meta: { publicationId: publication.id, projectId: publication.projectId },
        });
      } catch (error: any) {
        this.logger.error(`Failed to send publication notification: ${error.message}`);
      }
    }

    return {
      success: successCount === results.length && results.length > 0,
      message:
        results.length === 0
          ? 'No posts to publish'
          : successCount === results.length
            ? 'Success'
            : successCount > 0
              ? 'Partial success'
              : 'All posts failed',
      data: {
        publicationId,
        status: finalStatus,
        publishedCount: successCount,
        failedCount: results.length - successCount,
        results,
      },
    };
  }

  async publishPost(postId: string): Promise<PublishResponseDto> {
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

    // For single post we still want to make sure the publication is not locked by scheduler
    const updateResult = await this.prisma.publication.updateMany({
      where: {
        id: post.publicationId,
        status: { not: PublicationStatus.PROCESSING },
      },
      data: {
        status: PublicationStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Publication is already being processed');
    }

    try {
      const result = await this.publishSinglePost(
        post,
        post.channel,
        post.publication,
        // Since publishPost is typically manual, we might assume force?
        // Or we should update the controller to pass force.
        // For now, let's keep it consistent: single post publish via API usually implies manual intent,
        // but let's default to false unless we change the signature of publishPost too.
        // Actually, looking at the code, publishPost doesn't take options.
        // However, user requirement "manual press on button... should be permitted" refers to the UI action which calls publishPublication usually?
        // Let's assume publishPost is also manual.
        { force: true }, // Assume manual single post execution implies force/user intent
      );

      const allPosts = await this.prisma.post.findMany({
        where: { publicationId: post.publicationId },
      });

      const successCount = allPosts.filter(p => p.status === PostStatus.PUBLISHED).length;
      const finalStatus =
        successCount === allPosts.length
          ? PublicationStatus.PUBLISHED
          : successCount > 0
            ? PublicationStatus.PARTIAL
            : PublicationStatus.FAILED;

      const lastResult = {
        timestamp: new Date().toISOString(),
        successCount,
        totalCount: allPosts.length,
      };

      await this.prisma.publication.update({
        where: { id: post.publicationId },
        data: {
          status: finalStatus,
          processingStartedAt: null,
          meta: this.sanitizeJson({
            ...((post.publication.meta as any) || {}),
            attempts: [...((post.publication.meta as any)?.attempts || []), lastResult],
            lastResult,
          }),
        },
      });

      // Notify creator about failed or partial publication
      if (
        (finalStatus === PublicationStatus.FAILED || finalStatus === PublicationStatus.PARTIAL) &&
        post.publication.createdBy
      ) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: post.publication.createdBy },
            select: { uiLanguage: true },
          });
          const lang = user?.uiLanguage || 'en-US';

          const statusIcon = result.success ? '✅' : '❌';
          const statusText = result.success ? 'Success' : 'Failed';

          const titleKey =
            finalStatus === PublicationStatus.FAILED
              ? 'notifications.PUBLICATION_FAILED_TITLE'
              : 'notifications.PUBLICATION_PARTIAL_FAILED_TITLE';

          const title = this.i18n.t(titleKey, { lang });
          const message = this.i18n.t('notifications.PUBLICATION_FAILED_SINGLE_MESSAGE', {
            lang,
            args: {
              title:
                post.publication.title ||
                (post.publication.content ? post.publication.content.substring(0, 30) : 'Untitled'),
              finalStatus:
                finalStatus === PublicationStatus.FAILED
                  ? 'failed'
                  : 'was only partially published',
              statusIcon,
              channelName: post.channel.name,
              platform: post.channel.socialMedia,
              statusText,
              error: result.error ? ` (${result.error})` : '',
            },
          });

          await this.notifications.create({
            userId: post.publication.createdBy,
            type: NotificationType.PUBLICATION_FAILED,
            title,
            message,
            meta: { publicationId: post.publicationId, projectId: post.publication.projectId },
          });
        } catch (error: any) {
          this.logger.error(`Failed to send publication notification: ${error.message}`);
        }
      }

      return {
        success: result.success,
        message: result.success ? 'Success' : result.error || 'Failed',
        data: {
          postId,
          status: result.success ? PostStatus.PUBLISHED : PostStatus.FAILED,
        },
      };
    } catch (error: any) {
      await this.prisma.publication.update({
        where: { id: post.publicationId },
        data: { processingStartedAt: null },
      });
      throw error;
    }
  }

  private async publishSinglePost(
    post: any,
    channel: any,
    publication: any,
    options: { force?: boolean } = {},
  ): Promise<{ success: boolean; error?: string; url?: string }> {
    const logPrefix = `[publishSinglePost][Post:${post.id}]`;

    try {
      const {
        targetChannelId,
        apiKey,
        error: prepError,
      } = await this.prepareChannelForPosting(channel, { ignoreState: options.force });
      if (prepError) throw new Error(prepError);

      // Author signature is already stored as text in the post
      const authorSignatureContent = post.authorSignature || '';

      const request = SocialPostingRequestFormatter.prepareRequest({
        post: { ...post, authorSignature: authorSignatureContent },
        channel,
        publication,
        apiKey,
        targetChannelId,
        mediaStorageUrl: this.mediaStorageUrl,
        publicMediaBaseUrl: this.frontendUrl ? `${this.frontendUrl}/api/v1` : undefined,
        mediaService: this.mediaService,
      });

      this.logger.log(`${logPrefix} Sending request to microservice...`);

      const response = await this.sendRequest<PostResponseDto>('post', request);

      if (response.success && response.data) {
        // Validate publishedAt
        let publishedAt: Date;
        try {
          publishedAt = new Date(response.data.publishedAt);
          if (isNaN(publishedAt.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (error) {
          this.logger.warn(`Invalid publishedAt from microservice, using current time`);
          publishedAt = new Date();
        }

        // Save response in meta.response as requested
        const meta = post.meta || {};
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt,
            meta: this.sanitizeJson({
              ...meta,
              attempts: [
                ...(meta.attempts || []),
                {
                  timestamp: new Date().toISOString(),
                  success: true,
                  response: response.data,
                },
              ],
            }),
            errorMessage: null,
          },
        });

        await this.refreshPublicationEffectiveAt(post.publicationId, publishedAt);
        return { success: true, url: response.data.url };
      } else {
        const platformError = response;
        const meta = post.meta || {};
        const platformErrorMessage = platformError.error?.message;
        const message = Array.isArray(platformErrorMessage)
          ? platformErrorMessage.join(', ')
          : platformErrorMessage || 'Unknown error from microservice';

        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.FAILED,
            errorMessage: message,
            meta: this.sanitizeJson({
              ...meta,
              attempts: [
                ...(meta.attempts || []),
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
      const meta = post.meta || {};
      const message = error.message;

      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.FAILED,
          errorMessage: message,
          meta: this.sanitizeJson({
            ...meta,
            attempts: [
              ...(meta.attempts || []),
              {
                timestamp: new Date().toISOString(),
                success: false,
                response: {
                  code: 'INTERNAL_ERROR',
                  message: message,
                  details: { stack: error.stack },
                },
              },
            ],
          }),
        },
      });
      return { success: false, error: message };
    }
  }

  private async sendRequest<T>(endpoint: string, body: any): Promise<T> {
    const baseUrl = this.socialPostingConfig.serviceUrl.replace(/\/$/, '');
    const url = `${baseUrl}/${endpoint}`;

    const appConfig = this.configService.get<AppConfig>('app')!;
    const timeout = (appConfig.microserviceRequestTimeoutSeconds || 60) * 1000;

    try {
      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  /**
   * Helper to validate channel and resolve platform params
   */
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

    // State checks - can be ignored if forced (user manual action)
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

  /**
   * Deeply sanitizes an object to ensure it only contains JSON-compatible data.
   * Removes functions and ensures class instances are converted to plain objects.
   */
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
