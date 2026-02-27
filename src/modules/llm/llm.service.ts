import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { LlmConfig } from '../../config/llm.config.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';
import { HttpConfig } from '../../config/http.config.js';
import { filterUndefined } from '../../common/utils/object.utils.js';
import {
  isConnectionError,
  isTimeoutError,
  requestJsonWithRetry,
} from '../../common/utils/http-request-with-retry.util.js';
import {
  DEFAULT_LLM_CONTEXT_LIMIT_CHARS,
  DEFAULT_LLM_TIMEOUT_SECS,
} from '../../common/constants/global.constants.js';
import {
  PUBLICATION_FIELDS_SYSTEM_PROMPT,
  RAW_RESULT_SYSTEM_PROMPT,
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
    data?: unknown;
  };
}

/**
 * Service for interacting with Free LLM Router microservice.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly config: LlmConfig;
  private readonly httpConfig: HttpConfig;

  private readonly defaultContextLimitChars = DEFAULT_LLM_CONTEXT_LIMIT_CHARS;

  private getChatCompletionsUrl(): string {
    return `${this.config.serviceUrl}/chat/completions`;
  }

  private getRequestTimeoutMs(): number {
    return (this.config.requestTimeoutSecs ?? DEFAULT_LLM_TIMEOUT_SECS) * 1000;
  }

  private async callLlmRouter(
    requestBody: Record<string, any>,
    logContext: Record<string, any>,
    options: { signal?: AbortSignal } = {},
  ) {
    const url = this.getChatCompletionsUrl();
    const timeout = this.getRequestTimeoutMs();

    this.logger.debug(`Sending request to LLM Router: ${url}`);

    try {
      const { data } = await requestJsonWithRetry<LlmResponse>({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        timeoutMs: timeout,
        retry: {
          maxAttempts: this.httpConfig.retryMaxAttempts,
          initialDelayMs: this.httpConfig.retryInitialDelayMs,
          maxDelayMs: this.httpConfig.retryMaxDelayMs,
        },
      });

      // Validate response structure
      if (!data || typeof data !== 'object') {
        this.logger.error(
          `LLM Router returned invalid response structure. Context=${JSON.stringify(logContext)}`,
        );
        throw new BadGatewayException('LLM provider returned invalid response');
      }

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        this.logger.error(
          `LLM Router returned empty choices. Context=${JSON.stringify({
            ...logContext,
            model: data.model,
            router: data._router,
          })}`,
        );
        throw new BadGatewayException('LLM provider returned empty response');
      }

      const firstChoice = data.choices[0];
      if (!firstChoice || typeof firstChoice !== 'object') {
        this.logger.error(
          `LLM Router returned invalid choice structure. Context=${JSON.stringify(logContext)}`,
        );
        throw new BadGatewayException('LLM provider returned invalid response');
      }

      if (!firstChoice.message || typeof firstChoice.message !== 'object') {
        this.logger.error(
          `LLM Router returned invalid message structure. Context=${JSON.stringify(logContext)}`,
        );
        throw new BadGatewayException('LLM provider returned invalid response');
      }

      if (typeof firstChoice.message.content !== 'string') {
        this.logger.error(
          `LLM Router returned invalid content type. Context=${JSON.stringify(logContext)}`,
        );
        throw new BadGatewayException('LLM provider returned invalid response');
      }

      this.logger.debug(
        `LLM Router success: ${data.model} (fallback: ${data._router?.fallback_used})`,
      );

      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError' || options.signal?.aborted) {
        throw new HttpException('Request aborted', 499);
      }

      this.logger.error(
        `LLM Router request failed. Context=${JSON.stringify({
          ...logContext,
          errorName: error?.name,
          errorMessage: error?.message,
        })}`,
      );

      if (isTimeoutError(error)) {
        throw new RequestTimeoutException('LLM provider request timed out');
      }

      if (isConnectionError(error)) {
        throw new BadGatewayException('LLM provider connection failed');
      }

      if (error instanceof HttpException) throw error;

      throw new BadGatewayException('LLM provider request failed');
    }
  }

  private extractJsonDataFromResponse(response: LlmResponse): any {
    const data = (response as any)?._router?.data;
    if (data && typeof data === 'object') {
      return data;
    }

    const content = this.extractContent(response);
    return this.parseJsonFromLlmContent(content);
  }

  private stripCodeFences(text: string): string {
    return String(text || '')
      .replace(/```(?:json)?\n?|\n?```/g, '')
      .trim();
  }

  private tryExtractFirstJsonObject(text: string): string | null {
    const s = String(text || '');
    const start = s.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < s.length; i += 1) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }

    return null;
  }

  private parseJsonFromLlmContent(content: string): any {
    const clean = this.stripCodeFences(content);
    try {
      return JSON.parse(clean);
    } catch {
      const extracted = this.tryExtractFirstJsonObject(clean);
      if (!extracted) {
        throw new BadGatewayException('LLM returned invalid JSON');
      }
      try {
        return JSON.parse(extracted);
      } catch {
        throw new BadGatewayException('LLM returned invalid JSON');
      }
    }
  }

  public async generateChat(
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      max_tokens?: number;
      model?: string;
      tags?: string[];
      type?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<LlmResponse> {
    const requestBody = {
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.max_tokens ?? this.config.maxTokens,
      model: options.model,
      tags: options.tags || this.config.defaultTags,
      type: options.type ?? this.config.defaultType,
      ...filterUndefined({
        max_model_switches: this.config.maxModelSwitches,
        max_same_model_retries: this.config.maxSameModelRetries,
        retry_delay: this.config.retryDelay,
        timeout_secs: this.config.requestTimeoutSecs,
        fallback_provider: this.config.fallbackProvider,
        fallback_model: this.config.fallbackModel,
        min_context_size: this.config.minContextSize,
        min_max_output_tokens: this.config.minMaxOutputTokens,
      }),
    };

    return this.callLlmRouter(
      requestBody,
      {
        method: 'generateChat',
        hasMessages: Array.isArray(messages) && messages.length > 0,
        model: options.model,
        tags: options.tags,
        type: options.type,
      },
      { signal: options.signal },
    );
  }

  /**
   * Initializes the LlmService.
   * @param configService - NestJS Configuration service to retrieve LLM settings.
   */
  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<LlmConfig>('llm')!;
    this.httpConfig = this.configService.get<HttpConfig>('http')!;
  }

  /**
   * Generate content using LLM Router.
   * Relies on the external microservice for retries and limit management.
   */
  async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
    // Build full prompt with context if provided
    const fullPrompt = this.buildFullPrompt(dto);

    const messages: any[] = [];

    if (dto.onlyRawResult) {
      messages.push({
        role: 'system',
        content: RAW_RESULT_SYSTEM_PROMPT,
      });
    }

    messages.push({
      role: 'user',
      content: fullPrompt,
    });

    // Build request body with config defaults and DTO overrides
    const requestBody = {
      messages,
      temperature: dto.temperature ?? this.config.temperature,
      max_tokens: dto.max_tokens ?? this.config.maxTokens,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
      // Add optional routing parameters from config
      ...filterUndefined({
        max_model_switches: this.config.maxModelSwitches,
        max_same_model_retries: this.config.maxSameModelRetries,
        retry_delay: this.config.retryDelay,
        timeout_secs: this.config.requestTimeoutSecs,
        fallback_provider: this.config.fallbackProvider,
        fallback_model: this.config.fallbackModel,
        min_context_size: this.config.minContextSize,
        min_max_output_tokens: this.config.minMaxOutputTokens,
      }),
    };

    return this.callLlmRouter(requestBody, {
      method: 'generateContent',
      model: dto.model,
      tags: dto.tags,
      onlyRawResult: dto.onlyRawResult,
      contextLimitChars: dto.contextLimitChars,
      hasSelection: Boolean(dto.selectionText?.trim()),
      hasContent: Boolean(dto.content?.trim()),
      mediaCount: Array.isArray(dto.mediaDescriptions) ? dto.mediaDescriptions.length : 0,
    });
  }

  /**
   * Generate publication fields and per-channel post fields using LLM.
   */
  async generatePublicationFields(dto: GeneratePublicationFieldsDto): Promise<LlmResponse> {
    const channelsForPrompt = dto.channels.map((ch: ChannelInfoDto) => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      socialMedia: ch.socialMedia,
      tags: ch.tags || [],
      maxContentLength: ch.maxContentLength,
    }));

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
      temperature: dto.temperature || this.config.temperature || 0.3,
      max_tokens: dto.max_tokens || this.config.maxTokens || 4000,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
      response_format: { type: 'json_object' },
      ...filterUndefined({
        max_model_switches: this.config.maxModelSwitches,
        max_same_model_retries: this.config.maxSameModelRetries,
        retry_delay: this.config.retryDelay,
        timeout_secs: this.config.requestTimeoutSecs,
        fallback_provider: this.config.fallbackProvider,
        fallback_model: this.config.fallbackModel,
        min_context_size: this.config.minContextSize,
        min_max_output_tokens: this.config.minMaxOutputTokens,
      }),
    };

    return this.callLlmRouter(requestBody, {
      method: 'generatePublicationFields',
      model: dto.model,
      tags: dto.tags,
      channelsCount: Array.isArray(dto.channels) ? dto.channels.length : 0,
      publicationLanguage: dto.publicationLanguage,
    });
  }

  /**
   * Normalizes a language code for comparison (e.g. "ru-RU" -> "ruru").
   */
  private normalizeLanguage(lang: string): string {
    return lang.toLowerCase().replace(/[-_]/g, '').trim();
  }

  private buildFullPrompt(dto: GenerateContentDto): string {
    const contextLimit = dto.contextLimitChars ?? this.defaultContextLimitChars;

    const parts: string[] = [];

    if (dto.selectionText?.trim()) {
      parts.push(`<selection>\n${dto.selectionText.trim()}\n</selection>`);
    }

    if (!dto.selectionText?.trim()) {
      const content = dto.useContent ? dto.content : undefined;
      if (content?.trim()) {
        parts.push(`<source_content>\n${content.trim()}\n</source_content>`);
      }
    }

    if (Array.isArray(dto.mediaDescriptions)) {
      for (const raw of dto.mediaDescriptions) {
        const text = String(raw ?? '').trim();
        if (!text) continue;
        parts.push(`<image_description>${text}</image_description>`);
      }
    }

    const contextBlockRaw = parts.join('\n');
    const contextBlock = contextBlockRaw.slice(0, Math.max(0, contextLimit));

    return contextBlock ? `${dto.prompt.trim()}\n\n${contextBlock}` : dto.prompt;
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
    const parsed = this.extractJsonDataFromResponse(response);

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
