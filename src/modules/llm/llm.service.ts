import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmConfig } from '../../config/llm.config.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';

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

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<LlmConfig>('llm')!;
  }

  /**
   * Generate content using LLM Router.
   */
  async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
    const url = `${this.config.serviceUrl}/chat/completions`;

    // Build request body with config defaults and DTO overrides
    const requestBody: any = {
      messages: [
        {
          role: 'user',
          content: dto.prompt,
        },
      ],
      temperature: dto.temperature,
      max_tokens: dto.max_tokens,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
    };

    // Add optional routing parameters from config
    if (this.config.maxModelSwitches !== undefined) {
      requestBody.max_model_switches = this.config.maxModelSwitches;
    }
    if (this.config.maxSameModelRetries !== undefined) {
      requestBody.max_same_model_retries = this.config.maxSameModelRetries;
    }
    if (this.config.retryDelay !== undefined) {
      requestBody.retry_delay = this.config.retryDelay;
    }
    if (this.config.timeoutSecs !== undefined) {
      requestBody.timeout_secs = this.config.timeoutSecs;
    }
    if (this.config.fallbackProvider) {
      requestBody.fallback_provider = this.config.fallbackProvider;
    }
    if (this.config.fallbackModel) {
      requestBody.fallback_model = this.config.fallbackModel;
    }
    if (this.config.minContextSize !== undefined) {
      requestBody.min_context_size = this.config.minContextSize;
    }
    if (this.config.minMaxOutputTokens !== undefined) {
      requestBody.min_max_output_tokens = this.config.minMaxOutputTokens;
    }

    this.logger.debug(`Sending request to LLM Router: ${url}`);
    this.logger.debug(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout((this.config.timeoutSecs || 60) * 1000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`LLM Router error: ${response.status} ${errorText}`);
        throw new Error(`LLM Router returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as LlmResponse;
      this.logger.debug(`LLM Router response: ${JSON.stringify(data._router, null, 2)}`);

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to generate content: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract content from LLM response.
   */
  extractContent(response: LlmResponse): string {
    return response.choices[0]?.message?.content || '';
  }


}
