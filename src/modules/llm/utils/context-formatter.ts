/**
 * Utilities for formatting LLM context and managing token limits.
 */

export interface SourceText {
  content: string;
  order?: number;
  source?: string;
}

export interface FormatContextOptions {
  maxTokens?: number;
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
 * Truncates text to fit within a token limit.
 * Tries to truncate at sentence boundaries when possible.
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
): string {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate approximate character limit
  const maxChars = maxTokens * 4;
  
  // Try to find last sentence boundary before limit
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const lastBoundary = Math.max(lastPeriod, lastNewline);
  
  if (lastBoundary > maxChars * 0.8) {
    // If we found a good boundary (not too far back), use it
    return text.substring(0, lastBoundary + 1) + '\n\n[...truncated]';
  }
  
  // Otherwise, hard truncate
  return truncated + '...\n\n[...truncated]';
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
  const { maxTokens = 4000, includeMetadata = false } = options;
  
  let context = '';
  let remainingTokens = maxTokens;

  // Add main content if provided
  if (content) {
    const contentTokens = estimateTokens(content);
    
    if (contentTokens > remainingTokens * 0.6) {
      // If content is too large, truncate it
      const truncated = truncateToTokenLimit(content, Math.floor(remainingTokens * 0.6));
      context += `=== MAIN CONTENT ===\n${truncated}\n\n`;
      remainingTokens -= estimateTokens(truncated);
    } else {
      context += `=== MAIN CONTENT ===\n${content}\n\n`;
      remainingTokens -= contentTokens;
    }
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
      const sourceTokens = estimateTokens(source.content);
      
      // Reserve some tokens for remaining sources
      const tokensPerSource = Math.floor(remainingTokens / (sortedSources.length - i));
      
      let sourceContent = source.content;
      if (sourceTokens > tokensPerSource) {
        sourceContent = truncateToTokenLimit(source.content, tokensPerSource);
      }
      
      context += `--- SOURCE ${i + 1}`;
      if (includeMetadata && source.source) {
        context += ` (${source.source})`;
      }
      context += ` ---\n${sourceContent}\n\n`;
      
      remainingTokens -= estimateTokens(sourceContent);
      
      if (remainingTokens <= 100) {
        // Not enough tokens for more sources
        if (i < sortedSources.length - 1) {
          context += `[...${sortedSources.length - i - 1} more sources omitted due to token limit]\n\n`;
        }
        break;
      }
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
