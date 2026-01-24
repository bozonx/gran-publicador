import type { MessageEntity } from 'grammy/types';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

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
   * Uses remark-gfm for standard tables (converted to text), strikethrough etc.
   * Enforces rigorous nesting rules compatible with Telegram API.
   */
  static mdToTelegramHtml(markdown: string): string {
    if (!markdown) return '';

    // Parse Markdown to AST
    const processor = unified().use(remarkParse).use(remarkGfm);
    const tree = processor.parse(markdown);
    
    // Convert AST to Telegram HTML
    return this.astToTelegramHtml(tree, { 
      isInsideCode: false, 
      isInsidePre: false 
    }).trim();
  }

  private static astToTelegramHtml(node: any, context: { isInsideCode: boolean; isInsidePre: boolean }): string {
    // Helper to process children efficiently
    const processChildren = (ctx = context) => {
      if (!node.children) return '';
      return node.children.map((c: any) => this.astToTelegramHtml(c, ctx)).join('');
    };

    // 1. Root
    if (node.type === 'root') {
      return processChildren();
    }

    // 2. Text node
    if (node.type === 'text') {
      let text = node.value;
      // Escape HTML entities
      text = this.escapeHtml(text);
      
      // Handle custom spoiler ||text|| if not inside code
      if (!context.isInsideCode && !context.isInsidePre) {
         text = text.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
      }
      
      return text;
    }

    // --- Block Elements ---

    // 3. Paragraph
    if (node.type === 'paragraph') {
      // Paragraphs are separated by double newline
      return processChildren() + '\n\n';
    }

    // 4. Heading (h1-h6)
    // Telegram doesn't support headers.
    // Requirement: "just clear and go as simple text with one empty line after it"
    // Since paragraph adds \n\n, and strict simple text implies just text...
    // But we need to distinguish a header block from just inline text. 
    // Usually headers are blocks. So we treat it like a paragraph (plain text + \n\n)
    if (node.type === 'heading') {
      return processChildren() + '\n\n';
    }

    // 5. Code Block (```) -> <pre><code class="..."></code></pre>
    if (node.type === 'code') {
      const code = this.escapeHtml(node.value);
      const lang = node.lang ? ` class="language-${node.lang}"` : '';
      // Telegram: pre/code cannot contain other entities. 
      // We are effectively just emitting text here, so no children recursion needed for 'value'.
      return `<pre><code${lang}>${code}</code></pre>\n\n`;
    }

    // 6. Blockquote
    if (node.type === 'blockquote') {
      // Telegram: blockquote can't be nested inside another blockquote (though UI supports it mostly, API is stricter).
      // We treat it as generic container.
      // Note: blockquotes in MD often contain paragraphs. 
      // We strip the last newline to merge into the quote properly, usually.
      const content = processChildren();
      // To ensure valid HTML, let's keep it simple.
      return `<blockquote>${content.trim()}</blockquote>\n\n`;
    }

    // 7. Lists
    if (node.type === 'list') {
      const ordered = node.ordered;
      const start = node.start || 1;
      
      return node.children.map((c: any, i: number) => {
        // c is listItem
        // Process children of listItem (usually paragraph)
        // We need to strip the paragraph's trailing newlines to make it a single line item if possible
        // or just handle it naturally.
        
        let itemContent = this.astToTelegramHtml(c, context).trim();
        
        // Remove wrapping paragraphs logic if necessary, but simply trimming is usually enough for simple lists.
        // If content has multiple blocks, it might get messy, but standard MD lists usually simple.
        
        if (ordered) {
          return `${start + i}. ${itemContent}\n`;
        } else {
          return `• ${itemContent}\n`;
        }
      }).join('') + '\n';
    }

    if (node.type === 'listItem') {
       // Should be handled by parent 'list'
       return processChildren();
    }

    // --- Inline Elements ---

    // Special Rule: If inside Code/Pre, ignore formatting logic and just output text (children recursion with flag)
    if (context.isInsideCode || context.isInsidePre) {
       return processChildren();
    }

    // 8. Bold (Strong) -> <b>
    if (node.type === 'strong') {
      return `<b>${processChildren()}</b>`;
    }

    // 9. Italic (Emphasis) -> <i>
    if (node.type === 'emphasis') {
      return `<i>${processChildren()}</i>`;
    }

    // 10. Strikethrough (Delete) -> <s>
    // Supported by remark-gfm
    if (node.type === 'delete') {
      return `<s>${processChildren()}</s>`;
    }

    // 11. Inline Code -> <code>
    if (node.type === 'inlineCode') {
      // Does not support nested entities inside
      return `<code>${this.escapeHtml(node.value)}</code>`;
    }

    // 12. Link -> <a href="...">
    if (node.type === 'link') {
      const href = this.escapeHtml(node.url);
      return `<a href="${href}">${processChildren()}</a>`;
    }

    // 13. HTML (Raw)
    if (node.type === 'html') {
       // Support basic valid tags if user typed them manually: <u>, <s>, <b>, <i>, <tg-spoiler>
       const val = node.value;
       if (val.match(/^<\/?(u|s|b|i|strong|em|tg-spoiler)>/)) {
          return val;
       }
       return this.escapeHtml(val);
    }
    
    // 14. Support for explicit 'underline' if coming from extended AST or if we decide to handle HTML-like nodes parsed as text differently,
    // but standard remark-gfm doesn't have 'underline' node type usually. 
    // If it was just text with <u> tags, it falls into 'html' node above.
    
    // Fallback: just return children text
    if (node.children) {
      return processChildren();
    }

    return '';
  }

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
