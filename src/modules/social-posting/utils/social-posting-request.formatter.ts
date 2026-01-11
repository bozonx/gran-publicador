import { 
  PostRequestDto,
  MediaType as LibraryMediaType 
} from 'bozonx-social-media-posting';
import { 
  Post, 
  Channel, 
  Publication, 
  MediaType, 
  StorageType 
} from '../../../generated/prisma/client.js';
import { SocialPostingBodyFormatter } from './social-posting-body.formatter.js';
import { TagsFormatter } from './tags.formatter.js';

export interface FormatterParams {
  post: any; // Post with relations or simplified
  channel: any; // Channel
  publication: any; // Publication with media
  apiKey: string;
  targetChannelId: string;
}

export class SocialPostingRequestFormatter {
  /**
   * Prepares the request object for the posting library.
   */
  static prepareRequest(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId } = params;
    const isTelegram = channel.socialMedia === 'TELEGRAM';

    // Generate body using templates
    const body = SocialPostingBodyFormatter.format(
      {
        title: publication.title,
        content: post.content || publication.content,
        description: publication.description,
        tags: post.tags || publication.tags,
        postType: publication.postType,
        language: post.language || publication.language,
      },
      channel
    );

    const mediaMapping = this.mapMedia(publication.media);

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

  private static mapMedia(publicationMedia: any[]): Partial<PostRequestDto> {
    if (!publicationMedia || publicationMedia.length === 0) return {};

    if (publicationMedia.length === 1) {
      const item = publicationMedia[0].media;
      const src = this.getMediaSrc(item);
      
      switch (item.type) {
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

    // Multiple media items
    return {
      media: publicationMedia.map(pm => ({
        src: this.getMediaSrc(pm.media),
        type: this.mapMediaTypeToLibrary(pm.media.type),
      })),
    };
  }

  private static getMediaSrc(media: any): string {
    // If it's a direct URL, use it
    if (media.storagePath?.startsWith('http')) {
      return media.storagePath;
    }

    // For Telegram storage, path is the file_id
    if (media.storageType === StorageType.TELEGRAM) {
      return media.storagePath;
    }

    // Fallback/Local FS
    return media.storagePath;
  }

  private static mapMediaTypeToLibrary(type: MediaType): LibraryMediaType {
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
