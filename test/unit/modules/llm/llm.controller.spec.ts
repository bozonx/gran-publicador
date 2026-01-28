import { Test, type TestingModule } from '@nestjs/testing';
import { LlmController } from '../../../../src/modules/llm/llm.controller.js';
import { LlmService } from '../../../../src/modules/llm/llm.service.js';
import type { GenerateContentDto } from '../../../../src/modules/llm/dto/generate-content.dto.js';
import { jest } from '@jest/globals';

describe('LlmController', () => {
  let controller: LlmController;
  let service: LlmService;

  const mockLlmService = {
    generateContent: jest.fn() as any,
    extractContent: jest.fn() as any,
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
    service = module.get<LlmService>(LlmService);
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

      expect(service.generateContent).toHaveBeenCalledWith(dto);
      expect(service.extractContent).toHaveBeenCalledWith(mockResponse);
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
});
