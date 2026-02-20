function stripEventHandlerAttributesFromTag(tag: string): string {
  return tag.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function stripEventHandlerAttributes(input: string): string {
  return input.replace(/<[^>]+>/g, tag => stripEventHandlerAttributesFromTag(tag));
}

export function sanitizePublicationMarkdownForStorage(input: string): string {
  const raw = String(input ?? '');
  if (!raw) return '';

  let result = stripEventHandlerAttributes(raw);

  // Unwrap <a> tags: keep inner text only.
  result = result.replace(/<\s*a\b[^>]*>/gi, '');
  result = result.replace(/<\s*\/\s*a\s*>/gi, '');

  // Discard dangerous tags while preserving inner text.
  // For paired tags: remove opening and closing tags.
  const paired = ['script', 'iframe', 'object', 'embed', 'style'];
  for (const tag of paired) {
    const open = new RegExp(`<\\s*${tag}\\b[^>]*>`, 'gi');
    const close = new RegExp(`<\\s*\\/\\s*${tag}\\s*>`, 'gi');
    result = result.replace(open, '').replace(close, '');
  }

  // For void-ish tags: remove any occurrences.
  const voidTags = ['link', 'meta', 'base'];
  for (const tag of voidTags) {
    const anyTag = new RegExp(`<\\s*${tag}\\b[^>]*\\/?\\s*>`, 'gi');
    result = result.replace(anyTag, '');
  }

  return result;
}
