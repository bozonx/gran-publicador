export function stripHtmlAndSpecialChars(html: string | null | undefined): string {
  if (!html) return ''

  // 1. Remove HTML tags
  const withoutTags = html.replace(/<[^>]*>/g, ' ')

  // 2. Decode HTML entities (basic ones) if needed, or rely on browser?
  // For a simple util, we might want to handle &nbsp; etc.
  // let's just do a basic replace for common entities if this runs in node/ssr?
  // But this runs in Vue, so we could use a DOM parser, but regex is safer for SSR/Universal.
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')

  // 3. Keep only allowed characters: letters, numbers, punctuation
  // Allowed: letters (unicode properties \p{L}), numbers (\p{N}), spaces, .,?!-
  // We want to remove *formatting* chars but keep text.
  // The user said: "оставляет в тексте буквы (на любых языках), цифры, и симолы .,?!- (может еще какие)"
  // Let's interpret "formattting" as weird symbols?
  // Actually, mostly just want to remove HTML. Semicolons, colons, parens might be useful in text.
  // User says "only basic symbols which relate to text not formatting".
  // Let's keep: \p{L}, \p{N}, \s, ., ?, !, -, ,, :, (, ), ', "
  
  // Regex to match allowed characters. We negate it to find what to remove.
  // [^\p{L}\p{N}\s.,?!:;'"()[\]\-] 
  // Note: - needs escaping or placed at end.
  const clean = decoded.replace(/[^\p{L}\p{N}\s.,?!:;'"()[\]\-]/gu, '')

  // 4. Collapse multiple spaces
  return clean.replace(/\s+/g, ' ').trim()
}
