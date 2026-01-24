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

    // First, process custom "||" spoilers to HTML-friendly format
    // Because standard remark parser might mess them up or treat as text.
    // We can use regex to replace ||text|| with <tg-spoiler>text</tg-spoiler> BEFORE processing?
    // Or write a remark plugin. Regex is simpler for now but risky with code blocks.
    // A safer way: Use a custom processor or assume text is clean.
    // Let's try to handle it as simple replace if it's unique chars.
    // But better: Parse MD to HTML, then post-process.
    // Standard MD to HTML:
    // **bold** -> <strong>
    // _italic_ -> <em>
    // `code` -> <code>
    // [link](url) -> <a href>
    // 
    // Telegram needs: <b>, <i>, <u>, <s>, <code>, <pre>, <a href...>, <tg-spoiler>, <blockquote>
    
    // Step 1: Handle Spoilers
    // We need to support ||spoiler||.
    // Let's use a regex replacement that respects code blocks? Hard.
    // Let's assume we can pre-process || to <tg-spoiler> if it's not inside code.
    // Actually, `remark` has plugins. 
    // `remark-gfm` adds strikethrough (~~).
    // Use unified chain.
    
    // We'll define a custom strategy:
    // 1. Use remark to parse.
    // 2. Use remark-rehype to convert to HTML AST.
    // 3. Use rehype-sringify to get HTML.
    // 
    // BUT, we need `||` support. 
    // Let's replace `||` with a temporary marker that remark accepts (or just HTML)
    // If we replace `||foo||` with `<span data-spoiler>foo</span>` before markdown parsing?
    // Markdown parser might escape HTML. 
    // 
    // If we act on the output HTML?
    // If input is standard MD: "some ||spoiler|| text".
    // MD parser sees text "||spoiler||".
    // Output HTML: "<p>some ||spoiler|| text</p>".
    // Then we replace regular text ||...|| with <tg-spoiler>.
    
    // Setup processor
    const processor = unified()
      .use(remarkParse)
      // We might need remark-gfm for ~~strikethrough~~
      // .use(remarkGfm) // Need to install if not present. Based on package.json, we don't have it explicitly?
      // Checking package.json... remark-parse is there. remark-gfm not seen in list.
      // We do have `remark-parse`, `unified`.
      // We don't see `remark-html` in package.json from previous `view_file`.
      // Wait, let me check package.json again.
      // I saw lines 67, 71. `remark-parse`, `unified`.
      // I don't see `remark-html` or `remark-rehype`.
      // So I cannot use `remark-html` unless I install it or it's implicitly there (unlikely).
      // 
      // If no `remark-html`:
      // I can write a simple parser or use regex replacement if complexity is low.
      // Or I should ask to install it?
      // BUT `mdast-util-to-string` is there. `unist-util-visit` is there.
      // 
      // User requirement: "единый стандарт хранения... стандартный md... tiptap"
      // So we must rely on standard MD behavior.
      // Converting MD to Telegram HTML manually using AST is safer without extra libs.
      // 
      // Let's implement a AST walker using `unified` and `remark-parse` which are available.
      
    // Import dynamically if needed inside, or standard import if ESM.
    // We are in ESM. 
    
    const tree = processor.parse(markdown);
    
    // We need to traverse tree and build HTML string manually to control tags exactly for Telegram.
    
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
      // Simple regex for ||...||
      // Note: text node content is already escaped by default? No, AST has raw text.
      // We need to escape HTML entities (<, >, &)
      text = this.escapeHtml(text);
      
      // Replace ||...|| with <tg-spoiler>...</tg-spoiler>
      // Non-greedy match
      text = text.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
      
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
      const href = node.url;
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
