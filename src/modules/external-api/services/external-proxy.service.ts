import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttService } from '../../stt/stt.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { Readable } from 'stream';

@Injectable()
export class ExternalProxyService {
  private readonly logger = new Logger(ExternalProxyService.name);

  constructor(
    private readonly sttService: SttService,
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  async transcribe(params: {
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
    includeWords?: boolean;
  }) {
    return this.sttService.transcribeAudioStream(params);
  }

  async transcribeStream(params: {
    stream: Readable;
    filename?: string;
    mimetype: string;
    language?: string;
    provider?: string;
    restorePunctuation?: boolean;
    formatText?: boolean;
    models?: string[];
    apiKey?: string;
    maxWaitMinutes?: number;
    contentLength?: number;
    includeWords?: boolean;
  }) {
    return this.sttService.transcribeAudioStream({
      file: params.stream,
      filename: params.filename,
      mimetype: params.mimetype,
      language: params.language,
      provider: params.provider,
      restorePunctuation: params.restorePunctuation,
      formatText: params.formatText,
      models: params.models,
      apiKey: params.apiKey,
      maxWaitMinutes: params.maxWaitMinutes,
      contentLength: params.contentLength,
      includeWords: params.includeWords,
    });
  }

  async chat(messages: Array<{ role: string; content: string }>, options?: any) {
    return this.llmService.generateChat(messages, options);
  }
}
