import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { Readable } from 'node:stream';

import { SttService } from '../../../../src/modules/stt/stt.service.js';

describe('SttService', () => {
  let service: SttService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  beforeAll(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterAll(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SttService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'stt') {
                return {
                  serviceUrl: 'http://stt-gateway/api/v1',
                  apiToken: 'test-token',
                  timeoutMs: 300000,
                  maxFileSize: 10 * 1024 * 1024,
                };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SttService>(SttService);
    mockAgent.assertNoPendingInterceptors();
  });

  it('should proxy raw stream with correct headers', async () => {
    const client = mockAgent.get('http://stt-gateway');
    client
      .intercept({
        method: 'POST',
        path: '/api/v1/transcribe/stream',
        headers: {
          'content-type': 'audio/ogg',
          authorization: 'Bearer test-token',
          'x-file-name': 'voice.ogg',
          'x-stt-provider': 'assemblyai',
          'x-stt-language': 'en',
          'x-stt-restore-punctuation': 'true',
          'x-stt-format-text': 'true',
          'x-stt-models': 'universal-3-pro,universal-2',
          'x-stt-api-key': 'provider-key',
          'x-stt-max-wait-minutes': '2',
        },
      })
      .reply(200, { text: 'ok' });

    const stream = Readable.from(Buffer.from('test'));

    const result = await service.transcribeAudioStream({
      file: stream,
      filename: 'voice.ogg',
      mimetype: 'audio/ogg',
      language: 'en',
      provider: 'assemblyai',
      restorePunctuation: true,
      formatText: true,
      models: ['universal-3-pro', 'universal-2'],
      apiKey: 'provider-key',
      maxWaitMinutes: 2,
    });

    expect(result).toEqual({ text: 'ok' });
  });
});
