import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LlmPromptTemplatesController } from '../../../../src/modules/llm-prompt-templates/llm-prompt-templates.controller.js';
import { LlmPromptTemplatesService } from '../../../../src/modules/llm-prompt-templates/llm-prompt-templates.service.js';
import { PrismaService } from '../../../../src/modules/prisma/prisma.service.js';
import type { CreateLlmPromptTemplateDto } from '../../../../src/modules/llm-prompt-templates/dto/create-llm-prompt-template.dto.js';
import type { UpdateLlmPromptTemplateDto } from '../../../../src/modules/llm-prompt-templates/dto/update-llm-prompt-template.dto.js';
import type { ReorderLlmPromptTemplatesDto } from '../../../../src/modules/llm-prompt-templates/dto/reorder-llm-prompt-templates.dto.js';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('LlmPromptTemplatesController', () => {
  let controller: LlmPromptTemplatesController;
  let _service: LlmPromptTemplatesService;

  const mockService = {
    create: jest.fn() as any,
    findAllByUser: jest.fn() as any,
    findAllByProject: jest.fn() as any,
    findOne: jest.fn() as any,
    update: jest.fn() as any,
    remove: jest.fn() as any,
    reorder: jest.fn() as any,
    getSystemTemplates: jest.fn() as any,
    hideSystemTemplate: jest.fn() as any,
    unhideSystemTemplate: jest.fn() as any,
    hideTemplate: jest.fn() as any,
    unhideTemplate: jest.fn() as any,
    getAvailableTemplatesForUser: jest.fn() as any,
    getCopyTargetProjects: jest.fn() as any,
  };

  const mockPrismaService = {};

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
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<LlmPromptTemplatesController>(LlmPromptTemplatesController);
    _service = module.get<LlmPromptTemplatesService>(LlmPromptTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystem', () => {
    it('should return system templates', async () => {
      const templates = [{ id: 'sys-1', name: 'System Template', isSystem: true }];
      mockService.getSystemTemplates.mockResolvedValue(templates);

      const result = await controller.getSystem('false', mockRequest);

      expect(mockService.getSystemTemplates).toHaveBeenCalledWith('user-1', false);
      expect(result).toEqual(templates);
    });

    it('should pass includeHidden=true when query param is "true"', async () => {
      mockService.getSystemTemplates.mockResolvedValue([]);

      await controller.getSystem('true', mockRequest);

      expect(mockService.getSystemTemplates).toHaveBeenCalledWith('user-1', true);
    });
  });

  describe('hideSystem', () => {
    it('should hide a system template', async () => {
      mockService.hideSystemTemplate.mockResolvedValue({ success: true });

      const result = await controller.hideSystem('sys-1', mockRequest);

      expect(mockService.hideSystemTemplate).toHaveBeenCalledWith('user-1', 'sys-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unhideSystem', () => {
    it('should unhide a system template', async () => {
      mockService.unhideSystemTemplate.mockResolvedValue({ success: true });

      const result = await controller.unhideSystem('sys-1', mockRequest);

      expect(mockService.unhideSystemTemplate).toHaveBeenCalledWith('user-1', 'sys-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getCopyTargets', () => {
    it('should return copy target projects', async () => {
      const projects = [{ id: 'p-1', name: 'Project 1' }];
      mockService.getCopyTargetProjects.mockResolvedValue(projects);

      const result = await controller.getCopyTargets(mockRequest);

      expect(mockService.getCopyTargetProjects).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(projects);
    });
  });

  describe('create', () => {
    it('should create a template', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        name: 'Test Template',
        prompt: 'Test prompt',
      };

      const created = {
        id: 'template-1',
        userId: dto.userId,
        name: dto.name,
        prompt: dto.prompt,
        order: 0,
      };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it('should create a template without a name', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        prompt: 'No name prompt',
      };

      const created = {
        id: 'template-none',
        userId: dto.userId,
        prompt: dto.prompt,
        order: 0,
      };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
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

      const result = await controller.findAllByUser('user-1', 'false', mockRequest);

      expect(mockService.findAllByUser).toHaveBeenCalledWith('user-1', false);
      expect(result).toEqual(templates);
    });

    it('should throw ForbiddenException when user requests other user templates', () => {
      expect(() => controller.findAllByUser('other-user', 'false', mockRequest)).toThrow(
        ForbiddenException,
      );

      expect(mockService.findAllByUser).not.toHaveBeenCalled();
    });
  });

  describe('findAllByProject', () => {
    it('should return project templates', async () => {
      const templates = [
        { id: '1', name: 'Template 1' },
        { id: '2', name: 'Template 2' },
      ];

      mockService.findAllByProject.mockResolvedValue(templates);

      const result = await controller.findAllByProject('project-1', 'false', mockRequest);

      expect(mockService.findAllByProject).toHaveBeenCalledWith('project-1', 'user-1', false);
      expect(result).toEqual(templates);
    });
  });

  describe('findOne', () => {
    it('should return a single template', async () => {
      const template = { id: 'template-1', name: 'Test' };

      mockService.findOne.mockResolvedValue(template);

      const result = await controller.findOne('template-1');

      expect(mockService.findOne).toHaveBeenCalledWith('template-1');
      expect(result).toEqual(template);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      const dto: UpdateLlmPromptTemplateDto = {
        name: 'Updated Name',
      };

      const updated = { id: 'template-1', name: dto.name };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('template-1', dto);

      expect(mockService.update).toHaveBeenCalledWith('template-1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should delete a template', async () => {
      const deleted = { id: 'template-1' };
      mockService.remove.mockResolvedValue(deleted);

      const result = await controller.remove('template-1');

      expect(mockService.remove).toHaveBeenCalledWith('template-1');
      expect(result).toEqual(deleted);
    });
  });

  describe('hide', () => {
    it('should hide a custom template', async () => {
      mockService.hideTemplate.mockResolvedValue({ id: 'template-1', isHidden: true });

      const result = await controller.hide('template-1');

      expect(mockService.hideTemplate).toHaveBeenCalledWith('template-1');
      expect(result.isHidden).toBe(true);
    });
  });

  describe('unhide', () => {
    it('should unhide a custom template', async () => {
      mockService.unhideTemplate.mockResolvedValue({ id: 'template-1', isHidden: false });

      const result = await controller.unhide('template-1');

      expect(mockService.unhideTemplate).toHaveBeenCalledWith('template-1');
      expect(result.isHidden).toBe(false);
    });
  });

  describe('reorder', () => {
    it('should reorder templates', async () => {
      const dto: ReorderLlmPromptTemplatesDto = {
        ids: ['template-1', 'template-2', 'template-3'],
      };

      mockService.reorder.mockResolvedValue({ success: true });

      const result = await controller.reorder(dto, mockRequest);

      expect(mockService.reorder).toHaveBeenCalledWith({
        ids: dto.ids,
        userId: 'user-1',
        projectId: undefined,
      });
      expect(result).toEqual({ success: true });
    });
  });
});
