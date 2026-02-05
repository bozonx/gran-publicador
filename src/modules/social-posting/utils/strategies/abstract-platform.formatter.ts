import type { PostRequestDto } from '../../dto/social-posting.dto.js';
import { MediaType, StorageType } from '../../../../generated/prisma/index.js';

export interface FormatterParams {
  post: any; // Post with relations or simplified
  channel: any; // Channel
  publication: any; // Publication with media
  apiKey: string;
  targetChannelId: string;
  mediaStorageUrl: string; // Media Storage microservice URL
  publicMediaBaseUrl?: string; // Public API URL for proxying
  mediaService?: any; // MediaService for signing
}

export abstract class AbstractPlatformFormatter {
  abstract format(params: FormatterParams): PostRequestDto;

  protected mapMedia(
    publicationMedia: any[],
    mediaStorageUrl: string,
    publicMediaBaseUrl?: string,
    mediaService?: any,
  ): Partial<PostRequestDto> {
    if (!publicationMedia || publicationMedia.length === 0) return {};

    if (publicationMedia.length === 1) {
      const pm = publicationMedia[0];
      const item = pm.media;
      const src = this.getMediaSrc(item, mediaStorageUrl, publicMediaBaseUrl, mediaService);
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
        src: this.getMediaSrc(pm.media, mediaStorageUrl, publicMediaBaseUrl, mediaService),
        type: this.mapMediaTypeToLibrary(pm.media.type),
        hasSpoiler: pm.hasSpoiler ?? pm.media.meta?.telegram?.hasSpoiler ?? false,
      })),
    };
  }

  protected getMediaSrc(
    media: any,
    mediaStorageUrl: string,
    publicMediaBaseUrl?: string,
    mediaService?: any,
  ): string {
    // If it's a direct URL, use it
    if (media.storagePath?.startsWith('http')) {
      return media.storagePath;
    }

    // For Telegram storage, path is the file_id
    if (media.storageType === StorageType.TELEGRAM) {
      return media.storagePath;
    }

    // For FS storage, storagePath contains Media Storage fileId
    if (media.storageType === StorageType.FS) {
      // If we have a public base URL and media service, generate a signed public proxy URL.
      // This is necessary for Telegram to download the file from its servers.
      if (publicMediaBaseUrl && mediaService) {
        const token = mediaService.generatePublicToken(media.id);
        const baseUrl = publicMediaBaseUrl.replace(/\/$/, '');
        return `${baseUrl}/media/p/${media.id}/${token}`;
      }

      // Fallback to direct URL from Media Storage microservice (internal)
      const fileId = media.storagePath;
      const baseUrl = mediaStorageUrl.replace(/\/$/, '');
      return `${baseUrl}/files/${fileId}/download`;
    }

    // Fallback
    return media.storagePath;
  }

  protected mapMediaTypeToLibrary(type: MediaType): string {
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

  protected applyCommonOptions(request: PostRequestDto, post: any): void {
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
  }
}
