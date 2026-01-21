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
import { request } from 'undici';
import FormData from 'form-data';
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
      form.append('file', fileStream, {
        contentType: mimetype,
        filename: filename,
      });

      // Use global fetch (Node 18+) for better streaming support
      const response = await fetch(`${config.serviceUrl}/transcribe/stream`, {
        method: 'POST',
        // @ts-ignore - 'duplex' is a valid option for Node.js fetch but may not be in standard TS types yet
        duplex: 'half', 
        body: form as any,
        headers: {
          ...form.getHeaders(),
        },
        signal: AbortSignal.timeout(config?.timeoutMs || 300000),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        this.logger.error(
          `STT Gateway returned HTTP ${response.status}: ${JSON.stringify(errorBody)}`,
        );

        if (response.status >= 500) {
          throw new BadGatewayException(
            `STT Gateway error: ${(errorBody as any).message || 'Internal server error'}`,
          );
        }

        throw new InternalServerErrorException('Failed to transcribe audio via gateway');
      }

      const result = (await response.json()) as { text: string };
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
