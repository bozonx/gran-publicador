import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { SttConfig } from '../../config/stt.config.js';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly tempDir = join(tmpdir(), 'gran-publicador-audio');

  constructor(private readonly configService: ConfigService) {}

  /**
   * Transcribes audio file to text.
   * Currently saves the file locally and returns a stub response.
   * TODO: Integrate with real STT microservice.
   */
  async transcribeAudio(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<{ text: string }> {
    try {
      this.logger.log(`Received audio file: ${file.originalname} (${file.mimetype}), size: ${file.buffer.length} bytes`);

      // Ensure temp directory exists
      await mkdir(this.tempDir, { recursive: true });

      // Save file temporarily with unique name
      const filename = `audio-${Date.now()}${file.originalname.substring(file.originalname.lastIndexOf('.')) || '.webm'}`;
      const filepath = join(this.tempDir, filename);

      await writeFile(filepath, file.buffer);
      this.logger.log(`Audio file saved to: ${filepath}`);

      // STT Logic would go here
      const config = this.configService.get<SttConfig>('stt');
      this.logger.debug(`STT config: ${JSON.stringify(config)}`);

      // For now, return stub response
      return {
        text: 'This is a stub transcription response. The audio file has been saved successfully in the SttModule.',
      };
    } catch (error) {
      this.logger.error('Failed to transcribe audio:', error);
      throw error;
    }
  }
}
