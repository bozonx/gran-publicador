import { Injectable, Logger } from '@nestjs/common';
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

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Translate Gateway error: ${response.status} ${errorText}`);
        throw new Error(`Translate Gateway returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as TranslateResponseDto;
      this.logger.debug(
        `Translation successful: provider=${data.provider}, model=${data.model}, chunks=${data.chunksCount}`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to translate text: ${error.message}`, error.stack);
      throw error;
    }
  }
}
