import type { Message } from 'grammy/types';
import { MediaType } from '../../generated/prisma/client.js';

export interface ExtractedMedia {
  type: MediaType;
  fileId: string;
  thumbnailFileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  hasSpoiler?: boolean;
}

export interface ExtractedContent {
  text: string;
  media: ExtractedMedia[];
  isForward: boolean;
  forwardOrigin?: any;
}

/**
 * Extract text content from a Telegram message
 */
export function extractText(message: Message): string {
  if ('text' in message && message.text) {
    return message.text;
  }
  if ('caption' in message && message.caption) {
    return message.caption;
  }
  return '';
}

/**
 * Extract media from a Telegram message
 */
export function extractMedia(message: Message): ExtractedMedia[] {
  const media: ExtractedMedia[] = [];

  // Photo
  if ('photo' in message && message.photo) {
    // Get the largest photo (main)
    const largestPhoto = message.photo[message.photo.length - 1];
    // Get a thumbnail (middle one if possible, or the smallest)
    let thumbPhoto = message.photo[0];
    if (message.photo.length > 2) {
      thumbPhoto = message.photo[1]; // Usually ~320px
    }

    media.push({
      type: MediaType.IMAGE,
      fileId: largestPhoto.file_id,
      thumbnailFileId: thumbPhoto.file_id,
      fileSize: largestPhoto.file_size,
      hasSpoiler: message.has_media_spoiler,
    });
  }

  // Video
  if ('video' in message && message.video) {
    media.push({
      type: MediaType.VIDEO,
      fileId: message.video.file_id,
      thumbnailFileId:
        (message.video as any).thumbnail?.file_id || (message.video as any).thumb?.file_id,
      fileName: message.video.file_name,
      mimeType: message.video.mime_type,
      fileSize: message.video.file_size,
      hasSpoiler: message.has_media_spoiler,
    });
  }

  // Document
  if ('document' in message && message.document) {
    media.push({
      type: MediaType.DOCUMENT,
      fileId: message.document.file_id,
      thumbnailFileId:
        (message.document as any).thumbnail?.file_id || (message.document as any).thumb?.file_id,
      fileName: message.document.file_name,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    });
  }

  // Audio
  if ('audio' in message && message.audio) {
    media.push({
      type: MediaType.AUDIO,
      fileId: message.audio.file_id,
      fileName: message.audio.file_name,
      mimeType: message.audio.mime_type,
      fileSize: message.audio.file_size,
    });
  }

  // Voice
  if ('voice' in message && message.voice) {
    media.push({
      type: MediaType.AUDIO,
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type,
      fileSize: message.voice.file_size,
    });
  }

  return media;
}

/**
 * Extract all content from a message (text + media)
 */
export function extractMessageContent(message: Message): ExtractedContent {
  return {
    text: extractText(message),
    media: extractMedia(message),
    isForward: !!message.forward_origin,
    forwardOrigin: message.forward_origin,
  };
}

/**
 * Format source string for sourceTexts array
 */
export function formatSource(message: Message): string {
  if (message.forward_origin) {
    // For forwards, try to get the original chat/channel info
    const origin = message.forward_origin;
    if (origin.type === 'channel') {
      return `telegram:${origin.chat.id},${origin.message_id}`;
    }
    if (origin.type === 'user') {
      return `telegram:${origin.sender_user.id},unknown`;
    }
    return 'telegram:forward';
  }

  // For regular messages
  return `telegram:${message.chat.id},${message.message_id}`;
}

/**
 * Truncate text for display in messages
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '(пусто)';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
