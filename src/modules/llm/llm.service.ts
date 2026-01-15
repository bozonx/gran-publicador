import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmConfig } from '../../config/llm.config.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';
import { buildPromptWithContext, estimateTokens } from './utils/context-formatter.js';
import { filterUndefined } from '../../common/utils/object.utils.js';

/**
 * Response from LLM Router API.
 */
export interface LlmResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _router?: {
    provider: string;
    model_name: string;
    attempts: number;
    fallback_used: boolean;
    errors?: any[];
  };
}

/**
 * Service for interacting with Free LLM Router microservice.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly config: LlmConfig;
  private readonly fetch = global.fetch;

  /**
   * Initializes the LlmService.
   * @param configService - NestJS Configuration service to retrieve LLM settings.
   */
  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<LlmConfig>('llm')!;
  }

  /**
   * Generate content using LLM Router.
   * Handles context formatting and token management on the backend.
   */
  async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
    const url = `${this.config.serviceUrl}/chat/completions`;

    // Build full prompt with context if provided
    const fullPrompt = this.buildFullPrompt(dto);
    const estimatedTokens = estimateTokens(fullPrompt);

    this.logger.debug(`Building prompt with ${estimatedTokens} estimated tokens`);

    // Build request body with config defaults and DTO overrides
    const requestBody = {
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: dto.temperature,
      max_tokens: dto.max_tokens,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
      // Add optional routing parameters from config
      ...filterUndefined({
        max_model_switches: this.config.maxModelSwitches,
        max_same_model_retries: this.config.maxSameModelRetries,
        retry_delay: this.config.retryDelay,
        timeout_secs: this.config.timeoutSecs,
        fallback_provider: this.config.fallbackProvider,
        fallback_model: this.config.fallbackModel,
        min_context_size: this.config.minContextSize,
        min_max_output_tokens: this.config.minMaxOutputTokens,
      }),
    };

    this.logger.debug(`Sending request to LLM Router: ${url}`);
    this.logger.debug(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const data = await this.sendRequestWithRetry<LlmResponse>(
        url,
        requestBody,
        3, // maxRetries
        (this.config.timeoutSecs || 60) * 1000,
      );

      // Validate response structure
      if (!data.choices || data.choices.length === 0) {
        throw new Error('LLM Router returned empty choices array');
      }

      this.logger.debug(`LLM Router response: ${JSON.stringify(data._router, null, 2)}`);

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to generate content: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Builds the full prompt string combining user prompt with formatted context.
   * 
   * @param dto - The generate content DTO containing prompt and context sources.
   * @returns A fully constructed prompt string ready for LLM consumption.
   * @private
   */
  private buildFullPrompt(dto: GenerateContentDto): string {
    // Filter source texts if specific indexes are selected
    let sourceTexts = dto.sourceTexts;
    if (dto.selectedSourceIndexes && dto.selectedSourceIndexes.length > 0 && sourceTexts) {
      sourceTexts = dto.selectedSourceIndexes
        .map(index => sourceTexts![index])
        .filter(Boolean);
    }

    // Determine content to include
    const content = dto.useContent ? dto.content : undefined;

    // Calculate max tokens for context (reserve tokens for response)
    const maxContextTokens = (dto.max_tokens || 2000) < 4000 
      ? 2000 
      : 4000;

    return buildPromptWithContext(
      dto.prompt,
      content,
      sourceTexts,
      { maxTokens: maxContextTokens, includeMetadata: true },
    );
  }

  /**
   * Sends an HTTP request with exponential backoff retry logic.
   * Retries on 5xx server errors and 429 rate limits.
   * 
   * @param url - The service endpoint URL.
   * @param body - The request body object.
   * @param maxRetries - Maximum number of retry attempts (default: 3).
   * @param timeoutMs - Request timeout in milliseconds (default: 60000).
   * @returns The parsed JSON response of type T.
   * @throws Error on non-retryable client errors or after all retry attempts fail.
   * @private
   */
  private async sendRequestWithRetry<T>(
    url: string,
    body: any,
    maxRetries: number = 3,
    timeoutMs: number = 60000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Do not retry for client errors (4xx) except maybe 429
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`LLM Router returned ${response.status}: ${errorText}`);
          }

          // Retry for server errors (5xx) or rate limits (429)
          throw new Error(`Server error ${response.status}: ${errorText}`);
        }

        return (await response.json()) as T;
      } catch (error: any) {
        lastError = error;

        // Do not retry for explicit aborts or specific client errors already thrown above
        if (error.name === 'AbortError' || error.message.includes('returned 4')) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.warn(
            `LLM request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('All retry attempts failed');
  }

  /**
   * Helper method to extract the text content from a standard LLM Router response.
   * 
   * @param response - The raw response from the LLM Router.
   * @returns The text content of the first choice message, or an empty string if not found.
   */
  extractContent(response: LlmResponse): string {
    return response.choices[0]?.message?.content || '';
  }
}
