import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
  BadGatewayException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttConfig } from '../../config/stt.config.js';
import { request, FormData } from 'undici';
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
   * Transcribes audio stream to text by proxying to STT Gateway.
   */
  async transcribeAudioStream(
    fileStream: Readable,
    filename: string,
    mimetype: string,
  ): Promise<{ text: string }> {
    const config = this.configService.get<SttConfig>('stt');

    if (!config?.serviceUrl) {
      this.logger.error('STT service URL is not configured');
      throw new InternalServerErrorException('STT service is not configured');
    }

    try {
      this.logger.log(`Proxying audio stream to STT Gateway: ${filename} (${mimetype})`);

      const form = new FormData();
      // STT Gateway expects 'file' field
      form.append('file', {
        type: mimetype,
        name: filename,
        [Symbol.for('undici.util.stream')]: fileStream,
      } as any);

      const response = await request(`${config.serviceUrl}/transcribe/stream`, {
        method: 'POST',
        body: form,
        headersTimeout: config?.timeoutMs || 30000,
        bodyTimeout: config?.timeoutMs || 30000,
        headers: {
          // undici handles Content-Type for FormData automatically
        },
      });

      if (response.statusCode !== 200) {
        const errorBody = await response.body.json().catch(() => ({}));
        this.logger.error(
          `STT Gateway returned HTTP ${response.statusCode}: ${JSON.stringify(errorBody)}`,
        );

        if (response.statusCode >= 500) {
          throw new BadGatewayException(
            `STT Gateway error: ${(errorBody as any).message || 'Internal server error'}`,
          );
        }

        throw new InternalServerErrorException('Failed to transcribe audio via gateway');
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
