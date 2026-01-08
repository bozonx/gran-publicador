import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createPostingClient } from 'bozonx-social-media-posting';
import type { PostingClient } from 'bozonx-social-media-posting';
import {
  PublicationStatus,
  PostStatus,
  SocialMedia,
  MediaType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validatePlatformCredentials } from './utils/credentials-validator.util.js';
import { PublishResponseDto } from './dto/publish-response.dto.js';

@Injectable()
export class SocialPostingService {
  private readonly logger = new Logger(SocialPostingService.name);
  private postingClient: PostingClient | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Initialize posting client with empty config (we'll use inline auth)
    this.postingClient = createPostingClient({
      accounts: {}, // We'll use inline auth for each request
      logLevel: 'warn',
    });
  }

  async onModuleDestroy() {
    if (this.postingClient) {
      await this.postingClient.destroy();
    }
  }

  /**
   * Publish all posts of a publication
   */
  async publishPublication(publicationId: string): Promise<PublishResponseDto> {
    this.logger.log(`Publishing publication ${publicationId}`);

    // Get publication with posts, media, and channels
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
      throw new BadRequestException('Publication not found');
    }

    // Validate publication has content or media
    if (!this.hasContentOrMedia(publication.content, publication.media)) {
      throw new BadRequestException(
        'Publication must have content or at least one media file',
      );
    }

    // Update publication status to PROCESSING
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

    // Publish each post
    for (const post of publication.posts) {
      try {
        // Validate channel
        const channelValidation = this.validateChannelReady(post.channel);
        if (!channelValidation.valid) {
          results.push({
            postId: post.id,
            channelId: post.channelId,
            success: false,
            error: channelValidation.errors.join(', '),
          });
          continue;
        }

        // Update post status to PROCESSING
        await this.prisma.post.update({
          where: { id: post.id },
          data: { status: PostStatus.PENDING },
        });

        // Publish post
        const result = await this.publishSinglePost(
          post,
          post.channel,
          publication,
        );

        results.push({
          postId: post.id,
          channelId: post.channelId,
          success: result.success,
          error: result.error,
        });
      } catch (error: any) {
        this.logger.error(
          `Error publishing post ${post.id}: ${error.message}`,
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

    // Calculate final status
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    let finalStatus: PublicationStatus;
    if (successCount === results.length) {
      finalStatus = PublicationStatus.PUBLISHED;
    } else if (successCount > 0) {
      finalStatus = PublicationStatus.PARTIAL;
    } else {
      finalStatus = PublicationStatus.FAILED;
    }

    // Update publication status
    await this.prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: finalStatus,
      },
    });

