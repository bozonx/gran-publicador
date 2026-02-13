import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

import { ProjectTemplatesService } from '../../src/modules/project-templates/project-templates.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { PermissionKey } from '../../src/common/types/permissions.types.js';

describe('ProjectTemplatesService (unit)', () => {
  let service: ProjectTemplatesService;
  let moduleRef: TestingModule;

  const mockTx: any = {
    projectTemplate: {
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
    it('should create a project template', async () => {
      mockTx.projectTemplate.create.mockResolvedValue({
        id: 'tpl-1',
        projectId: 'project-1',
        name: 'Template',
        language: 'ru-RU',
        postType: 'POST',
        order: 1,
        template: [],
      });

      await service.create('project-1', 'user-1', {
        name: 'Template',
        language: 'ru-RU',
        postType: 'POST' as any,
        template: [],
      } as any);

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        PermissionKey.PROJECT_UPDATE,
      );

      expect(mockTx.projectTemplate.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a project template', async () => {
      const existing = {
        id: 'tpl-1',
        projectId: 'project-1',
        name: 'Existing',
        language: 'ru-RU',
        postType: 'POST',
        order: 0,
        template: [],
      };

      mockPrismaService.projectTemplate.findFirst.mockResolvedValue(existing);
      mockTx.projectTemplate.update.mockResolvedValue({ ...existing, name: 'Updated' });

      await service.update('project-1', 'tpl-1', 'user-1', {
        name: 'Updated',
      } as any);

      expect(mockTx.projectTemplate.update).toHaveBeenCalled();
    });
  });
});
