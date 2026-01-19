import { Controller, Post, UseGuards, BadRequestException, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SttService } from './stt.service.js';
import type { FastifyRequest } from 'fastify';

@Controller('stt')
@UseGuards(JwtAuthGuard)
export class SttController {
  private readonly logger = new Logger(SttController.name);

  constructor(private readonly sttService: SttService) {}

  @Post('transcribe')
  public async transcribe(@Req() req: FastifyRequest) {
    // 1. Check if multipart (typical file upload)
    if (req.isMultipart?.()) {
      const part = await req.file();
      if (!part) {
        throw new BadRequestException('No audio file uploaded');
      }

      this.logger.log(`Received multipart transcription request: ${part.filename}`);

      return this.sttService.transcribeAudioStream(
        part.file,
        part.filename,
        part.mimetype,
      );
    }

    // 2. Check if raw stream (e.g. from browser Fetch API with duplex: 'half')
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('audio/')) {
      this.logger.log(`Received raw audio stream: ${contentType}`);
      
      const filename = `recording-${Date.now()}.${contentType.split('/')[1]?.split(';')[0] || 'webm'}`;
      
      return this.sttService.transcribeAudioStream(
        req.raw,
        filename,
        contentType,
      );
    }

    throw new BadRequestException('Request must be multipart/form-data or audio/* raw stream');
  }
}
