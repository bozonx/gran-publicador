/**
 * Utilities for formatting LLM context.
 */

export interface SourceText {
  content: string;
  order?: number;
  source?: string;
}

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
  sourceTexts: SourceText[] | null | undefined,
  options: FormatContextOptions = {},
): string {
  const { includeMetadata = false } = options;
  
  let context = '';

  // Add main content if provided
  if (content) {
    context += `=== MAIN CONTENT ===\n${content}\n\n`;
  }

  // Add source texts if provided
  if (sourceTexts && sourceTexts.length > 0) {
    context += `=== SOURCE MATERIALS ===\n\n`;
    
    // Sort by order if specified
    const sortedSources = [...sourceTexts].sort((a, b) => 
      (a.order ?? 0) - (b.order ?? 0)
    );

    for (let i = 0; i < sortedSources.length; i++) {
      const source = sortedSources[i];
      
      context += `--- SOURCE ${i + 1}`;
      if (includeMetadata && source.source) {
        context += ` (${source.source})`;
      }
      context += ` ---\n${source.content}\n\n`;
    }
  }

  return context;
}

/**
 * Builds a complete LLM prompt with context and user request.
 */
export function buildPromptWithContext(
  userPrompt: string,
  content?: string | null,
  sourceTexts?: SourceText[] | null,
  options: FormatContextOptions = {},
): string {
  const context = formatContext(content, sourceTexts, options);
  
  if (!context) {
    return userPrompt;
  }

  return `${context}=== USER REQUEST ===\n${userPrompt}`;
}
