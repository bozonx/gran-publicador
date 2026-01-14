/**
 * Response from Translate Gateway microservice.
 */
export interface TranslateResponseDto {
  /**
   * Translated text.
   */
  translatedText: string;

  /**
   * Provider used for translation.
   */
  provider: string;

  /**
   * Model used (if applicable).
   */
  model?: string;

  /**
   * Detected source language (if available).
   */
  detectedSourceLang?: string;

  /**
   * Provider raw response payload (JSON), passed through as-is.
   */
  raw?: unknown;

  /**
   * Number of chunks the text was split into (if chunking was used).
   */
  chunksCount?: number;

  /**
   * Effective maximum length used for splitting.
   */
  chunkLimit?: number;
}
