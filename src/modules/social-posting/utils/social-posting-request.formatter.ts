import type { PostRequestDto } from '../dto/social-posting.dto.js';
import {
  Post,
  Channel,
  Publication,
  MediaType,
  StorageType,
} from '../../../generated/prisma/client.js';
import { SocialPostingBodyFormatter } from './social-posting-body.formatter.js';
import { TagsFormatter } from './tags.formatter.js';

export interface FormatterParams {
  post: any; // Post with relations or simplified
  channel: any; // Channel
  publication: any; // Publication with media
  apiKey: string;
  targetChannelId: string;
  mediaStorageUrl: string; // Media Storage microservice URL
}

export class SocialPostingRequestFormatter {
  /**
   * Prepares the request object for the posting library.
   */
  static prepareRequest(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId, mediaStorageUrl } = params;
    const isTelegram = channel.socialMedia === 'TELEGRAM';

    // Generate body using templates
    const body = SocialPostingBodyFormatter.format(
      {
        title: publication.title,
        content: post.content || publication.content,
        tags: post.tags || publication.tags,
        authorComment: publication.authorComment,
        postType: publication.postType,
        language: post.language || publication.language,
        authorSignature: post.authorSignature,
      },
      channel,
      post.template, // Pass the template override
    );

    const mediaMapping = this.mapMedia(publication.media, mediaStorageUrl);

    const request: PostRequestDto = {
      platform: channel.socialMedia.toLowerCase(),
      channelId: targetChannelId,
      auth: {
        apiKey,
      },
      body,
      bodyFormat: isTelegram ? 'md' : 'html', // Telegram needs md, others usually html or plain
      idempotencyKey: `post-${post.id}-${new Date(post.updatedAt).getTime()}`,
      postLanguage: post.language || publication.language,
      ...mediaMapping,
    };

    // Apply platform options from post
    if (post.platformOptions) {
      const opts =
        typeof post.platformOptions === 'string'
          ? JSON.parse(post.platformOptions)
          : post.platformOptions;

      // Map specific known options
      // Support both camelCase and snake_case for disableNotification
      const disableNotification = opts.disableNotification ?? opts.disable_notification;

      if (disableNotification !== undefined) {
        request.disableNotification = !!disableNotification;
      }

      // Pass the rest as general options if any
      // Remove both variants from options to avoid duplication
      const { disableNotification: _, disable_notification: __, ...rest } = opts;

      if (Object.keys(rest).length > 0) {
        request.options = {
          ...(request.options || {}),
          ...rest,
        };
      }
    }

    // Platform specific overrides
    if (isTelegram) {
      // Per instructions for Telegram:
      // - title: не передаем
      // - description: не передаем
      // - tags: не передаем (уже в body)
      // - mode: не передаем
      delete request.title;
      delete request.description;
      delete (request as any).tags;
      delete (request as any).mode;
    } else {
      // For other platforms we can provide title and description if available
      if (publication.title) request.title = publication.title;
      if (publication.description) request.description = publication.description;

      // Add tags as separate field if present
      const tagsString = post.tags || publication.tags;
      if (tagsString) {
        (request as any).tags = TagsFormatter.format(tagsString);
      }
    }

    return request;
  }

  private static mapMedia(
    publicationMedia: any[],
    mediaStorageUrl: string,
  ): Partial<PostRequestDto> {
    if (!publicationMedia || publicationMedia.length === 0) return {};

    if (publicationMedia.length === 1) {
      const pm = publicationMedia[0];
      const item = pm.media;
      const src = this.getMediaSrc(item, mediaStorageUrl);
      const hasSpoiler = pm.hasSpoiler ?? item.meta?.telegram?.hasSpoiler ?? false;

      switch (item.type) {
        case MediaType.IMAGE:
          return { cover: { src, hasSpoiler } };
        case MediaType.VIDEO:
          return { video: { src, hasSpoiler } };
        case MediaType.AUDIO:
          return { audio: { src } };
        case MediaType.DOCUMENT:
          return { document: { src } };
        default:
          return { cover: { src, hasSpoiler } };
      }
    }

    // Multiple media items
    return {
      media: publicationMedia.map(pm => ({
        src: this.getMediaSrc(pm.media, mediaStorageUrl),
        type: this.mapMediaTypeToLibrary(pm.media.type),
        hasSpoiler: pm.hasSpoiler ?? pm.media.meta?.telegram?.hasSpoiler ?? false,
      })),
    };
  }

  private static getMediaSrc(media: any, mediaStorageUrl: string): string {
    // If it's a direct URL, use it
    if (media.storagePath?.startsWith('http')) {
      return media.storagePath;
    }

    // For Telegram storage, path is the file_id
    if (media.storageType === StorageType.TELEGRAM) {
      return media.storagePath;
    }

    // For FS storage, storagePath contains Media Storage fileId
    // Return direct URL from Media Storage microservice
    if (media.storageType === StorageType.FS) {
      const fileId = media.storagePath;
      return `${mediaStorageUrl}/files/${fileId}/download`;
    }

    // Fallback
    return media.storagePath;
  }

  private static mapMediaTypeToLibrary(type: MediaType): string {
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
