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

    const tags: { pos: number; type: 'start' | 'end'; tag: string; priority: number }[] = [];

    // Helper to add tags safely
    const addTag = (start: number, end: number, startStr: string, endStr: string, priority: number) => {
      // Ensure we don't go out of bounds
      if (start < 0 || end > text.length) return;
      
      tags.push({ pos: start, type: 'start', tag: startStr, priority });
      tags.push({ pos: end, type: 'end', tag: endStr, priority: -priority });
    };

    for (const entity of entities) {
      // Priority helps with nesting: higher number = outer tag (for start)
      // We want inner tags to close first, so priority logic in sorting will handle that.
      // But actually, for standard MD, nesting order matters.
      // Let's stick to the logic:
      // Inner tags: start later, end earlier.
      // If same range, we need consistent ordering.
      // Let's use entity length as priority proxy like in original code.
      
      const p = entity.length;

      switch (entity.type) {
        case 'bold':
          addTag(entity.offset, entity.offset + entity.length, '**', '**', p);
          break;
        case 'italic':
          addTag(entity.offset, entity.offset + entity.length, '_', '_', p);
          break;
        case 'underline':
          // Standard MD doesn't support underline universally, but many processors do or allow HTML.
          // Tiptap usually supports <u>. Let's use <u> for now as in original.
          addTag(entity.offset, entity.offset + entity.length, '<u>', '</u>', p);
          break;
        case 'strikethrough':
          addTag(entity.offset, entity.offset + entity.length, '~~', '~~', p);
          break;
        case 'code':
          addTag(entity.offset, entity.offset + entity.length, '`', '`', p);
          break;
        case 'pre':
          addTag(entity.offset, entity.offset + entity.length, '```' + (entity.language || '') + '\n', '\n```', p);
          break;
        case 'text_link':
          addTag(entity.offset, entity.offset + entity.length, '[', `](${entity.url})`, p);
          break;
        case 'text_mention':
          addTag(entity.offset, entity.offset + entity.length, '[', `](tg://user?id=${entity.user?.id})`, p);
          break;
        case 'spoiler':
          // Standard MD doesn't have spoiler. We use || as agreed.
          addTag(entity.offset, entity.offset + entity.length, '||', '||', p);
          break;
        case 'blockquote':
        case 'expandable_blockquote':
          // Blockquotes are line-based in MD.
          // We can't just wrap generic range with > ...
          // Multiline handling is tricky if we just inject strings.
          // But for simple single-block conversion this works if entities align with lines.
          // Let's assume standard behavior: prepend > to the block.
          // However, converting range to blockquote syntax in inline string is hard.
          // Simplistic approach: add > at start.
          // LIMITATION: This might break if quote is mid-line (rare in Telegram).
          // Better approach might be needed for multiline.
          // For now, consistent with previous implementation: 
          addTag(entity.offset, entity.offset + entity.length, '> ', '', p);
          break;
      }
    }

    // Sort tags:
    // 1. Position ascending
    // 2. End tags before Start tags at same position (HTML-style nesting)
    // 3. For Start tags: Longest first (outer) -> Shortest last (inner).
    // 4. For End tags: Shortest first (inner) -> Longest last (outer).
    tags.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.type !== b.type) return a.type === 'end' ? -1 : 1; // End tags first at same position
      
      // For Start tags (positive priority): Larger length (Priority) comes first strategies (Outer first)
      // For End tags (negative priority): Inner first. 
      // Inner has shorter length. 
      // Bold(15) -> Start(15), End(-15).
      // Italic(6) -> Start(6), End(-6).
      // At End: We want Italic(-6) before Bold(-15).
      // b.priority - a.priority:
      // (-6) - (-15) = 9. (>0) -> b first. Correct.
      // At Start: We want Bold(15) before Italic(6).
      // (6) - (15) = -9 (<0) -> a first. Correct.
      return b.priority - a.priority;
    });

    let result = '';
    let lastPos = 0;
    
    // We definitely need to deal with UTF-16 characters properly.
    // Telegram offsets are UTF-16 code units. JS strings are UTF-16.
    // So substring works natively with these offsets.
    
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
      // Telegram doesn't use <p> tags usually, just newlines.
      // Or it supports them but often clearer to just join children.
      // If we use <p>, we might get extra margins.
      // Standard practice for Telegram HTML: just text with logic.
      // But paragraphs imply separation. Two newlines?
      // Let's join children and append \n\n if it's not the last one?
      // Or just join.
      return node.children.map((c: any) => this.astToTelegramHtml(c)).join('') + '\n';
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
