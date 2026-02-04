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
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    contentLibraryTab: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      aggregate: jest.fn() as any,
    },
    contentBlock: {
      aggregate: jest.fn() as any,
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    contentBlockMedia: {
      aggregate: jest.fn() as any,
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
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
    it('should create even when blocks are not provided', async () => {
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1' });

      await expect(
        service.create(
          {
            scope: 'personal',
          } as any,
          'user-1',
        ),
      ).resolves.toEqual({ id: 'ci-1' });
    });

    it('should create personal item', async () => {
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1' });

      const result = await service.create(
        {
          scope: 'personal',
          title: 't',
          blocks: [{ text: 'hello' }],
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
            blocks: [{ text: 'hello' }],
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
          blocks: [{ text: 'hello' }],
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

    it('should validate folderId access and apply folderId filter', async () => {
      mockPrismaService.contentLibraryTab.findUnique.mockResolvedValue({
        id: 'f-1',
        type: 'FOLDER',
        userId: 'user-1',
        projectId: null,
      });
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll({ scope: 'personal', folderId: 'f-1' } as any, 'user-1');

      expect(mockPrismaService.contentLibraryTab.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'f-1' } }),
      );
      expect(mockPrismaService.contentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ folderId: 'f-1' }) }),
      );
    });
  });

  describe('tabs', () => {
    it('listTabs should return tabs ordered by order for personal scope', async () => {
      mockPrismaService.contentLibraryTab.findMany.mockResolvedValue([{ id: 't-1' }]);

      await expect(service.listTabs({ scope: 'personal' } as any, 'user-1')).resolves.toEqual([
        { id: 't-1' },
      ]);

      expect(mockPrismaService.contentLibraryTab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', projectId: null }),
          orderBy: { order: 'asc' },
        }),
      );
    });

    it('createTab should require projectId for project scope', async () => {
      await expect(
        service.createTab({ scope: 'project', type: 'FOLDER', title: 'Folder' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('reorderTabs should reject ids outside scope', async () => {
      mockPrismaService.contentLibraryTab.findMany.mockResolvedValue([{ id: 't-1' }]);

      await expect(
        service.reorderTabs({ scope: 'personal', ids: ['t-1', 't-2'] } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should forbid access to other user personal item', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValueOnce({
        id: 'ci-1',
        userId: 'other',
        projectId: null,
        archivedAt: null,
      });

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

  describe('blocks', () => {
    const mockPersonalItem = {
      id: 'ci-1',
      userId: 'user-1',
      projectId: null,
      archivedAt: null,
    };

    it('createBlock should create empty block', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.aggregate.mockResolvedValue({ _max: { order: 1 } });
      mockPrismaService.contentBlock.create.mockResolvedValue({ id: 'b-1' });

      await expect(
        service.createBlock(
          'ci-1',
          {
            type: 'plain',
            text: '   ',
            media: [],
          } as any,
          'user-1',
        ),
      ).resolves.toEqual({ id: 'b-1' });
    });

    it('createBlock should create block with next order', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.aggregate.mockResolvedValue({ _max: { order: 4 } });
      mockPrismaService.contentBlock.create.mockResolvedValue({ id: 'b-1' });

      const res = await service.createBlock(
        'ci-1',
        {
          type: 'plain',
          text: 'hello',
          media: [],
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentBlock.aggregate).toHaveBeenCalled();
      expect(mockPrismaService.contentBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentItemId: 'ci-1', order: 5 }),
        }),
      );
      expect(res).toEqual({ id: 'b-1' });
    });

    it('updateBlock should throw when block not found for content item', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBlock(
          'ci-1',
          'b-404',
          {
            text: 'x',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow('Content block not found');
    });

    it('updateBlock should update block when block belongs to item', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.contentBlock.update.mockResolvedValue({ id: 'b-1', text: 'updated' });

      const res = await service.updateBlock(
        'ci-1',
        'b-1',
        {
          text: 'updated',
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentBlock.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b-1' } }),
      );
      expect(res).toEqual({ id: 'b-1', text: 'updated' });
    });

    it('removeBlock should delete block when it belongs to item', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.contentBlock.delete.mockResolvedValue({ id: 'b-1' });

      const res = await service.removeBlock('ci-1', 'b-1', 'user-1');

      expect(mockPrismaService.contentBlock.delete).toHaveBeenCalledWith({ where: { id: 'b-1' } });
      expect(res).toEqual({ id: 'b-1' });
    });

    it('reorderBlocks should update orders in transaction', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findMany.mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]);
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      const res = await service.reorderBlocks(
        'ci-1',
        {
          blocks: [
            { id: 'b-1', order: 2 },
            { id: 'b-2', order: 1 },
          ],
        } as any,
        'user-1',
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });
  });

  describe('block media', () => {
    const mockPersonalItem = {
      id: 'ci-1',
      userId: 'user-1',
      projectId: null,
      archivedAt: null,
    };

    it('attachBlockMedia should create media link with next order', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.media.findUnique.mockResolvedValue({ id: 'm-1' });
      mockPrismaService.contentBlockMedia.aggregate.mockResolvedValue({ _max: { order: 0 } });
      mockPrismaService.contentBlockMedia.create.mockResolvedValue({ id: 'link-1' });

      const res = await service.attachBlockMedia(
        'ci-1',
        'b-1',
        {
          mediaId: 'm-1',
          hasSpoiler: true,
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentBlockMedia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentBlockId: 'b-1',
            mediaId: 'm-1',
            order: 1,
            hasSpoiler: true,
          }),
        }),
      );
      expect(res).toEqual({ id: 'link-1' });
    });

    it('detachBlockMedia should throw when link does not belong to block', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.contentBlockMedia.findUnique.mockResolvedValue({
        id: 'link-1',
        contentBlockId: 'b-other',
      });

      await expect(service.detachBlockMedia('ci-1', 'b-1', 'link-1', 'user-1')).rejects.toThrow(
        'Content block media not found',
      );
    });

    it('detachBlockMedia should delete link when it belongs to block', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.contentBlockMedia.findUnique.mockResolvedValue({
        id: 'link-1',
        contentBlockId: 'b-1',
      });
      mockPrismaService.contentBlockMedia.delete.mockResolvedValue({ id: 'link-1' });

      const res = await service.detachBlockMedia('ci-1', 'b-1', 'link-1', 'user-1');

      expect(mockPrismaService.contentBlockMedia.delete).toHaveBeenCalledWith({
        where: { id: 'link-1' },
      });
      expect(res).toEqual({ id: 'link-1' });
    });

    it('reorderBlockMedia should update orders in transaction', async () => {
      mockPrismaService.contentItem.findUnique.mockResolvedValue(mockPersonalItem);
      mockPrismaService.contentBlock.findUnique.mockResolvedValue({
        id: 'b-1',
        contentItemId: 'ci-1',
      });
      mockPrismaService.contentBlockMedia.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      const res = await service.reorderBlockMedia(
        'ci-1',
        'b-1',
        {
          media: [
            { id: 'l1', order: 1 },
            { id: 'l2', order: 0 },
          ],
        } as any,
        'user-1',
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });
  });
});
