import {
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SttService } from './stt.service.js';
import { FastifyRequest } from 'fastify';

@Controller('stt')
@UseGuards(JwtAuthGuard)
export class SttController {
  private readonly logger = new Logger(SttController.name);

  constructor(private readonly sttService: SttService) {}

  @Post('transcribe')
  async transcribe(@Req() req: FastifyRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestException('No audio file uploaded');
    }

    const buffer = await part.toBuffer();
    
    return this.sttService.transcribeAudio({
      buffer,
      originalname: part.filename,
      mimetype: part.mimetype,
    });
  }
}
