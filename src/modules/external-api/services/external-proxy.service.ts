import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttService } from '../../stt/stt.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { Readable } from 'stream';
import { request } from 'undici';
import { SttConfig } from '../../../config/stt.config.js';

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
    const sttConfig = this.configService.get<SttConfig>('stt');
    const tmpFilesBaseUrl = sttConfig?.tmpFilesBaseUrl;

    if (tmpFilesBaseUrl) {
      this.logger.debug(`Uploading audio stream to tmp-files: ${params.filename}`);
      
      const uploadHeaders: Record<string, string> = {
        'Content-Type': params.mimetype,
        'X-File-Name': params.filename || 'upload',
        'X-Ttl-Mins': String(sttConfig.tmpFilesDefaultTtlMins || 30),
      };

      if (params.contentLength) {
        uploadHeaders['Content-Length'] = String(params.contentLength);
      }

      const uploadResponse = await request(`${tmpFilesBaseUrl}/files`, {
        method: 'POST',
        headers: uploadHeaders,
        body: params.stream,
      });

      if (uploadResponse.statusCode !== 200 && uploadResponse.statusCode !== 201) {
        const errorBody = await uploadResponse.body.json().catch(() => ({}));
        this.logger.error(`Failed to upload to tmp-files: ${JSON.stringify(errorBody)}`);
        throw new Error(`Failed to upload audio to temporary storage: ${uploadResponse.statusCode}`);
      }

      const { url } = (await uploadResponse.body.json()) as { url: string };
      this.logger.debug(`Audio uploaded to tmp-files, URL: ${url}`);

      return this.sttService.transcribeAudioUrl({
        url,
        language: params.language,
        provider: params.provider,
        restorePunctuation: params.restorePunctuation,
        formatText: params.formatText,
        models: params.models,
        apiKey: params.apiKey,
        maxWaitMinutes: params.maxWaitMinutes,
        includeWords: params.includeWords,
      });
    }

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
