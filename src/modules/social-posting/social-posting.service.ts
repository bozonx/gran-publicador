import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPostingClient } from 'bozonx-social-media-posting';
import type {
  PostingClient,
  PostRequestDto,
  PostResponseDto,
} from 'bozonx-social-media-posting';
import {
  PublicationStatus,
  PostStatus,
  SocialMedia,
  MediaType,
  StorageType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validatePlatformCredentials } from './utils/credentials-validator.util.js';
import { resolvePlatformParams } from './utils/platform-params-resolver.util.js';
import { SocialPostingRequestFormatter } from './utils/social-posting-request.formatter.js';
import { PublishResponseDto } from './dto/publish-response.dto.js';
import { ShutdownService } from '../../common/services/shutdown.service.js';
import { AppConfig } from '../../config/app.config.js';

/**
 * Custom logger adapter to pipe library logs to NestJS Logger
 */
class LibraryLogger {
  debug(message: string, context?: string) {
    console.debug(`[Library] ${context ? `[${context}] ` : ''}${message}`);
  }
  log(message: string, context?: string) {
    console.log(`[Library] ${context ? `[${context}] ` : ''}${message}`);
  }
  warn(message: string, context?: string) {
    console.warn(`[Library] ${context ? `[${context}] ` : ''}${message}`);
  }
  error(message: string, trace?: string, context?: string) {
    console.error(`[Library] ${context ? `[${context}] ` : ''}${message}`, trace);
  }
}

