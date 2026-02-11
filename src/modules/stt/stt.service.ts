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

  constructor(private readonly configService: ConfigService) {}

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
      this.logger.log(
        `Proxying audio to STT Gateway: ${filename} (${params.mimetype})${params.language ? ` [lang: ${params.language}]` : ''}`,
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

      const query = new URLSearchParams();
      query.set('filename', filename);
      if (params.provider) {
        query.set('provider', params.provider);
      }
      if (params.language) {
        query.set('language', params.language);
      }
      if (params.restorePunctuation !== undefined) {
        query.set('restorePunctuation', String(params.restorePunctuation));
      }
      if (params.formatText !== undefined) {
        query.set('formatText', String(params.formatText));
      }
      if (params.models?.length) {
        query.set('models', params.models.join(','));
      }
      if (params.apiKey) {
        query.set('apiKey', params.apiKey);
      }
      if (params.maxWaitMinutes !== undefined) {
        query.set('maxWaitMinutes', String(params.maxWaitMinutes));
      }

      const headers: Record<string, string> = {
        'Content-Type': params.mimetype || 'application/octet-stream',
      };

      if (config.apiToken) {
        headers['Authorization'] = `Bearer ${config.apiToken}`;
      }

      this.logger.debug(`Starting raw upload to STT Gateway for ${filename}`);

      const response = await request(
        `${config.serviceUrl}/transcribe/stream${query.size ? `?${query.toString()}` : ''}`,
        {
          method: 'POST',
          body: params.file as any,
          headersTimeout: config?.timeoutMs || 300000,
          bodyTimeout: config?.timeoutMs || 300000,
          headers,
        },
      );

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

      if (error instanceof InternalServerErrorException || error instanceof BadGatewayException) {
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
