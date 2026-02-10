import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { jest } from '@jest/globals';

import { ProjectTemplatesService } from '../../src/modules/project-templates/project-templates.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { PermissionKey } from '../../src/common/types/permissions.types.js';

describe('ProjectTemplatesService (unit)', () => {
  let service: ProjectTemplatesService;
  let moduleRef: TestingModule;

  const mockTx: any = {
    projectTemplate: {
      updateMany: jest.fn() as any,
      create: jest.fn() as any,
      findFirst: jest.fn() as any,
      aggregate: jest.fn() as any,
      update: jest.fn() as any,
    },
  };

  const mockPrismaService: any = {
    $transaction: jest.fn() as any,
    project: {
      findUnique: jest.fn() as any,
    },
    projectTemplate: {
      aggregate: jest.fn() as any,
      findFirst: jest.fn() as any,
    },
  };

  const mockPermissionsService: any = {
    checkPermission: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ProjectTemplatesService,
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

    service = moduleRef.get<ProjectTemplatesService>(ProjectTemplatesService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService.project.findUnique.mockResolvedValue({
      id: 'project-1',
      archivedAt: null,
    });

    mockPermissionsService.checkPermission.mockResolvedValue(undefined);

    mockPrismaService.projectTemplate.aggregate.mockResolvedValue({
      _max: { order: 0 },
    });

    mockPrismaService.$transaction.mockImplementation(async (fn: any) => {
      return await fn(mockTx);
    });
  });

  describe('create', () => {
    it('should unset defaults only in the same (language, postType) group', async () => {
      mockTx.projectTemplate.create.mockResolvedValue({
        id: 'tpl-1',
        projectId: 'project-1',
        name: 'Template',
        language: 'ru-RU',
        postType: 'POST',
        isDefault: true,
        order: 1,
        template: [],
      });

      await service.create('project-1', 'user-1', {
        name: 'Template',
        language: 'ru-RU',
        postType: 'POST' as any,
        isDefault: true,
        template: [],
      } as any);

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        PermissionKey.PROJECT_UPDATE,
      );

      expect(mockTx.projectTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          isDefault: true,
          language: 'ru-RU',
          postType: 'POST',
        },
        data: { isDefault: false },
      });
    });
  });

  describe('update', () => {
    it('should unset defaults only in the target group when setting isDefault=true', async () => {
      const existing = {
        id: 'tpl-1',
        projectId: 'project-1',
        name: 'Existing',
        language: 'ru-RU',
        postType: 'POST',
        isDefault: false,
        order: 0,
        template: [],
      };

      mockPrismaService.projectTemplate.findFirst.mockResolvedValue(existing);
      mockTx.projectTemplate.update.mockResolvedValue({ ...existing, isDefault: true });

      await service.update('project-1', 'tpl-1', 'user-1', {
        isDefault: true,
      } as any);

      expect(mockTx.projectTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          isDefault: true,
          language: 'ru-RU',
          postType: 'POST',
          id: { not: 'tpl-1' },
        },
        data: { isDefault: false },
      });
    });

    it('should enforce group uniqueness when moving a default template to a different group', async () => {
      const existing = {
        id: 'tpl-1',
        projectId: 'project-1',
        name: 'Existing',
        language: 'ru-RU',
        postType: 'POST',
        isDefault: true,
        order: 0,
        template: [],
      };

      mockPrismaService.projectTemplate.findFirst.mockResolvedValue(existing);
      mockTx.projectTemplate.update.mockResolvedValue({
        ...existing,
        language: 'en-US',
        postType: 'ARTICLE',
        isDefault: true,
      });

      await service.update('project-1', 'tpl-1', 'user-1', {
        language: 'en-US',
        postType: 'ARTICLE' as any,
      } as any);

      expect(mockTx.projectTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          isDefault: true,
          language: 'en-US',
          postType: 'ARTICLE',
          id: { not: 'tpl-1' },
        },
        data: { isDefault: false },
      });
    });
  });
});
