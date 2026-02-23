import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
  BadGatewayException,
  RequestTimeoutException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttConfig } from '../../config/stt.config.js';
import { request } from 'undici';
import type { Readable } from 'stream';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly defaultRequestTimeoutSecs: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultRequestTimeoutSecs =
      this.configService.get<SttConfig>('stt')!.requestTimeoutSecs ?? 600;
  }

  private isConnectionError(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string } };
    return (
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ECONNRESET' ||
      err?.cause?.code === 'ECONNREFUSED' ||
      err?.cause?.code === 'ENOTFOUND'
    );
  }

  private isTimeoutError(error: unknown): boolean {
    const err = error as { name?: string; code?: string };
    return (
      err?.name === 'TimeoutError' ||
      err?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
      err?.code === 'UND_ERR_BODY_TIMEOUT'
    );
  }

  private getRequestTimeoutMs(): number {
    return this.defaultRequestTimeoutSecs * 1000;
  }

  /**
   * Transcribes audio stream (or buffer) to text by proxying to STT Gateway.
   */
  async transcribeAudioStream(params: {
    file: Readable | Buffer;
    filename?: string;
    mimetype: string;
    language?: string;
    provider?: string;
    restorePunctuation?: boolean;
    formatText?: boolean;
    models?: string[];
    apiKey?: string;
    maxWaitMinutes?: number;
  }): Promise<{ text: string }> {
    const config = this.configService.get<SttConfig>('stt');

    if (!config?.serviceUrl) {
      this.logger.error('STT service URL is not configured');
      throw new InternalServerErrorException('STT service is not configured');
    }

    try {
      const filename = params.filename || 'upload';

      const provider = params.provider ?? config?.defaultProvider;
      const models =
        params.models ??
        (config?.defaultModels
          ? config.defaultModels
              .split(',')
              .map(m => m.trim())
              .filter(Boolean)
          : undefined);
      const restorePunctuation =
        params.restorePunctuation !== undefined
          ? params.restorePunctuation
          : config?.restorePunctuation;
      const formatText = params.formatText !== undefined ? params.formatText : config?.formatText;
      const language = config?.sendUserLanguage === false ? undefined : params.language;

      this.logger.log(
        `Proxying audio to STT Gateway: ${filename} (${params.mimetype})${language ? ` [lang: ${language}]` : ''}`,
      );

      if (
        Buffer.isBuffer(params.file) &&
        config.maxFileSize &&
        params.file.length > config.maxFileSize
      ) {
        throw new BadRequestException(
          `Audio file is too large. Max allowed size is ${config.maxFileSize} bytes.`,
        );
      }

      // Quick connectivity pre-check to fail fast if STT service is down
      try {
        const healthResponse = await request(config.serviceUrl, {
          method: 'HEAD',
          headersTimeout: 5_000,
          bodyTimeout: 5_000,
        });
        // Consume body to free socket
        await healthResponse.body.dump();
      } catch (healthErr) {
        if (this.isConnectionError(healthErr)) {
          throw new ServiceUnavailableException(
            'STT Gateway microservice is unavailable. Please check if the service is running.',
          );
        }
        // Non-connection errors (404 from HEAD, etc.) are fine — service is reachable
      }

      const headers: Record<string, string> = {
        'Content-Type': params.mimetype || 'application/octet-stream',
        'X-File-Name': filename,
      };

      if (provider) {
        headers['X-STT-Provider'] = provider;
      }

      if (language) {
        headers['X-STT-Language'] = language;
      }

      if (restorePunctuation !== undefined) {
        headers['X-STT-Restore-Punctuation'] = String(restorePunctuation);
      }

      if (formatText !== undefined) {
        headers['X-STT-Format-Text'] = String(formatText);
      }

      if (models?.length) {
        headers['X-STT-Models'] = models.join(',');
      }

      if (params.apiKey) {
        headers['X-STT-Api-Key'] = params.apiKey;
      }

      if (params.maxWaitMinutes !== undefined) {
        headers['X-STT-Max-Wait-Minutes'] = String(params.maxWaitMinutes);
      }

      if (Buffer.isBuffer(params.file)) {
        headers['Content-Length'] = String(params.file.length);
      }

      if (config.apiToken) {
        headers['Authorization'] = `Bearer ${config.apiToken}`;
      }

      this.logger.debug(`Starting raw upload to STT Gateway for ${filename}`);

      const response = await request(`${config.serviceUrl}/transcribe/stream`, {
        method: 'POST',
        body: params.file as any,
        headersTimeout: this.getRequestTimeoutMs(),
        bodyTimeout: this.getRequestTimeoutMs(),
        headers,
      });

      if (response.statusCode !== 200) {
        const errorBody = await response.body.json().catch(() => ({}));
        this.logger.error(
          `STT Gateway returned HTTP ${response.statusCode}: ${JSON.stringify(errorBody)}`,
        );

        const message =
          (errorBody as any)?.message ||
          (errorBody as any)?.error ||
          'Failed to transcribe audio via gateway';

        if (response.statusCode === 401) {
          throw new UnauthorizedException(message);
        }

        if (response.statusCode === 400) {
          throw new BadRequestException(message);
        }

        if (response.statusCode === 504) {
          throw new RequestTimeoutException(message);
        }

        if (response.statusCode >= 500) {
          throw new BadGatewayException(`STT Gateway error: ${message}`);
        }

        throw new InternalServerErrorException(message);
      }

      const result = (await response.body.json()) as { text: string };
      this.logger.log(`Transcription successful for ${filename}`);

      return {
        text: result.text,
      };
    } catch (error) {
      this.logger.error(
        `Failed to transcribe audio stream: ${(error as Error).message}`,
        (error as Error).stack,
      );

      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof RequestTimeoutException
      ) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        throw new RequestTimeoutException(
          'STT Gateway request timed out. The audio file may be too large or the service is overloaded.',
        );
      }

      if (this.isConnectionError(error)) {
        throw new ServiceUnavailableException(
          'STT Gateway microservice is unavailable. Please check if the service is running.',
        );
      }

      throw new InternalServerErrorException(
        `Transcription service error: ${(error as Error).message}`,
      );
    }
  }
}
