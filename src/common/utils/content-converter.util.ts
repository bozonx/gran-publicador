import type { MessageEntity } from 'grammy/types';
import { mdToTelegramHtml } from '@gran/shared/social-posting/md-to-telegram-html';

export class ContentConverter {
  /**
   * Convert Telegram entities to standard Markdown.
   * Supports: bold, italic, underline, strikethrough, code, pre, link, spoiler.
   */
  static telegramToMd(text: string, entities?: MessageEntity[]): string {
    if (!entities || entities.length === 0) {
      return text;
    }

    const tags: {
      pos: number;
      type: 'start' | 'end';
      tag: string;
      priority: number;
      index: number;
    }[] = [];

    // Helper to add tags safely
    const addTag = (
      start: number,
      end: number,
      startStr: string,
      endStr: string,
      priority: number,
      index: number,
    ) => {
      // Ensure we don't go out of bounds
      if (start < 0 || end > text.length) return;

      tags.push({ pos: start, type: 'start', tag: startStr, priority, index });
      tags.push({ pos: end, type: 'end', tag: endStr, priority: -priority, index });
    };

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      let offset = entity.offset;
      let length = entity.length;

      // Smart trimming: MD doesn't like spaces inside markers like ** text **.
      // We move the markers inside the text, excluding leading/trailing spaces.
      // This also helps with nesting when entities are slightly off.
      while (length > 0 && text[offset] === ' ') {
        offset++;
        length--;
      }
      while (length > 0 && text[offset + length - 1] === ' ') {
        length--;
      }

      if (length <= 0) continue;

      const p = length;

      switch (entity.type) {
        case 'bold':
          addTag(offset, offset + length, '**', '**', p, i);
          break;
        case 'italic':
          addTag(offset, offset + length, '_', '_', p, i);
          break;
        case 'underline':
          addTag(offset, offset + length, '<u>', '</u>', p, i);
          break;
        case 'strikethrough':
          addTag(offset, offset + length, '~~', '~~', p, i);
          break;
        case 'code':
          addTag(offset, offset + length, '`', '`', p, i);
          break;
        case 'pre':
          addTag(offset, offset + length, '```' + (entity.language || '') + '\n', '\n```', p, i);
          break;
        case 'text_link':
          addTag(offset, offset + length, '[', `](${entity.url})`, p, i);
          break;
        case 'text_mention':
          addTag(offset, offset + length, '[', `](tg://user?id=${entity.user?.id})`, p, i);
          break;
        case 'spoiler':
          addTag(offset, offset + length, '||', '||', p, i);
          break;
        case 'blockquote':
        case 'expandable_blockquote':
          addTag(offset, offset + length, '> ', '', p, i);
          break;
      }
    }

    // Sort tags:
    // 1. Position ascending
    // 2. IMPORTANT for MD: End tags must come before Start tags at the same position to maintain nesting
    // 3. For tags of the same type (both start or both end) at the same position:
    //    - Start: Longer (Outer) first
    //    - End: Shorter (Inner) first
    //    - If priority is equal: use index to ensure mirror symmetry (Nested properly)
    tags.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.type !== b.type) return a.type === 'end' ? -1 : 1;

      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Tie-breaker for same length: mirror the start order in the end order
      return a.type === 'start' ? a.index - b.index : b.index - a.index;
    });

    let result = '';
    let lastPos = 0;

    for (const tag of tags) {
      if (tag.pos > lastPos) {
        result += text.substring(lastPos, tag.pos);
      }
      result += tag.tag;
      lastPos = tag.pos;
    }
    result += text.substring(lastPos);

    return result;
  }

  /**
   * Convert standard Markdown to Telegram HTML.
   * Delegates to the shared implementation in @gran/shared.
   */
  static mdToTelegramHtml(markdown: string): string {
    return mdToTelegramHtml(markdown);
  }
}
