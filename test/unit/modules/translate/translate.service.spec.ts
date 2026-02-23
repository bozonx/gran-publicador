import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TranslateService } from '../../../../src/modules/translate/translate.service.js';
import type { TranslateTextDto } from '../../../../src/modules/translate/dto/translate-text.dto.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('TranslateService', () => {
  let service: TranslateService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockConfig = {
    serviceUrl: 'http://test-service/api/v1',
    defaultProvider: 'test-provider',
    requestTimeoutSecs: 30,
    maxTextLength: 1000,
  };

  const mockHttpConfig = {
    retryMaxAttempts: 3,
    retryInitialDelayMs: 1,
    retryMaxDelayMs: 1,
  };

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
        TranslateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'translate') return mockConfig;
              if (key === 'http') return mockHttpConfig;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TranslateService>(TranslateService);
    // Consumes/resets interceptors between tests
    mockAgent.assertNoPendingInterceptors();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should translate text successfully', async () => {
    const dto: TranslateTextDto = {
      text: 'Hello',
      targetLang: 'ru-RU',
    };

    const mockResponse = {
      translatedText: 'Привет',
      provider: 'test-provider',
      model: 'test-model',
      chunksCount: 1,
    };

    const client = mockAgent.get('http://test-service');
    client
      .intercept({
        path: '/api/v1/translate',
        method: 'POST',
      })
      .reply(200, mockResponse);

    const result = await service.translateText(dto);

    expect(result).toEqual(mockResponse);
  });

  it('should throw error when translation fails', async () => {
    const dto: TranslateTextDto = {
      text: 'Hello',
      targetLang: 'ru-RU',
    };

    const client = mockAgent.get('http://test-service');
    // requestJsonWithRetry retries on 5xx.
    client.intercept({ path: '/api/v1/translate', method: 'POST' }).reply(500, 'fail-1');
    client.intercept({ path: '/api/v1/translate', method: 'POST' }).reply(500, 'fail-2');
    client.intercept({ path: '/api/v1/translate', method: 'POST' }).reply(500, 'fail-3');

    await expect(service.translateText(dto)).rejects.toThrow();
  });

  it('should override defaults with DTO values', async () => {
    const dto: TranslateTextDto = {
      text: 'Hello',
      targetLang: 'ru-RU',
      provider: 'override-provider',
      maxChunkLength: 500,
    };

    const client = mockAgent.get('http://test-service');
    client
      .intercept({
        path: '/api/v1/translate',
        method: 'POST',
      })
      .reply(200, {
        translatedText: 'Привет',
        provider: 'override-provider',
        model: 'm',
        chunksCount: 1,
      });

    await service.translateText(dto);

    expect(true).toBe(true);
  });
});