    return {
      success: successCount > 0,
      message:
        successCount === results.length
          ? 'All posts published successfully'
          : successCount > 0
            ? 'Some posts published successfully'
            : 'All posts failed to publish',
      data: {
        publicationId,
        status: finalStatus,
        publishedCount: successCount,
        failedCount,
        results,
      },
    };
  }

  /**
   * Publish a single post
   */
  async publishPost(postId: string): Promise<PublishResponseDto> {
    this.logger.log(`Publishing post ${postId}`);

    // Get post with channel and publication
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        channel: {
          include: {
            project: true,
          },
        },
        publication: {
          include: {
            media: {
              include: {
                media: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found');
    }

    // Validate publication has content or media
    if (
      !this.hasContentOrMedia(post.publication.content, post.publication.media)
    ) {
      throw new BadRequestException(
        'Post must have content or at least one media file',
      );
    }

    // Validate channel
    const channelValidation = this.validateChannelReady(post.channel);
    if (!channelValidation.valid) {
      throw new BadRequestException(
        `Channel validation failed: ${channelValidation.errors.join(', ')}`,
      );
    }

    // Update post status to PROCESSING
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.PENDING },
    });

    // Publish post
    const result = await this.publishSinglePost(
      post,
      post.channel,
      post.publication,
    );

    if (!result.success) {
      return {
        success: false,
        message: `Failed to publish post: ${result.error}`,
        data: {
          postId,
          status: PostStatus.FAILED,
        },
      };
    }

    return {
      success: true,
      message: 'Post published successfully',
      data: {
        postId,
        status: PostStatus.PUBLISHED,
      },
    };
  }

  /**
   * Publish a single post to a channel
   */
  private async publishSinglePost(
    post: any,
    channel: any,
    publication: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Parse credentials
      const credentials = JSON.parse(channel.credentials);

      // Map media files
      const mediaMapping = this.mapMediaToLibraryFormat(publication.media);

      // Prepare request
      const request: any = {
        platform: channel.socialMedia.toLowerCase(),
        body: publication.content || '',
        bodyFormat: 'html',
        channelId: channel.channelIdentifier,
        auth: {
          apiKey: credentials.telegramBotToken || credentials.botToken || credentials.vkAccessToken || credentials.accessToken,
        },
        type: 'auto',
        ...mediaMapping,
      };

      // Call library
      const response = await this.postingClient!.post(request);

      if (response.success) {
        // Update post with success data
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(),
            meta: JSON.stringify(response.data),
            errorMessage: null,
          },
        });

        return { success: true };
      } else {
        // Update post with error
        await this.prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.FAILED,
            errorMessage: response.error?.message || 'Unknown error',
            meta: JSON.stringify(response.error),
          },
        });

        return {
          success: false,
          error: response.error?.message || 'Unknown error',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error publishing post ${post.id}: ${error.message}`,
        error.stack,
      );

      // Update post with error
      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.FAILED,
          errorMessage: error.message,
          meta: JSON.stringify({ error: error.message, stack: error.stack }),
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Validate channel is ready for publishing
   */
  private validateChannelReady(channel: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if channel is active
    if (!channel.isActive) {
      errors.push('Channel is not active');
    }

    // Check if channel is archived
    if (channel.archivedAt) {
      errors.push('Channel is archived');
    }

    // Check if project is archived
    if (channel.project?.archivedAt) {
      errors.push('Project is archived');
    }

    // Check if channelIdentifier exists
    if (!channel.channelIdentifier) {
      errors.push('Channel identifier is missing');
    }

    // Validate credentials
    try {
      const credentials = JSON.parse(channel.credentials);
      const credentialsValidation = validatePlatformCredentials(
        channel.socialMedia,
        credentials,
      );

      if (!credentialsValidation.valid) {
        errors.push(...credentialsValidation.errors);
      }
    } catch (error) {
      errors.push('Invalid credentials format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if publication has content or media
   */
  private hasContentOrMedia(content: string | null, media: any[]): boolean {
    return !!(content && content.trim()) || media.length > 0;
  }

  /**
   * Map media files to library format
   */
  private mapMediaToLibraryFormat(media: any[]): any {
    if (media.length === 0) {
      return {};
    }

    // If only one media file, use specific field
    if (media.length === 1) {
      const mediaItem = media[0].media;
      const src = this.getMediaSrc(mediaItem);

      switch (mediaItem.type) {
        case MediaType.IMAGE:
          return { cover: { src } };
        case MediaType.VIDEO:
          return { video: { src } };
        case MediaType.AUDIO:
          return { audio: { src } };
        case MediaType.DOCUMENT:
          return { document: { src } };
        default:
          return { cover: { src } };
      }
    }

    // Multiple media files - use media array
    return {
      media: media.map((item) => ({
        src: this.getMediaSrc(item.media),
        type: this.mapMediaTypeToLibrary(item.media.type),
      })),
    };
  }

  /**
   * Get media source URL or file_id
   */
  private getMediaSrc(media: any): string {
    // For now, return storagePath
    // TODO: implement proper URL generation based on storageType
    return media.storagePath;
  }

  /**
   * Map MediaType to library format
   */
  private mapMediaTypeToLibrary(type: MediaType): string {
    switch (type) {
      case MediaType.IMAGE:
        return 'image';
      case MediaType.VIDEO:
        return 'video';
      case MediaType.AUDIO:
        return 'audio';
      case MediaType.DOCUMENT:
        return 'document';
      default:
        return 'image';
    }
  }
}
