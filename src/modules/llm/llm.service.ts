import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { LlmConfig } from '../../config/llm.config.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';
import { buildPromptWithContext } from './utils/context-formatter.js';
import { filterUndefined } from '../../common/utils/object.utils.js';
import {
  PUBLICATION_EXTRACT_SYSTEM_PROMPT,
  PUBLICATION_FIELDS_SYSTEM_PROMPT,
} from './constants/llm.constants.js';
import {
  GeneratePublicationFieldsDto,
  ChannelInfoDto,
} from './dto/generate-publication-fields.dto.js';

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
  private readonly defaultRequestTimeoutSecs: number;

  /**
   * Initializes the LlmService.
   * @param configService - NestJS Configuration service to retrieve LLM settings.
   */
  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<LlmConfig>('llm')!;
    this.defaultRequestTimeoutSecs =
      this.configService.get<number>('app.microserviceRequestTimeoutSeconds') ?? 30;
  }

  /**
   * Generate content using LLM Router.
   * Relies on the external microservice for retries and limit management.
   */
  async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
    const url = `${this.config.serviceUrl}/chat/completions`;

    // Build full prompt with context if provided
    const fullPrompt = this.buildFullPrompt(dto);

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

    try {
      const timeout = (this.config.timeoutSecs ?? this.defaultRequestTimeoutSecs ?? 120) * 1000;
      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      if (response.statusCode >= 400) {
        const errorText = await response.body.text();
        throw new Error(`LLM Router returned ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as LlmResponse;

      // Validate response structure
      if (!data.choices || data.choices.length === 0) {
        throw new Error('LLM Router returned empty choices array');
      }

      this.logger.debug(
        `LLM Router success: ${data.model} (fallback: ${data._router?.fallback_used})`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to generate content: ${error.message}`);
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
  /**
   * Extract publication parameters (title, description, tags, content) from text using LLM.
   */
  async extractParameters(dto: GenerateContentDto): Promise<LlmResponse> {
    const url = `${this.config.serviceUrl}/chat/completions`;

    const fullPrompt = this.buildFullPrompt(dto);

    const requestBody = {
      messages: [
        {
          role: 'system',
          content: PUBLICATION_EXTRACT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: dto.temperature || 0.3, // Lower temperature for more consistent JSON
      max_tokens: dto.max_tokens || 2000,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
      response_format: { type: 'json_object' }, // Request JSON output
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

    this.logger.debug(`Sending extraction request to LLM Router: ${url}`);

    try {
      const timeout = (this.config.timeoutSecs ?? this.defaultRequestTimeoutSecs ?? 120) * 1000;
      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      if (response.statusCode >= 400) {
        const errorText = await response.body.text();
        throw new Error(`LLM Router returned ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as LlmResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('LLM Router returned empty choices array');
      }

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to extract parameters: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate publication fields and per-channel post fields using LLM.
   */
  async generatePublicationFields(dto: GeneratePublicationFieldsDto): Promise<LlmResponse> {
    const url = `${this.config.serviceUrl}/chat/completions`;

    const channelsForPrompt = dto.channels.map((ch: ChannelInfoDto) => {
      const sameLanguage =
        this.normalizeLanguage(ch.language) === this.normalizeLanguage(dto.publicationLanguage);
      const hasChannelTags = Array.isArray(ch.tags) && ch.tags.length > 0;
      return {
        channelId: ch.channelId,
        channelName: ch.channelName,
        language: ch.language,
        tags: ch.tags || [],
        generateContent: !sameLanguage,
        generateTags: hasChannelTags || !sameLanguage,
      };
    });

    const instructionBlock = JSON.stringify({
      publicationLanguage: dto.publicationLanguage,
      channels: channelsForPrompt,
    });

    const userMessage = `=== INSTRUCTION ===\n${instructionBlock}\n\n=== SOURCE TEXT ===\n${dto.prompt}`;

    const requestBody = {
      messages: [
        {
          role: 'system',
          content: PUBLICATION_FIELDS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: dto.temperature || 0.3,
      max_tokens: dto.max_tokens || 4000,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
      response_format: { type: 'json_object' },
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

    this.logger.debug(`Sending publication fields request to LLM Router: ${url}`);

    try {
      const timeout = (this.config.timeoutSecs ?? this.defaultRequestTimeoutSecs ?? 120) * 1000;
      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      if (response.statusCode >= 400) {
        const errorText = await response.body.text();
        throw new Error(`LLM Router returned ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as LlmResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('LLM Router returned empty choices array');
      }

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to generate publication fields: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalizes a language code for comparison (e.g. "ru-RU" -> "ruru").
   */
  private normalizeLanguage(lang: string): string {
    return lang.toLowerCase().replace(/[-_]/g, '').trim();
  }

  private buildFullPrompt(dto: GenerateContentDto): string {
    // Determine content to include
    const content = dto.useContent ? dto.content : undefined;

    return buildPromptWithContext(dto.prompt, content, { includeMetadata: true });
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

  /**
   * Parses the publication fields JSON from an LLM response.
   */
  parsePublicationFieldsResponse(response: LlmResponse): {
    publication: { title: string; description: string; content: string; tags: string[] };
    posts: Array<{ channelId: string; content: string; tags: string[] }>;
  } {
    const content = this.extractContent(response);
    const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e: any) {
      this.logger.error(`Failed to parse publication fields JSON: ${e.message}`);
      return {
        publication: { title: '', description: '', content: '', tags: [] },
        posts: [],
      };
    }

    const pub = parsed.publication || {};
    const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

    return {
      publication: {
        title: pub.title || '',
        description: pub.description || '',
        content: pub.content || '',
        tags: Array.isArray(pub.tags) ? pub.tags.map(String) : [],
      },
      posts: posts.map((p: any) => ({
        channelId: p.channelId || '',
        content: p.content || '',
        tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      })),
    };
  }
}
