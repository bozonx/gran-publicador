import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createPostingClient } from 'bozonx-social-media-posting';
import type {
  PostingClient,
  PostRequestDto,
  PostResponseDto,
  ErrorResponseDto,
  PreviewResponseDto,
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

    const validation = this.validateChannelReady(channel);
    if (!validation.valid) {
      return { success: false, message: `Validation failed: ${validation.errors.join(', ')}` };
    }

    try {
      const credentials = channel.credentials || {};

      const { channelId: targetChannelId, apiKey } = resolvePlatformParams(
        channel.socialMedia,
        channel.channelIdentifier,
        credentials,
      );

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
  async publishPublication(publicationId: string): Promise<PublishResponseDto> {
    this.logger.log(`[publishPublication] Starting publication process for ID: ${publicationId}`);

    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: {
        posts: {
          include: {
            channel: {
              include: {
                project: true,
              },
            },
          },
        },
        media: {
          include: {
            media: true,
          },
          orderBy: {
            order: 'asc',
          },
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

    await this.prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: PublicationStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });

    const results: Array<{
      postId: string;
      channelId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const post of publication.posts) {
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

      // Skip already successfully published posts
      if (post.status === PostStatus.PUBLISHED) {
        results.push({
          postId: post.id,
          channelId: post.channelId,
          success: true,
        });
        continue;
      }

      // Skip posts marked as expired
      if (post.status === PostStatus.FAILED && post.errorMessage === 'EXPIRED') {
        results.push({
          postId: post.id,
          channelId: post.channelId,
          success: false,
          error: 'EXPIRED',
        });
        continue;
      }

      try {
        const channelValidation = this.validateChannelReady(post.channel);
        if (!channelValidation.valid) {
          const errorMsg = channelValidation.errors.join(', ');
          results.push({
            postId: post.id,
            channelId: post.channelId,
            success: false,
            error: errorMsg,
          });
          continue;
        }

        const result = await this.publishSinglePost(post, post.channel, publication);
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
      data: { status: finalStatus },
    });

    return {
      success: successCount > 0,
      message: successCount === results.length ? 'Success' : 'Partial success or failure',
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

    const result = await this.publishSinglePost(post, post.channel, post.publication);

    return {
      success: result.success,
      message: result.success ? 'Success' : result.error || 'Failed',
      data: { postId, status: result.success ? PostStatus.PUBLISHED : PostStatus.FAILED },
    };
  }

  private async publishSinglePost(
    post: any,
    channel: any,
    publication: any,
  ): Promise<{ success: boolean; error?: string }> {
    const logPrefix = `[publishSinglePost][Post:${post.id}]`;

    try {
      if (!this.postingClient) throw new Error('Posting client not initialized');

      const credentials = channel.credentials || {};

      const { channelId: targetChannelId, apiKey } = resolvePlatformParams(
        channel.socialMedia,
        channel.channelIdentifier,
        credentials,
      );

      const request = SocialPostingRequestFormatter.prepareRequest({
        post,
        channel,
        publication,
        apiKey,
        targetChannelId,
      });

      if (post.scheduledAt || publication.scheduledAt) {
        request.scheduledAt = new Date(post.scheduledAt || publication.scheduledAt).toISOString();
      }

      this.logger.log(`${logPrefix} Sending request to library...`);
      const response = await this.postingClient.post(request);

      if (response.success) {
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(response.data.publishedAt),
            meta: response.data as any,
            errorMessage: null,
          },
        });
        return { success: true };
      } else {
        const platformError = response;
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.FAILED,
            errorMessage: platformError.error.message,
            meta: platformError.error as any,
          },
        });
        return { success: false, error: platformError.error.message };
      }
    } catch (error: any) {
      this.logger.error(`${logPrefix} Unexpected error: ${error.message}`);
      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.FAILED,
          errorMessage: error.message,
          meta: { error: error.message, stack: error.stack } as any,
        },
      });
      return { success: false, error: error.message };
    }
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
