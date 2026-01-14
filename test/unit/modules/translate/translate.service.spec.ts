import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { TranslateService } from '../../../../src/modules/translate/translate.service.js';
import { TranslateTextDto } from '../../../../src/modules/translate/dto/translate-text.dto.js';

describe('TranslateService', () => {
  let service: TranslateService;
  let configService: ConfigService;

  const mockConfig = {
    serviceUrl: 'http://test-service/api/v1',
    defaultProvider: 'test-provider',
    timeoutSec: 30,
    maxTextLength: 1000,
    retryMaxAttempts: 3,
    retryInitialDelayMs: 1000,
    retryMaxDelayMs: 5000,
  };

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
    configService = module.get<ConfigService>(ConfigService);

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
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
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await service.translateText(dto);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/translate'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"text":"Hello"'),
      }),
    );
  });

  it('should throw error when translation fails', async () => {
    const dto: TranslateTextDto = {
      text: 'Hello',
      targetLang: 'ru-RU',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(service.translateText(dto)).rejects.toThrow('Translate Gateway returned 500: Internal Server Error');
  });

  it('should override defaults with DTO values', async () => {
    const dto: TranslateTextDto = {
      text: 'Hello',
      targetLang: 'ru-RU',
      provider: 'override-provider',
      maxChunkLength: 500,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Привет' }),
    });

    await service.translateText(dto);

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.provider).toBe('override-provider');
    expect(callBody.maxChunkLength).toBe(500);
    expect(callBody.timeoutSec).toBe(mockConfig.timeoutSec);
  });
});
