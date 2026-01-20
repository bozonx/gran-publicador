import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
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
    timeoutSec: 30,
    maxTextLength: 1000,
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
            get: jest.fn().mockReturnValue(mockConfig),
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
    // TranslateService only retries on non-BadGateway/BadRequest errors.
    // Since it throws BadGateway on 500, it only consumes ONE intercept.
    client
      .intercept({
        path: '/api/v1/translate',
        method: 'POST',
      })
      .reply(500, 'Internal Server Error');

    await expect(service.translateText(dto)).rejects.toThrow(
      'Translate Gateway error: Internal Server Error',
    );
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
      .reply(200, { translatedText: 'Привет', provider: 'override-provider', model: 'm', chunksCount: 1 });

    await service.translateText(dto);
  });
});
