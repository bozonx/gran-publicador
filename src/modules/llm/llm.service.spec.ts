import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service.js';
import type { GenerateContentDto } from './dto/generate-content.dto.js';
import { request } from 'undici';

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('LlmService', () => {
  let service: LlmService;
  const mockRequest = request as jest.Mock;

  const mockConfig = {
    serviceUrl: 'http://localhost:8080/api/v1',
    defaultTags: ['test'],
    defaultType: 'fast',
    maxModelSwitches: 3,
    timeoutSecs: 60,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockConfig),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        _router: {
          provider: 'openai',
          model_name: 'gpt-3.5-turbo',
          attempts: 1,
          fallback_used: false,
        },
      };

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => mockResponse,
        },
      });

      const result = await service.generateContent(dto);

      expect(result).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        `${mockConfig.serviceUrl}/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should build prompt with context when provided', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Summarize this',
        temperature: 0.7,
        max_tokens: 2000,
        content: 'Main content here',
        useContent: true,
        sourceTexts: [
          { content: 'Source 1', order: 0 },
          { content: 'Source 2', order: 1 },
        ],
        selectedSourceIndexes: [0],
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Summary' },
            finish_reason: 'stop',
          },
        ],
      };

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => mockResponse,
        },
      });

      await service.generateContent(dto);

      const callArgs = mockRequest.mock.calls[0][1];
      const requestBody = JSON.parse(callArgs.body);

      // Verify that the prompt includes context
      expect(requestBody.messages[0].content).toContain('MAIN CONTENT');
      expect(requestBody.messages[0].content).toContain('Main content here');
      expect(requestBody.messages[0].content).toContain('SOURCE MATERIALS');
      expect(requestBody.messages[0].content).toContain('Source 1');
      expect(requestBody.messages[0].content).not.toContain('Source 2'); // Not selected
      expect(requestBody.messages[0].content).toContain('USER REQUEST');
      expect(requestBody.messages[0].content).toContain('Summarize this');
    });

    it('should handle 4xx client errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      mockRequest.mockResolvedValueOnce({
        statusCode: 400,
        body: {
          text: async () => 'Bad request',
        },
      });

      await expect(service.generateContent(dto)).rejects.toThrow('LLM Router returned 400');
    });

    it('should handle 5xx server errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      mockRequest.mockResolvedValueOnce({
        statusCode: 500,
        body: {
          text: async () => 'Server error',
        },
      });

      await expect(service.generateContent(dto)).rejects.toThrow('LLM Router returned 500');
    });

    it('should throw error when response has empty choices', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => ({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-3.5-turbo',
            choices: [],
          }),
        },
      });

      await expect(service.generateContent(dto)).rejects.toThrow(
        'LLM Router returned empty choices array',
      );
    });

    it('should handle timeout errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockRequest.mockRejectedValueOnce(timeoutError);

      await expect(service.generateContent(dto)).rejects.toThrow('Timeout');
    });
  });

  describe('extractContent', () => {
    it('should extract content from response', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: 'Test content',
            },
          },
        ],
      };

      const content = service.extractContent(response);
      expect(content).toBe('Test content');
    });

    it('should return empty string when no content', () => {
      const response: any = {
        choices: [],
      };

      const content = service.extractContent(response);
      expect(content).toBe('');
    });
  });
});
