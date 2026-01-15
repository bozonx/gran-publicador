import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslateConfig } from '../../config/translate.config.js';
import { TranslateTextDto } from './dto/translate-text.dto.js';
import { TranslateResponseDto } from './dto/translate-response.dto.js';

/**
 * Service for interacting with Translate Gateway microservice.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly config: TranslateConfig;
  private readonly fetch = global.fetch;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<TranslateConfig>('translate')!;
  }

  /**
   * Translate text using Translate Gateway microservice.
   */
  async translateText(dto: TranslateTextDto): Promise<TranslateResponseDto> {
    const url = `${this.config.serviceUrl}/translate`;

    // Build request body with config defaults and DTO overrides
    const requestBody: any = {
      text: dto.text,
      targetLang: dto.targetLang,
      sourceLang: dto.sourceLang,
      provider: dto.provider || this.config.defaultProvider,
      model: dto.model || this.config.defaultModel,
      timeoutSec: dto.timeoutSec || this.config.timeoutSec,
      maxTextLength: dto.maxTextLength || this.config.maxTextLength,
      retryMaxAttempts: dto.retryMaxAttempts ?? this.config.retryMaxAttempts,
      retryInitialDelayMs: dto.retryInitialDelayMs ?? this.config.retryInitialDelayMs,
      retryMaxDelayMs: dto.retryMaxDelayMs ?? this.config.retryMaxDelayMs,
      maxChunkLength: dto.maxChunkLength,
      splitter: dto.splitter,
    };

    // Remove undefined values to let the microservice use its defaults
    Object.keys(requestBody).forEach(key => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    this.logger.debug(`Sending translation request to: ${url}`);
    this.logger.debug(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const timeoutMs = (dto.timeoutSec || this.config.timeoutSec || 50) * 1000;

      const data = await this.sendRequestWithRetry<TranslateResponseDto>(
        url,
        requestBody,
        timeoutMs,
      );

      this.logger.debug(
        `Translation successful: provider=${data.provider}, model=${data.model}, chunks=${data.chunksCount}`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to translate text: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send request with retry logic.
   */
  private async sendRequestWithRetry<T>(url: string, body: any, timeoutMs: number): Promise<T> {
    const maxRetries = 3;
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

          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Translate Gateway returned ${response.status}: ${errorText}`);
          }

          throw new Error(`Server error ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as T;

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from Translate Gateway');
        }

        return data;
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError' || error.message.includes('returned 4')) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.warn(
            `Translation request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('All retry attempts failed');
  }
}
