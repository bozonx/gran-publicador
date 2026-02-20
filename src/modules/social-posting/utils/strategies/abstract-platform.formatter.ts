import type { PostRequestDto } from '../../dto/social-posting.dto.js';
import { MediaType, StorageType } from '../../../../generated/prisma/index.js';
import type { PostingSnapshot } from '../../interfaces/posting-snapshot.interface.js';

export interface FormatterParams {
  post: any; // Post with relations or simplified
  channel: any; // Channel
  publication: any; // Publication with media
  apiKey: string;
  targetChannelId: string;
  mediaStorageUrl: string; // Media Storage microservice URL
  publicMediaBaseUrl?: string; // Public API URL for proxying
  mediaService?: any; // MediaService for signing
  snapshot: PostingSnapshot; // Frozen posting snapshot (body + media)
}

export abstract class AbstractPlatformFormatter {
  abstract format(params: FormatterParams): PostRequestDto;

  protected encodePathSegment(value: string): string {
    return encodeURIComponent(String(value ?? ''));
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
        return `${baseUrl}/media/p/${this.encodePathSegment(media.id)}/${this.encodePathSegment(token)}`;
      }

      // Fallback to direct URL from Media Storage microservice (internal)
      const fileId = media.storagePath;
      const baseUrl = mediaStorageUrl.replace(/\/$/, '');
      return `${baseUrl}/files/${this.encodePathSegment(fileId)}/download`;
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

  /**
   * Map snapshot media items to PostRequestDto media fields.
   * Resolves URLs at send time from frozen media metadata.
   */
  protected mapSnapshotMedia(
    snapshotMedia: Array<{
      mediaId: string;
      type: string;
      storageType: string;
      storagePath: string;
      order: number;
      hasSpoiler: boolean;
    }>,
    mediaStorageUrl: string,
    publicMediaBaseUrl?: string,
    mediaService?: any,
  ): Partial<PostRequestDto> {
    if (!snapshotMedia || snapshotMedia.length === 0) return {};

    // Adapt snapshot items to the shape expected by getMediaSrc (id, storagePath, storageType)
    const toMediaLike = (item: (typeof snapshotMedia)[0]) => ({
      id: item.mediaId,
      storagePath: item.storagePath,
      storageType: item.storageType,
    });

    if (snapshotMedia.length === 1) {
      const item = snapshotMedia[0];
      const src = this.getMediaSrc(
        toMediaLike(item),
        mediaStorageUrl,
        publicMediaBaseUrl,
        mediaService,
      );

      switch (item.type) {
        case 'IMAGE':
          return { cover: { src, hasSpoiler: item.hasSpoiler } };
        case 'VIDEO':
          return { video: { src, hasSpoiler: item.hasSpoiler } };
        case 'AUDIO':
          return { audio: { src } };
        case 'DOCUMENT':
          return { document: { src } };
        default:
          return { cover: { src, hasSpoiler: item.hasSpoiler } };
      }
    }

    return {
      media: snapshotMedia.map(item => ({
        src: this.getMediaSrc(toMediaLike(item), mediaStorageUrl, publicMediaBaseUrl, mediaService),
        type: this.mapMediaTypeToLibrary(item.type as MediaType),
        hasSpoiler: item.hasSpoiler,
      })),
    };
  }

  protected applyCommonOptions(request: PostRequestDto, post: any): void {
    if (post.platformOptions) {
      const rawOpts =
        typeof post.platformOptions === 'string'
          ? JSON.parse(post.platformOptions)
          : post.platformOptions;

      const platform = request.platform;
      const opts =
        rawOpts &&
        typeof rawOpts === 'object' &&
        platform &&
        rawOpts[platform] &&
        typeof rawOpts[platform] === 'object'
          ? rawOpts[platform]
          : null;

      if (!opts) return;

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
