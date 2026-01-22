import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LlmPromptTemplatesController } from './llm-prompt-templates.controller.js';
import { LlmPromptTemplatesService } from './llm-prompt-templates.service.js';
import type { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import type { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';
import type { ReorderLlmPromptTemplatesDto } from './dto/reorder-llm-prompt-templates.dto.js';

describe('LlmPromptTemplatesController', () => {
  let controller: LlmPromptTemplatesController;
  let service: LlmPromptTemplatesService;

  const mockService = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findAllByProject: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-1',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LlmPromptTemplatesController],
      providers: [
        {
          provide: LlmPromptTemplatesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LlmPromptTemplatesController>(LlmPromptTemplatesController);
    service = module.get<LlmPromptTemplatesService>(LlmPromptTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a template', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        name: 'Test Template',
        prompt: 'Test prompt',
      };

      const created = { id: 'template-1', ...dto, order: 0 };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  describe('findAllByUser', () => {
    it('should return user templates when user requests their own', async () => {
      const templates = [
        { id: '1', name: 'Template 1' },
        { id: '2', name: 'Template 2' },
      ];

      mockService.findAllByUser.mockResolvedValue(templates);

      const result = await controller.findAllByUser('user-1', mockRequest);

      expect(service.findAllByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(templates);
    });

    it('should throw ForbiddenException when user requests other user templates', async () => {
      await expect(controller.findAllByUser('other-user', mockRequest)).rejects.toThrow(
        ForbiddenException,
      );

      expect(service.findAllByUser).not.toHaveBeenCalled();
    });
  });

  describe('findAllByProject', () => {
    it('should return project templates', async () => {
      const templates = [
        { id: '1', name: 'Template 1' },
        { id: '2', name: 'Template 2' },
      ];

      mockService.findAllByProject.mockResolvedValue(templates);

      const result = await controller.findAllByProject('project-1', mockRequest);

      expect(service.findAllByProject).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(templates);
    });
  });

  describe('findOne', () => {
    it('should return a single template', async () => {
      const template = { id: 'template-1', name: 'Test' };

      mockService.findOne.mockResolvedValue(template);

      const result = await controller.findOne('template-1');

      expect(service.findOne).toHaveBeenCalledWith('template-1');
      expect(result).toEqual(template);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      const dto: UpdateLlmPromptTemplateDto = {
        name: 'Updated Name',
      };

      const updated = { id: 'template-1', ...dto };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('template-1', dto);

      expect(service.update).toHaveBeenCalledWith('template-1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should delete a template', async () => {
      const deleted = { id: 'template-1' };
      mockService.remove.mockResolvedValue(deleted);

      const result = await controller.remove('template-1');

      expect(service.remove).toHaveBeenCalledWith('template-1');
      expect(result).toEqual(deleted);
    });
  });

  describe('reorder', () => {
    it('should reorder templates', async () => {
      const dto: ReorderLlmPromptTemplatesDto = {
        ids: ['template-1', 'template-2', 'template-3'],
      };

      mockService.reorder.mockResolvedValue({ success: true });

      const result = await controller.reorder(dto, mockRequest);

      expect(service.reorder).toHaveBeenCalledWith(dto.ids, 'user-1');
      expect(result).toEqual({ success: true });
    });
  });
});
