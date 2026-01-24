import type { MessageEntity } from 'grammy/types';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

export class ContentConverter {
  /**
   * Convert Telegram entities to standard Markdown.
   * Supports: bold, italic, underline, strikethrough, code, pre, link, spoiler.
   */
  static telegramToMd(text: string, entities?: MessageEntity[]): string {
    if (!entities || entities.length === 0) {
      return text;
    }

    const tags: { pos: number; type: 'start' | 'end'; tag: string; priority: number; index: number }[] = [];

    // Helper to add tags safely
    const addTag = (start: number, end: number, startStr: string, endStr: string, priority: number, index: number) => {
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
   * Supports: bold, italic, underline, strikethrough, code, pre, link, spoiler (||).
   */
  static mdToTelegramHtml(markdown: string): string {
    if (!markdown) return '';

    // Standard MD to HTML:
    // **bold** -> <strong>
    // _italic_ -> <em>
    // `code` -> <code>
    // [link](url) -> <a href>
    // 
    // Telegram needs: <b>, <i>, <u>, <s>, <code>, <pre>, <a href...>, <tg-spoiler>, <blockquote>
    
    // We'll define a custom strategy:
    // 1. Use remark to parse.
    // 2. Traverse AST to generate HTML string.
    // 
    // Note: remark-parse (CommonMark) doesn't support GFM strikethrough (~~) by default.
    // We handle ~~ in the text node processor manually.
          
    const processor = unified().use(remarkParse);
    
    const tree = processor.parse(markdown);
    
    return this.astToTelegramHtml(tree);
  }

  private static astToTelegramHtml(node: any): string {
    if (node.type === 'root') {
      return node.children.map((c: any) => this.astToTelegramHtml(c)).join('').trim();
    }

    if (node.type === 'paragraph') {
      // Telegram doesn't use <p> tags usually, but for standard MD separation 
      // between blocks, we should use double newlines.
      return node.children.map((c: any) => this.astToTelegramHtml(c)).join('') + '\n\n';
    }

    if (node.type === 'text') {
      let text = node.value;
      // Handle spoilers in text node: ||text||
      // Handle strikethrough in text node: ~~text~~ (since non-GFM parser treats it as text)
      
      // Note: text node content is raw.
      // We need to escape HTML entities (<, >, &)
      text = this.escapeHtml(text);
      
      // Replace ||...|| with <tg-spoiler>...</tg-spoiler>
      text = text.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
      
      // Replace ~~...~~ with <s>...</s>
      text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');
      
      return text;
    }

    if (node.type === 'strong') {
      return `<b>${node.children.map((c: any) => this.astToTelegramHtml(c)).join('')}</b>`;
    }

    if (node.type === 'emphasis') {
      return `<i>${node.children.map((c: any) => this.astToTelegramHtml(c)).join('')}</i>`;
    }
    
    if (node.type === 'delete') { // Strikethrough (GFM only? standard remark-parse might not parse this without gfm)
      // If remark-parse doesn't support gfm default, '~~' might be just text.
      // If so, we'll see handled in 'text'.
      return `<s>${node.children.map((c: any) => this.astToTelegramHtml(c)).join('')}</s>`;
    }

    if (node.type === 'inlineCode') {
      return `<code>${this.escapeHtml(node.value)}</code>`;
    }

    if (node.type === 'code') {
      const code = this.escapeHtml(node.value);
      const lang = node.lang ? ` class="language-${node.lang}"` : '';
      // <pre><code class="...">...</code></pre>
      return `<pre><code${lang}>${code}</code></pre>\n`;
    }

    if (node.type === 'link') {
      const href = this.escapeHtml(node.url);
      const content = node.children.map((c: any) => this.astToTelegramHtml(c)).join('');
      return `<a href="${href}">${content}</a>`;
    }
    
    if (node.type === 'html') {
      // Raw HTML. Should we allow?
      // For Telegram, safer to escape or ignore. 
      // Let's treat as text or ignore. original logic allowed <u>?
      // If explicit <u> tag was in MD.
      // If user typed <u>test</u> in MD, remark treats it as html node.
      // We can allow specific tags: u, s, b, i, em, strong.
      const val = node.value;
      if (val.match(/^<\/?(u|s|b|i|strong|em|tg-spoiler)>/)) {
         return val;
      }
      return this.escapeHtml(val);
    }
    
    if (node.type === 'blockquote') {
       return `<blockquote>${node.children.map((c: any) => this.astToTelegramHtml(c)).join('')}</blockquote>\n`;
    }
    
    // Fallback for list, etc.
    // List support is nice to have.
    if (node.type === 'list') {
      return node.children.map((c: any) => this.astToTelegramHtml(c)).join('');
    }
    if (node.type === 'listItem') {
       // Add a bullet?
       return `• ${node.children.map((c: any) => this.astToTelegramHtml(c)).join('')}\n`;
    }

    // Default fallback: traverse children
    if (node.children) {
      return node.children.map((c: any) => this.astToTelegramHtml(c)).join('');
    }

    return '';
  }

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      // .replace(/"/g, '&quot;') // Not strictly needed for content, mostly for attributes
      // .replace(/'/g, '&#039;');
  }
}
