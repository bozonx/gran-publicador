import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpConfig } from '../../config/http.config.js';
import { TranslateConfig } from '../../config/translate.config.js';
import type { TranslateTextDto } from './dto/translate-text.dto.js';
import type { TranslateResponseDto } from './dto/translate-response.dto.js';
import {
  isConnectionError,
  isTimeoutError,
  requestJsonWithRetry,
} from '../../common/utils/http-request-with-retry.util.js';

/**
 * Service for interacting with Translate Gateway microservice.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly config: TranslateConfig;
  private readonly httpConfig: HttpConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<TranslateConfig>('translate')!;
    this.httpConfig = this.configService.get<HttpConfig>('http')!;
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
      maxTextLength: dto.maxTextLength || this.config.maxTextLength,
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
      const timeoutMs = (this.config.requestTimeoutSecs ?? 30) * 1000;

      const { data } = await requestJsonWithRetry<TranslateResponseDto>({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        timeoutMs,
        retry: {
          maxAttempts: this.httpConfig.retryMaxAttempts,
          initialDelayMs: this.httpConfig.retryInitialDelayMs,
          maxDelayMs: this.httpConfig.retryMaxDelayMs,
        },
      });

      this.logger.debug(
        `Translation successful: provider=${data.provider}, model=${data.model}, chunks=${data.chunksCount}`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to translate text: ${error.message}`, error.stack);

      if (isTimeoutError(error)) {
        throw new RequestTimeoutException(
          'Translation request timed out. The text may be too long or the service is overloaded.',
        );
      }

      if (isConnectionError(error)) {
        throw new ServiceUnavailableException(
          'Translate Gateway microservice is unavailable. Please check if the service is running.',
        );
      }

      throw error;
    }
  }
}
