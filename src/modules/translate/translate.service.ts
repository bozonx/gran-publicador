import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
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

  private isConnectionError(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string } };
    return (
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ECONNRESET' ||
      err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      err?.cause?.code === 'ECONNREFUSED' ||
      err?.cause?.code === 'ENOTFOUND'
    );
  }

  private isAbortError(error: unknown): boolean {
    const err = error as { name?: string; code?: string };
    return (
      err?.name === 'AbortError' ||
      err?.name === 'TimeoutError' ||
      err?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
      err?.code === 'UND_ERR_BODY_TIMEOUT'
    );
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
        const response = await request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          headersTimeout: timeoutMs,
          bodyTimeout: timeoutMs,
        });

        if (response.statusCode >= 400) {
          const errorText = await response.body.text();

          if (response.statusCode >= 400 && response.statusCode < 500 && response.statusCode !== 429) {
            this.logger.error(`Translate Gateway returned HTTP ${response.statusCode}: ${errorText}`);
            throw new BadRequestException(`Translation failed: ${errorText}`);
          }

          if (response.statusCode >= 500) {
            this.logger.error(`Translate Gateway returned HTTP ${response.statusCode}: ${errorText}`);
            throw new BadGatewayException(`Translate Gateway error: ${errorText}`);
          }

          throw new Error(`Server error ${response.statusCode}: ${errorText}`);
        }

        const data = (await response.body.json()) as T;

        if (!data || typeof data !== 'object') {
          throw new BadGatewayException('Invalid response format from Translate Gateway');
        }

        return data;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors or specific exceptions
        if (error instanceof BadRequestException || error instanceof BadGatewayException) {
          throw error;
        }

        // Check for timeout
        if (this.isAbortError(error)) {
          this.logger.error('Translate Gateway request timed out');
          throw new RequestTimeoutException(
            'Translation request timed out. The text may be too long or the service is overloaded.',
          );
        }

        // Check for connection errors
        if (this.isConnectionError(error)) {
          this.logger.error('Translate Gateway is unavailable');
          throw new ServiceUnavailableException(
            'Translate Gateway microservice is unavailable. Please check if the service is running.',
          );
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.warn(
            `Translation request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new BadGatewayException(
      `All retry attempts failed: ${lastError?.message || 'Unknown error'}`,
    );
  }
}
