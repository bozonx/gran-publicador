import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

/**
 * Convert standard Markdown to Telegram HTML.
 * Uses remark-gfm for standard tables (converted to text), strikethrough etc.
 * Enforces rigorous nesting rules compatible with Telegram API.
 */
export function mdToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown);

  return astToTelegramHtml(tree, {
    isInsideCode: false,
    isInsidePre: false,
  }).trim();
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function astToTelegramHtml(
  node: any,
  context: { isInsideCode: boolean; isInsidePre: boolean },
): string {
  const processChildren = (ctx = context) => {
    if (!node.children) return '';
    return node.children.map((c: any) => astToTelegramHtml(c, ctx)).join('');
  };

  // 1. Root
  if (node.type === 'root') {
    return processChildren();
  }

  // 2. Text node
  if (node.type === 'text') {
    let text = escapeHtml(node.value);

    if (!context.isInsideCode && !context.isInsidePre) {
      text = text.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
    }

    return text;
  }

  // 3. Paragraph
  if (node.type === 'paragraph') {
    return processChildren() + '\n\n';
  }

  // 4. Heading — Telegram doesn't support headers, render as plain text block
  if (node.type === 'heading') {
    return processChildren() + '\n\n';
  }

  // 5. Code block -> <pre><code class="language-...">
  if (node.type === 'code') {
    const code = escapeHtml(node.value);
    const lang = node.lang ? ` class="language-${node.lang}"` : '';
    return `<pre><code${lang}>${code}</code></pre>\n\n`;
  }

  // 6. Blockquote
  if (node.type === 'blockquote') {
    const content = processChildren();
    return `<blockquote>${content.trim()}</blockquote>\n\n`;
  }

  // 7. Lists
  if (node.type === 'list') {
    const ordered = node.ordered;
    const start = node.start || 1;

    return (
      node.children
        .map((c: any, i: number) => {
          const itemContent = astToTelegramHtml(c, context).trim();
          if (ordered) {
            return `${start + i}. ${itemContent}\n`;
          } else {
            return `• ${itemContent}\n`;
          }
        })
        .join('') + '\n'
    );
  }

  if (node.type === 'listItem') {
    return processChildren();
  }

  // Inline elements — skip formatting inside code/pre
  if (context.isInsideCode || context.isInsidePre) {
    return processChildren();
  }

  // 8. Bold
  if (node.type === 'strong') {
    return `<b>${processChildren()}</b>`;
  }

  // 9. Italic
  if (node.type === 'emphasis') {
    return `<i>${processChildren()}</i>`;
  }

  // 10. Strikethrough
  if (node.type === 'delete') {
    return `<s>${processChildren()}</s>`;
  }

  // 11. Inline code
  if (node.type === 'inlineCode') {
    return `<code>${escapeHtml(node.value)}</code>`;
  }

  // 12. Link
  if (node.type === 'link') {
    const encodedUrl = encodeURI(node.url);
    const href = escapeHtml(encodedUrl);
    return `<a href="${href}">${processChildren()}</a>`;
  }

  // 13. Raw HTML — pass through allowed Telegram tags
  if (node.type === 'html') {
    const val = node.value;
    const allowedTags = 'a|u|s|b|i|strong|em|tg-spoiler|ins|strike|del|span|code|pre|blockquote';
    const regex = new RegExp(`^<\\/?(${allowedTags})(\\s+[^>]*?)?>`, 'i');

    if (val.match(regex)) {
      return val;
    }
    return escapeHtml(val);
  }

  if (node.children) {
    return processChildren();
  }

  return '';
}
