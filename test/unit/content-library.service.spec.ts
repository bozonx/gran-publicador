import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { ContentLibraryService } from '../../src/modules/content-library/content-library.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';

describe('ContentLibraryService (unit)', () => {
  let service: ContentLibraryService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    contentItem: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    contentText: {
      aggregate: jest.fn() as any,
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    contentItemMedia: {
      aggregate: jest.fn() as any,
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      delete: jest.fn() as any,
      findMany: jest.fn() as any,
      update: jest.fn() as any,
    },
    media: {
      findUnique: jest.fn() as any,
    },
    project: {
        findUnique: jest.fn() as any,
    } as any,
    $transaction: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ContentLibraryService,
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

    service = moduleRef.get<ContentLibraryService>(ContentLibraryService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw when neither texts nor media provided', async () => {
      await expect(
        service.create(
          {
            scope: 'personal',
            meta: {},
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create personal item', async () => {
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1' });

      const result = await service.create(
        {
          scope: 'personal',
          title: 't',
          texts: [{ content: 'hello' }],
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentItem.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'ci-1' });
    });

    it('should require projectId for project scope', async () => {
      await expect(
        service.create(
          {
            scope: 'project',
            texts: [{ content: 'hello' }],
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require project mutation permission for project scope', async () => {
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1' });

      await service.create(
        {
          scope: 'project',
          projectId: 'p1',
          texts: [{ content: 'hello' }],
        } as any,
        'user-1',
      );

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith('p1', 'user-1', [
        'ADMIN',
        'EDITOR',
      ]);
    });
  });

  describe('findAll', () => {
    it('should require projectId for project scope', async () => {
      await expect(service.findAll({ scope: 'project' } as any, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call permissions check for project scope', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll({ scope: 'project', projectId: 'p1' } as any, 'user-1');

      expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith('p1', 'user-1', true);
    });

    it('should apply archivedOnly filter', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll(
        { scope: 'project', projectId: 'p1', archivedOnly: true, includeArchived: true } as any,
        'user-1',
      );

      expect(mockPrismaService.contentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ archivedAt: { not: null } }) }),
      );
    });
  });

  describe('findOne', () => {
    it('should forbid access to other user personal item', async () => {
      mockPrismaService.contentItem.findUnique
        .mockResolvedValueOnce({ id: 'ci-1', userId: 'other', projectId: null, archivedAt: null });

      await expect(service.findOne('ci-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archive/restore/purge', () => {
    it('should archive with mutation permission', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue({
        id: 'ci-1',
        userId: 'user-1',
        projectId: 'p1',
        archivedAt: null,
      });
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.contentItem.update.mockResolvedValue({ id: 'ci-1' });

      await service.archive('ci-1', 'user-1');

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith('p1', 'user-1', [
        'ADMIN',
        'EDITOR',
      ]);
      expect(mockPrismaService.contentItem.update).toHaveBeenCalled();
    });

    it('should restore with mutation permission', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue({
        id: 'ci-1',
        userId: 'user-1',
        projectId: 'p1',
        archivedAt: new Date(),
      });
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.contentItem.update.mockResolvedValue({ id: 'ci-1' });

      await service.restore('ci-1', 'user-1');

      expect(mockPrismaService.contentItem.update).toHaveBeenCalled();
    });

    it('should purge archived by project only for owner', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      mockPrismaService.contentItem.deleteMany.mockResolvedValue({ count: 2 });

      const res = await service.purgeArchivedByProject('p1', 'user-1');
      expect(res).toEqual({ deletedCount: 2 });
    });
  });
});
