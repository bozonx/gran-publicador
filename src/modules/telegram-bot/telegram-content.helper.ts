import type { Message, MessageEntity } from 'grammy/types';
import { MediaType } from '../../generated/prisma/client.js';

export interface ExtractedMedia {
  type: MediaType;
  fileId: string;
  thumbnailFileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  hasSpoiler?: boolean;
  isVoice?: boolean;
}

export interface ExtractedContent {
  text: string;
  media: ExtractedMedia[];
  isForward: boolean;
  forwardOrigin?: any;
  repostInfo?: {
    type: string;
    chatId?: number;
    chatTitle?: string;
    chatUsername?: string;
    messageId?: number;
    authorName?: string;
    authorId?: number;
  };
}

/**
 * Extract text content from a Telegram message, converting entities to Markdown
 */
export function extractText(message: Message): string {
  if ('text' in message && message.text) {
    return telegramEntitiesToMarkdown(message.text, message.entities);
  }
  if ('caption' in message && message.caption) {
    return telegramEntitiesToMarkdown(message.caption, message.caption_entities);
  }
  return '';
}

/**
 * Convert Telegram entities to Markdown
 */
export function telegramEntitiesToMarkdown(text: string, entities?: MessageEntity[]): string {
  if (!entities || entities.length === 0) {
    return text;
  }

  const tags: { pos: number; type: 'start' | 'end'; tag: string; priority: number }[] = [];

  for (const entity of entities) {
    let startTag = '';
    let endTag = '';

    switch (entity.type) {
      case 'bold':
        startTag = '**';
        endTag = '**';
        break;
      case 'italic':
        startTag = '_';
        endTag = '_';
        break;
      case 'underline':
        startTag = '<u>';
        endTag = '</u>';
        break;
      case 'strikethrough':
        startTag = '~~';
        endTag = '~~';
        break;
      case 'code':
        startTag = '`';
        endTag = '`';
        break;
      case 'pre':
        startTag = '```' + (entity.language || '') + '\n';
        endTag = '\n```';
        break;
      case 'text_link':
        startTag = '[';
        endTag = `](${entity.url})`;
        break;
      case 'text_mention':
        startTag = '[';
        endTag = `](tg://user?id=${entity.user?.id})`;
        break;
      case 'spoiler':
        startTag = '||';
        endTag = '||';
        break;
      case 'blockquote':
      case 'expandable_blockquote':
        startTag = '> ';
        endTag = '';
        break;
    }

    if (startTag || endTag) {
      tags.push({ pos: entity.offset, type: 'start', tag: startTag, priority: entity.length });
      tags.push({
        pos: entity.offset + entity.length,
        type: 'end',
        tag: endTag,
        priority: -entity.length,
      });
    }
  }

  // Sort tags:
  // 1. By position (offset)
  // 2. For same position: 'end' tags before 'start' tags
  // 3. For 'end' tags: shortest first (inner-most first)
  // 4. For 'start' tags: longest first (outer-most first)
  tags.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type !== b.type) return a.type === 'end' ? -1 : 1;
    return b.priority - a.priority;
  });

  let result = '';
  let lastPos = 0;
  for (const tag of tags) {
    result += text.substring(lastPos, tag.pos);
    result += tag.tag;
    lastPos = tag.pos;
  }
  result += text.substring(lastPos);

  return result;
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
      isVoice: true,
    });
  }

  return media;
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
    if (origin.type === 'chat') {
      return `telegram:${origin.sender_chat.id},unknown`;
    }
    return 'telegram:forward';
  }

  // For regular messages
  return `telegram:${message.chat.id},${message.message_id}`;
}

/**
 * Extract detailed repost information from forward_origin
 */
export function extractRepostInfo(message: Message): any {
  if (!message.forward_origin) return undefined;

  const origin = message.forward_origin;
  const info: any = { 
    type: origin.type,
    date: origin.date,
  };

  if (origin.type === 'channel') {
    info.chatId = origin.chat.id;
    info.chatTitle = origin.chat.title;
    info.chatUsername = origin.chat.username;
    info.messageId = origin.message_id;
    info.authorName = origin.author_signature;
  } else if (origin.type === 'user') {
    info.authorId = origin.sender_user.id;
    info.authorName = [origin.sender_user.first_name, origin.sender_user.last_name]
      .filter(Boolean)
      .join(' ');
    info.authorUsername = origin.sender_user.username;
  } else if (origin.type === 'chat') {
    const senderChat = origin.sender_chat;
    info.chatId = senderChat.id;
    info.chatTitle = (senderChat as any).title;
    info.chatUsername = (senderChat as any).username;
    info.authorName = origin.author_signature;
  } else if (origin.type === 'hidden_user') {
    info.authorName = origin.sender_user_name;
  }

  return info;
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
    repostInfo: extractRepostInfo(message),
  };
}

/**
 * Truncate text for display in messages
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '(empty)';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
