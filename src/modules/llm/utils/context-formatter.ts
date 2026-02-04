/**
 * Utilities for formatting LLM context.
 */


export interface FormatContextOptions {
  includeMetadata?: boolean;
}

/**
 * Estimates the number of tokens in a text.
 * Uses a simple heuristic: ~4 characters per token for most languages.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Formats context for LLM prompt following best practices.
 * Structures the context with clear delimiters and labels.
 */
export function formatContext(
  content: string | null | undefined,
  options: FormatContextOptions = {},
): string {
  const { includeMetadata = false } = options;

  let context = '';

  // Add main content if provided
  if (content) {
    context += `=== MAIN CONTENT ===\n${content}\n\n`;
  }

  // No more source texts
  return context;
}

/**
 * Builds a complete LLM prompt with context and user request.
 */
export function buildPromptWithContext(
  userPrompt: string,
  content?: string | null,
  options: FormatContextOptions = {},
): string {
  const context = formatContext(content, options);

  if (!context) {
    return userPrompt;
  }

  return `${context}=== USER REQUEST ===\n${userPrompt}`;
}
