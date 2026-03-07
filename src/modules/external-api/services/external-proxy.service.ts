import { Injectable, Logger } from '@nestjs/common';
import { SttService } from '../../stt/stt.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { Readable } from 'stream';

@Injectable()
export class ExternalProxyService {
  private readonly logger = new Logger(ExternalProxyService.name);

  constructor(
    private readonly sttService: SttService,
    private readonly llmService: LlmService,
  ) {}

  async transcribe(params: {
    file: Readable | Buffer;
    filename?: string;
    mimetype: string;
    language?: string;
  }) {
    return this.sttService.transcribeAudioStream(params);
  }

  async chat(messages: Array<{ role: string; content: string }>, options?: any) {
    return this.llmService.generateChat(messages, options);
  }
}
