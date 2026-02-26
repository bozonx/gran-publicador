import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { LlmPromptTemplatesService } from '../../../../src/modules/llm-prompt-templates/llm-prompt-templates.service.js';
import { PrismaService } from '../../../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../../../src/common/services/permissions.service.js';
import type { CreateLlmPromptTemplateDto } from '../../../../src/modules/llm-prompt-templates/dto/create-llm-prompt-template.dto.js';
import type { UpdateLlmPromptTemplateDto } from '../../../../src/modules/llm-prompt-templates/dto/update-llm-prompt-template.dto.js';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { VALIDATION_LIMITS } from '../../../../src/common/constants/validation.constants.js';

describe('LlmPromptTemplatesService', () => {
  let service: LlmPromptTemplatesService;

  const mockPrismaService = {
    llmPromptTemplate: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      aggregate: jest.fn() as any,
    },
    llmSystemPromptHidden: {
      findMany: jest.fn() as any,
      upsert: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    project: {
      findMany: jest.fn() as any,
    },
    user: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
    },
    $transaction: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
  };

  beforeEach(async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({ preferences: {} });
    mockPrismaService.user.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmPromptTemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = module.get<LlmPromptTemplatesService>(LlmPromptTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemTemplates', () => {
    it('should return system templates with hidden state', async () => {
      const result = await service.getSystemTemplates('user-1', true);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].isSystem).toBe(true);
    });

    it('should filter out hidden templates when includeHidden is false', async () => {
      const allBefore = await service.getSystemTemplates('user-1', true);
      const hiddenId = allBefore[0]?.id;
      if (!hiddenId) return;

      mockPrismaService.user.findUnique.mockResolvedValue({
        preferences: {
          llmPromptTemplates: {
            hiddenSystemTemplateIds: [hiddenId],
          },
        },
      });

      const allTemplates = await service.getSystemTemplates('user-1', true);
      expect(allTemplates.some(t => t.isHidden)).toBe(true);

      const visibleTemplates = await service.getSystemTemplates('user-1', false);
      expect(visibleTemplates.every(t => !t.isHidden)).toBe(true);
      expect(visibleTemplates).toHaveLength(allTemplates.length - 1);
    });
  });

  describe('hideSystemTemplate', () => {
    it('should hide a system template for the user', async () => {
      const allTemplates = await service.getSystemTemplates('user-1', true);
      const firstId = allTemplates[0]?.id;
      if (!firstId) return;

      const result = await service.hideSystemTemplate('user-1', firstId);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown system template', async () => {
      await expect(service.hideSystemTemplate('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unhideSystemTemplate', () => {
    it('should unhide a system template for the user', async () => {
      const allTemplates = await service.getSystemTemplates('user-1', true);
      const firstId = allTemplates[0]?.id;
      if (!firstId) return;

      mockPrismaService.user.findUnique.mockResolvedValue({
        preferences: {
          llmPromptTemplates: {
            hiddenSystemTemplateIds: [firstId],
          },
        },
      });

      const result = await service.unhideSystemTemplate('user-1', firstId);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown system template', async () => {
      await expect(service.unhideSystemTemplate('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a user template with auto-calculated order', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        name: 'Test Template',
        prompt: 'Test prompt',
      };

      mockPrismaService.llmPromptTemplate.aggregate.mockResolvedValue({
        _max: { order: 2 },
      });

      mockPrismaService.llmPromptTemplate.create.mockResolvedValue({
        id: 'template-1',
        userId: dto.userId,
        name: dto.name,
        prompt: dto.prompt,
        category: 'General',
        order: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(dto);

      expect(mockPrismaService.llmPromptTemplate.aggregate).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        _max: { order: true },
      });

      expect(result.order).toBe(3);
    });

    it('should create a project template', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        projectId: 'project-1',
        name: 'Project Template',
        prompt: 'Project prompt',
      };

      mockPrismaService.llmPromptTemplate.aggregate.mockResolvedValue({
        _max: { order: null },
      });

      mockPrismaService.llmPromptTemplate.create.mockResolvedValue({
        id: 'template-1',
        projectId: dto.projectId,
        name: dto.name,
        prompt: dto.prompt,
        category: 'General',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(dto);

      expect(result.order).toBe(0);
    });

    it('should create a template without a name', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        prompt: 'No name prompt',
      };

      mockPrismaService.llmPromptTemplate.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });

      mockPrismaService.llmPromptTemplate.create.mockResolvedValue({
        id: 'template-none',
        userId: dto.userId,
        prompt: dto.prompt,
        order: 1,
      });

      const result = await service.create(dto);

      expect(result.name).toBeUndefined();
      expect(result.prompt).toBe('No name prompt');
    });

    it('should throw error when both userId and projectId are provided', async () => {
      const dto: any = {
        userId: 'user-1',
        projectId: 'project-1',
        name: 'Test',
        prompt: 'Test',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when neither userId nor projectId is provided', async () => {
      const dto: any = {
        name: 'Test',
        prompt: 'Test',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when prompt is too long', async () => {
      const dto: CreateLlmPromptTemplateDto = {
        userId: 'user-1',
        name: 'Test',
        prompt: 'a'.repeat(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_PROMPT_LENGTH + 1),
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(/too long/);
    });
  });

  describe('findAllByUser', () => {
    it('should return visible user templates ordered by order field', async () => {
      const templates = [
        { id: '1', name: 'Template 1', order: 0, isHidden: false },
        { id: '2', name: 'Template 2', order: 1, isHidden: false },
      ];

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);

      const result = await service.findAllByUser('user-1');

      expect(mockPrismaService.llmPromptTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isHidden: false },
        orderBy: { order: 'asc' },
      });

      expect(result).toEqual(templates);
    });

    it('should include hidden templates when includeHidden is true', async () => {
      const templates = [
        { id: '1', name: 'Template 1', order: 0, isHidden: false },
        { id: '2', name: 'Hidden Template', order: 1, isHidden: true },
      ];

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);

      const result = await service.findAllByUser('user-1', true);

      expect(mockPrismaService.llmPromptTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { order: 'asc' },
      });

      expect(result).toEqual(templates);
    });
  });

  describe('findAllByProject', () => {
    it('should return visible project templates ordered by order field', async () => {
      const templates = [
        { id: '1', name: 'Template 1', order: 0, isHidden: false },
        { id: '2', name: 'Template 2', order: 1, isHidden: false },
      ];

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

      const result = await service.findAllByProject('project-1', 'user-1');

      expect(mockPrismaService.llmPromptTemplate.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', isHidden: false },
        orderBy: { order: 'asc' },
      });

      expect(result).toEqual(templates);
    });
  });

  describe('findOne', () => {
    it('should return a template by id', async () => {
      const template = { id: 'template-1', name: 'Test' };

      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(template);

      const result = await service.findOne('template-1');

      expect(result).toEqual(template);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      const updateDto: UpdateLlmPromptTemplateDto = {
        name: 'Updated Name',
        prompt: 'Updated prompt',
      };

      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        name: 'Old Name',
      });

      mockPrismaService.llmPromptTemplate.update.mockResolvedValue({
        id: 'template-1',
        name: updateDto.name,
        prompt: updateDto.prompt,
      });

      const result = await service.update('template-1', updateDto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw error when updating with too long prompt', async () => {
      const updateDto: UpdateLlmPromptTemplateDto = {
        prompt: 'a'.repeat(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_PROMPT_LENGTH + 1),
      };

      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
      });

      await expect(service.update('template-1', updateDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a template', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
      });

      mockPrismaService.llmPromptTemplate.delete.mockResolvedValue({
        id: 'template-1',
      });

      const result = await service.remove('template-1');

      expect(mockPrismaService.llmPromptTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });

      expect(result.id).toBe('template-1');
    });
  });

  describe('hideTemplate', () => {
    it('should set isHidden to true on a custom template', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        isHidden: false,
      });

      mockPrismaService.llmPromptTemplate.update.mockResolvedValue({
        id: 'template-1',
        isHidden: true,
      });

      const result = await service.hideTemplate('template-1');

      expect(mockPrismaService.llmPromptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { isHidden: true },
      });

      expect(result.isHidden).toBe(true);
    });
  });

  describe('unhideTemplate', () => {
    it('should set isHidden to false on a custom template', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        isHidden: true,
      });

      mockPrismaService.llmPromptTemplate.update.mockResolvedValue({
        id: 'template-1',
        isHidden: false,
      });

      const result = await service.unhideTemplate('template-1');

      expect(mockPrismaService.llmPromptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { isHidden: false },
      });

      expect(result.isHidden).toBe(false);
    });
  });

  describe('reorder', () => {
    it('should reorder user templates', async () => {
      const ids = ['template-1', 'template-2', 'template-3'];
      const userId = 'user-1';

      const templates = ids.map((id, index) => ({
        id,
        userId,
        projectId: null,
        name: `Template ${String(index)}`,
        order: index,
      }));

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);
      mockPrismaService.$transaction.mockResolvedValue([]);

      const result = await service.reorder({ ids, userId });

      expect(result.success).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should reorder project templates for project member', async () => {
      const ids = ['template-1', 'template-2'];
      const userId = 'user-1';
      const projectId = 'project-1';

      const templates = ids.map((id, index) => ({
        id,
        userId: null,
        projectId,
        name: `Template ${String(index)}`,
        order: index,
        project: {
          ownerId: 'other-user',
          members: [{ userId }],
        },
      }));

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);
      mockPrismaService.$transaction.mockResolvedValue([]);

      const result = await service.reorder({ ids, userId, projectId });

      expect(result.success).toBe(true);
    });

    it('should throw error when templates not found', async () => {
      const ids = ['template-1', 'template-2'];
      const userId = 'user-1';

      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue([
        { id: 'template-1', userId },
      ]);

      await expect(service.reorder({ ids, userId })).rejects.toThrow(NotFoundException);
    });

    it('should throw error when templates belong to different scopes', async () => {
      const ids = ['template-1', 'template-2'];
      const userId = 'user-1';

      // Current implementation queries by scope (userId when projectId is not provided),
      // so templates from a different scope should not be returned by Prisma.
      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue([
        { id: 'template-1', userId, projectId: null },
      ]);

      await expect(service.reorder({ ids, userId })).rejects.toThrow(NotFoundException);
    });

    it('should throw error when user does not own templates', async () => {
      const ids = ['template-1', 'template-2'];
      const userId = 'user-1';

      // Current implementation queries by userId, so templates owned by another user
      // should not be returned by Prisma.
      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue([]);

      await expect(service.reorder({ ids, userId })).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyOwnership', () => {
    it('should return true for user template owner', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: 'user-1',
        projectId: null,
      });

      const result = await service.verifyOwnership('template-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true for project member', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: null,
        projectId: 'project-1',
        project: {
          ownerId: 'other-user',
          members: [{ userId: 'user-1' }],
        },
      });

      const result = await service.verifyOwnership('template-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when template not found', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(null);

      const result = await service.verifyOwnership('template-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when user does not have access', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: 'other-user',
        projectId: null,
      });

      const result = await service.verifyOwnership('template-1', 'user-1');

      expect(result).toBe(false);
    });
  });
});
