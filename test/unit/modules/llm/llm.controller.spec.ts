import { Test, type TestingModule } from '@nestjs/testing';
import { LlmController } from '../../../../src/modules/llm/llm.controller.js';
import { LlmService } from '../../../../src/modules/llm/llm.service.js';
import type { GenerateContentDto } from '../../../../src/modules/llm/dto/generate-content.dto.js';
import { jest } from '@jest/globals';

describe('LlmController', () => {
  let controller: LlmController;
  let _service: LlmService;

  const mockLlmService = {
    generateContent: jest.fn() as any,
    extractContent: jest.fn() as any,
    extractParameters: jest.fn() as any,
    generatePublicationFields: jest.fn() as any,
    parsePublicationFieldsResponse: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LlmController],
      providers: [
        {
          provide: LlmService,
          useValue: mockLlmService,
        },
      ],
    }).compile();

    controller = module.get<LlmController>(LlmController);
    _service = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should call service and return formatted response', async () => {
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

      mockLlmService.generateContent.mockResolvedValue(mockResponse);
      mockLlmService.extractContent.mockReturnValue('Generated content');

      const result = await controller.generate(dto);

      expect(mockLlmService.generateContent).toHaveBeenCalledWith(dto);
      expect(mockLlmService.extractContent).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual({
        content: 'Generated content',
        metadata: mockResponse._router,
        usage: mockResponse.usage,
      });
    });

    it('should handle service errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test prompt',
        temperature: 0.7,
        max_tokens: 2000,
      };

      mockLlmService.generateContent.mockRejectedValue(new Error('Service error'));

      await expect(controller.generate(dto)).rejects.toThrow('Service error');
    });
  });

  describe('generatePublicationFields', () => {
    it('should call service and return parsed publication fields with metadata', async () => {
      const dto = {
        prompt: 'Source text',
        publicationLanguage: 'ru-RU',
        channels: [
          { channelId: 'ch-1', channelName: 'EN Channel', language: 'en-US', tags: ['tech'] },
        ],
      } as any;

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          { index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        _router: { provider: 'openai', model_name: 'gpt-4', attempts: 1, fallback_used: false },
      };

      const mockParsed = {
        publication: { title: 'Title', description: 'Desc', content: 'Content', tags: ['tag1'] },
        posts: [{ channelId: 'ch-1', content: 'EN Content', tags: ['tech'] }],
      };

      mockLlmService.generatePublicationFields.mockResolvedValue(mockResponse);
      mockLlmService.parsePublicationFieldsResponse.mockReturnValue(mockParsed);

      const result = await controller.generatePublicationFields(dto);

      expect(mockLlmService.generatePublicationFields).toHaveBeenCalledWith(dto);
      expect(mockLlmService.parsePublicationFieldsResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual({
        publication: mockParsed.publication,
        posts: mockParsed.posts,
        metadata: mockResponse._router,
        usage: mockResponse.usage,
      });
    });

    it('should handle service errors', async () => {
      const dto = {
        prompt: 'Source text',
        publicationLanguage: 'en-US',
        channels: [],
      } as any;

      mockLlmService.generatePublicationFields.mockRejectedValue(new Error('LLM error'));

      await expect(controller.generatePublicationFields(dto)).rejects.toThrow('LLM error');
    });
  });
});
