export function stripHtmlAndSpecialChars(content: string | null | undefined): string {
  if (!content) return ''

  // 1. Remove Markdown syntax
  let text = content
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, '')
    // Remove HTML tags (just in case some remain or for safety)
    .replace(/<[^>]*>/g, ' ')

  // 2. Decode basic HTML entities that might come from Tiptap or legacy
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')

  // 3. Keep only allowed characters: letters, numbers, spaces and basic punctuation
  // Extended to include more common punctuation symbols useful in text
  const clean = text.replace(/[^\p{L}\p{N}\s.,?!:;'"()[\]\-#@]/gu, '')

  // 4. Collapse multiple spaces and newlines
  return clean.replace(/\s+/g, ' ').trim()
}

/**
 * Checks if the content is logically empty, ignoring HTML tags
 * and whitespace. Useful for validating Tiptap editor content.
 */
export function isTextContentEmpty(content: string | null | undefined): boolean {
  if (!content) return true
  
  // Strip HTML tags and special chars, then check what's left
  const stripped = stripHtmlAndSpecialChars(content)
  return stripped.length === 0
}

