import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttConfig } from '../../config/stt.config.js';
import { request, FormData } from 'undici';
import type { Readable } from 'stream';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  constructor(private readonly configService: ConfigService) {}

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
        headersTimeout: config.timeoutMs,
        bodyTimeout: config.timeoutMs,
        headers: {
          // undici handles Content-Type for FormData automatically
        },
      });

      if (response.statusCode !== 200) {
        const errorBody = await response.body.json().catch(() => ({}));
        this.logger.error(`STT Gateway returned error ${response.statusCode}: ${JSON.stringify(errorBody)}`);
        throw new InternalServerErrorException('Failed to transcribe audio via gateway');
      }

      const result = await response.body.json() as { text: string };
      this.logger.log(`Transcription successful for ${filename}`);
      
      return {
        text: result.text,
      };
    } catch (error) {
      this.logger.error('Failed to transcribe audio stream:', error);
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Transcription service error');
    }
  }
}
