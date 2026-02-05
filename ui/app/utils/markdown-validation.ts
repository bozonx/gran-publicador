/**
 * Utility to detect block-level markdown elements.
 * Used to restrict input- [x] Implement inline markdown validation/restriction and info icons in UI <!-- id: 3 -->
- [/] Verify changes <!-- id: 4 -->
 */
export function containsBlockMarkdown(text: string): boolean {
  if (!text) return false;

  // Split by lines to check for line-start block elements
  const lines = text.split('\n');
  
  // Headers: # Header
  const headerRegex = /^\s*#{1,6}\s+/;
  
  // Lists: * Item, - Item, 1. Item
  const listRegex = /^\s*([-*+]|\d+\.)\s+/;
  
  // Blockquotes: > Quote
  const quoteRegex = /^\s*>\s+/;
  
  // Horizontal rules: ---, ***, ___
  const hrRegex = /^\s*([-*_]){3,}\s*$/;
  
  // Code blocks: ```
  const codeBlockRegex = /^\s*[`~]{3,}/;

  for (const line of lines) {
    if (headerRegex.test(line)) return true;
    if (listRegex.test(line)) return true;
    if (quoteRegex.test(line)) return true;
    if (hrRegex.test(line)) return true;
    if (codeBlockRegex.test(line)) return true;
  }

  // HTML block-level elements (simplified check)
  const htmlBlockRegex = /<(div|p|h[1-6]|ul|ol|li|blockquote|pre|hr|table|tr|td|th)\b/i;
  if (htmlBlockRegex.test(text)) return true;

  // Table markdown (pipes on a line that looks like a table row)
  const tableRegex = /^\s*\|.*\|.*$/m;
  const tableSeparatorRegex = /^\s*\|?[:\s-]*\|[:\s-]*\|?$/m;
  if (tableRegex.test(text) && tableSeparatorRegex.test(text)) return true;

  return false;
}
