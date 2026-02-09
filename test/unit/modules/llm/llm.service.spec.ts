import { Test, type TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../../../src/modules/llm/llm.service.js';
import type { GenerateContentDto } from '../../../../src/modules/llm/dto/generate-content.dto.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('LlmService', () => {
  let service: LlmService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockConfig = {
    serviceUrl: 'http://localhost:8080/api/v1',
    defaultTags: ['test'],
    defaultType: 'fast',
    maxModelSwitches: 3,
    timeoutSecs: 60,
  };

  const mockAppConfig = {
    microserviceRequestTimeoutSeconds: 30,
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
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'llm') return mockConfig;
              if (key === 'app.microserviceRequestTimeoutSeconds') {
                return mockAppConfig.microserviceRequestTimeoutSeconds;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  describe('generateContent', () => {
    it('should successfully generate content with simple prompt', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test prompt',
        temperature: 0.7,
        max_tokens: 2000,
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Generated content',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(200, mockResponse);

      const result = await service.generateContent(dto);

      expect(result).toEqual(mockResponse);
    });

    it('should handle 4xx client errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(400, 'Bad request');

      await expect(service.generateContent(dto)).rejects.toThrow('LLM Router returned 400');
    });
  });

  describe('extractContent', () => {
    it('should extract content from response', () => {
      const response: any = {
        choices: [{ message: { content: 'Test content' } }],
      };
      expect(service.extractContent(response)).toBe('Test content');
    });
  });
});