@Injectable()
export class SocialPostingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialPostingService.name);
  private postingClient: PostingClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shutdownService: ShutdownService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.postingClient = createPostingClient({
        accounts: {},
        logLevel: 'info',
        logger: new LibraryLogger(),
        retryAttempts: 3,
        retryDelayMs: 2000,
      });
      this.logger.log('Social posting client initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize posting client: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Cleaning up social posting client...');
    try {
      if (this.postingClient) {
        await this.postingClient.destroy();
        this.logger.log('✅ Social posting client destroyed');
      }
    } catch (error: any) {
      this.logger.error(`❌ Error destroying posting client: ${error.message}`, error.stack);
      // Don't throw - allow other services to cleanup
    }
  }

  /**
   * Test channel connection and credentials using library's preview mode
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
      const { targetChannelId, apiKey, error: prepError } = await this.prepareChannelForPosting(channel);
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

      const response = await this.postingClient!.preview(request);

      if (response.success) {
        return {
          success: true,
          message: 'Connection and credentials are valid (Preview mode)',
          details: response.data,
        };
      } else {
        const platformError = response as any; // Cast to access error properly
        return {
          success: false,
          message: 'Platform rejected the preview request',
          details: platformError.error || platformError,
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
    options: { skipLock?: boolean } = {},
  ): Promise<PublishResponseDto> {
    this.logger.log(`[publishPublication] Starting publication process for ID: ${publicationId}${options.skipLock ? ' (skipLock)' : ''}`);

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
        this.logger.warn(`[publishPublication] Publication ${publicationId} is already being processed or not found`);
        return {
          success: false,
          message: 'Publication is already being processed',
          data: { publicationId, status: PublicationStatus.PROCESSING, publishedCount: 0, failedCount: 0, results: [] }
        };
      }
    }

    const results: Array<{
      postId: string;
      channelId: string;
      success: boolean;
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

    const now = new Date();
    for (const post of publicationWithPosts.posts) {
      // Filter posts that need publishing:
      // 1. Status PENDING
      // 2. OR Status FAILED AND nextRetryAt <= now
      const isPending = post.status === PostStatus.PENDING;
      const isReadyToRetry = post.status === PostStatus.FAILED && post.nextRetryAt && new Date(post.nextRetryAt) <= now;

      if (!isPending && !isReadyToRetry) {
        this.logger.debug(`[publishPublication] Skipping post ${post.id} (Status: ${post.status}, ReadyToRetry: ${isReadyToRetry})`);
        continue;
      }

      if (this.shutdownService.isShutdownInProgress()) {
        this.logger.warn(
          `[publishPublication] Shutdown in progress, aborting remaining posts for publication ${publicationId}`,
        );
        results.push({
          postId: post.id,
          channelId: post.channelId,
          success: false,
          error: 'Publication aborted due to system shutdown',
        });
        continue;
      }

      try {
        const result = await this.publishSinglePost(post, post.channel, publicationWithPosts);
        this.logger.log(`[publishPublication] Post ${post.id} publication result: ${result.success ? 'SUCCESS' : 'FAILED'}${result.error ? ` (${result.error})` : ''}`);
        results.push({
          postId: post.id,
          channelId: post.channelId,
          success: result.success,
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
        processingStartedAt: null 
      },
    });

    return {
      success: successCount === results.length && results.length > 0,
      message: results.length === 0 
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
      const result = await this.publishSinglePost(post, post.channel, post.publication);
      
      const allPosts = await this.prisma.post.findMany({
          where: { publicationId: post.publicationId }
      });
      
      const successCount = allPosts.filter(p => p.status === PostStatus.PUBLISHED).length;
      const finalStatus = successCount === allPosts.length 
        ? PublicationStatus.PUBLISHED 
        : successCount > 0 ? PublicationStatus.PARTIAL : PublicationStatus.FAILED;

      await this.prisma.publication.update({
          where: { id: post.publicationId },
          data: { 
            status: finalStatus,
            processingStartedAt: null
          }
      });

      return {
        success: result.success,
        message: result.success ? 'Success' : result.error || 'Failed',
        data: { postId, status: result.success ? PostStatus.PUBLISHED : PostStatus.FAILED },
      };
    } catch (error: any) {
        await this.prisma.publication.update({
            where: { id: post.publicationId },
            data: { processingStartedAt: null }
        });
        throw error;
    }
  }

  private async publishSinglePost(
    post: any,
    channel: any,
    publication: any,
  ): Promise<{ success: boolean; error?: string }> {
    const logPrefix = `[publishSinglePost][Post:${post.id}]`;

    try {
      if (!this.postingClient) throw new Error('Posting client not initialized');

      const { targetChannelId, apiKey, error: prepError } = await this.prepareChannelForPosting(channel);
      if (prepError) throw new Error(prepError);

      const request = SocialPostingRequestFormatter.prepareRequest({
        post,
        channel,
        publication,
        apiKey,
        targetChannelId,
      });

      this.logger.log(`${logPrefix} Sending request to library...`);

      const appConfig = this.configService.get<AppConfig>('app')!;
      const timeoutSeconds = appConfig.postProcessingTimeoutSeconds;
      const timeoutPromise = new Promise<PostResponseDto>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout reached (${timeoutSeconds}s)`)),
          timeoutSeconds * 1000,
        ),
      );

      const response = await Promise.race([this.postingClient.post(request), timeoutPromise]);

      if (response.success) {
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(response.data.publishedAt),
            meta: response.data as any,
            errorMessage: null,
            retryCount: post.retryCount, // keep existing
            nextRetryAt: null,
          },
        });
        return { success: true };
      } else {
        const platformError = response;
        return await this.handlePostError(post.id, post.retryCount, platformError.error.message, platformError.error);
      }
    } catch (error: any) {
      this.logger.error(`${logPrefix} Unexpected error: ${error.message}`);
      return await this.handlePostError(post.id, post.retryCount, error.message, { error: error.message, stack: error.stack });
    }
  }

  private async handlePostError(postId: string, currentRetryCount: number, message: string, meta: any) {
    const MAX_RETRIES = 5;
    const retryCount = currentRetryCount || 0;
    const nextRetryCount = retryCount + 1;
    
    let nextRetryAt: Date | null = null;
    
    // Exponential backoff: 1m, 5m, 15m, 1h, 4h
    const backoffMinutes = [1, 5, 15, 60, 240];
    
    if (nextRetryCount <= MAX_RETRIES && message !== 'EXPIRED') {
      const minutes = backoffMinutes[nextRetryCount - 1] || 240;
      nextRetryAt = new Date(Date.now() + minutes * 60000);
      this.logger.log(`Post ${postId} failed, scheduled retry #${nextRetryCount} in ${minutes}m`);
    } else {
      this.logger.warn(`Post ${postId} failed and reached max retries or expired. No more retries.`);
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        errorMessage: message,
        meta: meta as any,
        retryCount: nextRetryCount,
        nextRetryAt,
      },
    });
    return { success: false, error: message };
  }

  /**
   * Helper to validate channel and resolve platform params
   */
  private async prepareChannelForPosting(channel: any): Promise<{ targetChannelId: string; apiKey: string; error?: string }> {
    const validation = this.validateChannelReady(channel);
    if (!validation.valid) {
      return { targetChannelId: '', apiKey: '', error: validation.errors.join(', ') };
    }

    const credentials = channel.credentials || {};
    const params = resolvePlatformParams(
      channel.socialMedia,
      channel.channelIdentifier,
      credentials,
    );

    return { 
      targetChannelId: params.channelId, 
      apiKey: params.apiKey 
    };
  }

  private validateChannelReady(channel: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!channel.isActive) errors.push('Channel is not active');
    if (channel.archivedAt) errors.push('Channel is archived');
    if (channel.project?.archivedAt) errors.push('Project is archived');
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
    return !!(content && content.trim()) || media.length > 0;
  }
}
