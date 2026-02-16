import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ContentLibraryService } from '../../src/modules/content-library/content-library.service.js';
import { ContentCollectionsService } from '../../src/modules/content-library/content-collections.service.js';
import { ContentItemsService } from '../../src/modules/content-library/content-items.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { TagsService } from '../../src/modules/tags/tags.service.js';
import { BulkOperationType } from '../../src/modules/content-library/dto/bulk-operation.dto.js';

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
      updateMany: jest.fn() as any,
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    contentItemGroup: {
      upsert: jest.fn() as any,
      deleteMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      groupBy: jest.fn() as any,
    },
    contentCollection: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      aggregate: jest.fn() as any,
    },
    user: {
      findUnique: jest.fn() as any,
    },
    media: {
      findUnique: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
    } as any,
    tag: {
      findMany: jest.fn() as any,
    },
    $transaction: jest.fn() as any,
    $queryRaw: jest.fn() as any,
    $executeRaw: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
  };

  const mockTagsService = {
    prepareTagsConnectOrCreate: jest.fn() as any,
  };

  beforeAll(async () => {
    mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));

    moduleRef = await Test.createTestingModule({
      providers: [
        ContentLibraryService,
        ContentItemsService,
        ContentCollectionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: TagsService,
          useValue: mockTagsService,
        },
      ],
    }).compile();

    service = moduleRef.get<ContentLibraryService>(ContentLibraryService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('getAvailableTags', () => {
    it('should filter by CONTENT_LIBRARY domain and scope (project)', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.tag.findMany.mockResolvedValue([{ name: 'Tag A' }, { name: 'Tag B' }]);

      const res = await service.getAvailableTags('project', 'p1', 'user-1');

      expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith('p1', 'user-1', true);
      expect(mockPrismaService.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'p1',
            domain: 'CONTENT_LIBRARY',
            contentItems: { some: {} },
          }),
        }),
      );
      expect(res).toEqual(['Tag A', 'Tag B']);
    });

    it('should scope tags to group when groupId is provided', async () => {
      const assertGroupTabAccessSpy = jest
        .spyOn(service as any, 'assertGroupTabAccess')
        .mockResolvedValue({ id: 'g1' });
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentCollection.findUnique.mockResolvedValue({
        id: 'g1',
        type: 'GROUP',
        groupType: 'PROJECT_SHARED',
        userId: null,
        projectId: 'p1',
      });
      mockPrismaService.tag.findMany.mockResolvedValue([{ name: 'GroupTag' }]);

      const res = await service.getAvailableTags('project', 'p1', 'user-1', 'g1');

      expect(assertGroupTabAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'g1',
          scope: 'project',
          projectId: 'p1',
          userId: 'user-1',
        }),
      );
      expect(mockPrismaService.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: 'CONTENT_LIBRARY',
            contentItems: {
              some: {
                groups: { some: { collectionId: 'g1' } },
              },
            },
          }),
        }),
      );
      expect(res).toEqual(['GroupTag']);
    });
  });

  describe('bulkOperation', () => {
    it('SET_PROJECT should require mutation permission for target project and move items into project scope', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        { id: 'ci-1', userId: 'user-1', projectId: null, archivedAt: null },
        { id: 'ci-2', userId: 'user-1', projectId: null, archivedAt: null },
      ]);

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.contentItem.update.mockResolvedValue({ id: 'ci-1' });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-2'],
        operation: BulkOperationType.SET_PROJECT,
        projectId: 'p1',
      } as any);

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith('p1', 'user-1', [
        'ADMIN',
        'EDITOR',
      ]);

      expect(mockPrismaService.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ci-1' },
          data: expect.objectContaining({ projectId: 'p1', userId: null, tagObjects: { set: [] } }),
        }),
      );
      expect(mockPrismaService.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ci-2' },
          data: expect.objectContaining({ projectId: 'p1', userId: null, tagObjects: { set: [] } }),
        }),
      );

      expect(res).toEqual({ count: 2 });
    });

    it('SET_PROJECT should move items into personal scope when projectId is not provided', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        { id: 'ci-1', userId: null, projectId: 'p1', archivedAt: null },
        { id: 'ci-2', userId: null, projectId: 'p1', archivedAt: null },
      ]);

      mockPrismaService.contentItem.update.mockResolvedValue({ id: 'ci-1' });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-2'],
        operation: BulkOperationType.SET_PROJECT,
      } as any);

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledTimes(1);
      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith('p1', 'user-1', [
        'ADMIN',
        'EDITOR',
      ]);
      expect(mockPrismaService.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ci-1' },
          data: expect.objectContaining({
            projectId: null,
            userId: 'user-1',
            tagObjects: { set: [] },
          }),
        }),
      );
      expect(mockPrismaService.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ci-2' },
          data: expect.objectContaining({
            projectId: null,
            userId: 'user-1',
            tagObjects: { set: [] },
          }),
        }),
      );

      expect(res).toEqual({ count: 2 });
    });

    it('LINK_TO_GROUP should add group relations and keep existing primary group when set', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        {
          id: 'ci-1',
          userId: 'user-1',
          projectId: null,
          archivedAt: null,
        },
        {
          id: 'ci-2',
          userId: 'user-1',
          projectId: null,
          archivedAt: null,
        },
      ]);

      mockPrismaService.contentCollection.findUnique
        .mockResolvedValueOnce({ id: 'g-target', type: 'GROUP', projectId: null })
        .mockResolvedValueOnce({
          id: 'g-target',
          type: 'GROUP',
          userId: 'user-1',
          projectId: null,
        });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-2'],
        operation: BulkOperationType.LINK_TO_GROUP,
        groupId: 'g-target',
      } as any);

      expect(mockPrismaService.contentItemGroup.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.contentItemGroup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contentItemId_collectionId: {
              contentItemId: 'ci-1',
              collectionId: 'g-target',
            },
          },
        }),
      );
      expect(res).toEqual({ count: 2 });
    });

    it('MOVE_TO_GROUP should require sourceGroupId', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        {
          id: 'ci-1',
          userId: 'user-1',
          projectId: null,
          archivedAt: null,
        },
      ]);

      await expect(
        service.bulkOperation('user-1', {
          ids: ['ci-1'],
          operation: BulkOperationType.MOVE_TO_GROUP,
          groupId: 'g-target',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('MOVE_TO_GROUP should unlink only source group and set target as primary when needed', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        {
          id: 'ci-1',
          userId: 'user-1',
          projectId: null,
          archivedAt: null,
        },
        {
          id: 'ci-2',
          userId: 'user-1',
          projectId: null,
          archivedAt: null,
        },
      ]);

      mockPrismaService.contentCollection.findUnique
        .mockResolvedValueOnce({ id: 'g-target', type: 'GROUP', projectId: null })
        .mockResolvedValueOnce({ id: 'g-target', type: 'GROUP', userId: 'user-1', projectId: null })
        .mockResolvedValueOnce({
          id: 'g-source',
          type: 'GROUP',
          userId: 'user-1',
          projectId: null,
        });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-2'],
        operation: BulkOperationType.MOVE_TO_GROUP,
        groupId: 'g-target',
        sourceGroupId: 'g-source',
      } as any);

      expect(mockPrismaService.contentItemGroup.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contentItemId: 'ci-1', collectionId: 'g-source' } }),
      );
      expect(mockPrismaService.contentItemGroup.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contentItemId: 'ci-2', collectionId: 'g-source' } }),
      );
      expect(mockPrismaService.contentItemGroup.upsert).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ count: 2 });
    });

    it('MERGE should keep first item, merge title/text/tags/media and store removed meta list', async () => {
      mockPrismaService.contentItem.findMany
        .mockResolvedValueOnce([
          {
            id: 'ci-1',
            userId: 'user-1',
            projectId: null,
            archivedAt: null,
            title: null,
          },
          {
            id: 'ci-2',
            userId: 'user-1',
            projectId: null,
            archivedAt: null,
            title: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'ci-1',
            userId: 'user-1',
            projectId: null,
            title: 'A',
            note: 'keep-note',
            text: 't1',
            meta: { a: 1 },
            tagObjects: [{ name: 'Tag1' }],
            media: [{ mediaId: 'm1', order: 0, hasSpoiler: false }],
          },
          {
            id: 'ci-2',
            userId: 'user-1',
            projectId: null,
            title: 'B',
            note: 'should-not-merge',
            text: 't2',
            meta: { b: 2 },
            tagObjects: [{ name: 'Tag2' }],
            media: [{ mediaId: 'm2', order: 0, hasSpoiler: true }],
          },
        ]);

      mockTagsService.prepareTagsConnectOrCreate.mockResolvedValue({ set: [] });

      const deleteManyMedia = jest.fn() as any;
      const createManyMedia = jest.fn() as any;

      mockPrismaService.$transaction.mockImplementationOnce(async (fn: any) => {
        return fn({
          contentItem: {
            update: mockPrismaService.contentItem.update,
            deleteMany: mockPrismaService.contentItem.deleteMany,
          },
          contentItemMedia: {
            deleteMany: deleteManyMedia,
            createMany: createManyMedia,
          },
        });
      });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-2'],
        operation: BulkOperationType.MERGE,
      } as any);

      expect(mockPrismaService.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ci-1' },
          data: expect.objectContaining({
            title: 'A | B',
            text: 't1\n\n---\n\nt2',
            note: 'keep-note\n\n---\n\nshould-not-merge',
            meta: { a: 1, mergedContentItems: [{ b: 2 }] },
            tagObjects: { set: [] },
          }),
        }),
      );

      expect(mockTagsService.prepareTagsConnectOrCreate).toHaveBeenCalledWith(
        expect.arrayContaining(['tag1', 'tag2']),
        expect.objectContaining({ userId: 'user-1', projectId: undefined }),
        'CONTENT_LIBRARY',
        true,
      );

      expect(deleteManyMedia).toHaveBeenCalledWith({ where: { contentItemId: 'ci-1' } });
      expect(createManyMedia).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ contentItemId: 'ci-1', mediaId: 'm1' }),
          expect.objectContaining({ contentItemId: 'ci-1', mediaId: 'm2', hasSpoiler: true }),
        ]),
      });

      expect(mockPrismaService.contentItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['ci-2'] } },
      });
      expect(res).toEqual({ count: 2, targetId: 'ci-1' });
    });

    it('MERGE should be all-or-nothing: should throw when any selected item is missing', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        {
          id: 'ci-1',
          userId: 'user-1',
          projectId: null,
          groupId: null,
          archivedAt: null,
          title: null,
        },
      ]);

      await expect(
        service.bulkOperation('user-1', {
          ids: ['ci-1', 'ci-missing'],
          operation: BulkOperationType.MERGE,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('DELETE should be best-effort: should skip missing ids and proceed with authorized ones', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([
        {
          id: 'ci-1',
          userId: 'user-1',
          projectId: null,
          groupId: null,
          archivedAt: null,
          title: null,
        },
      ]);

      mockPrismaService.contentItem.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.bulkOperation('user-1', {
        ids: ['ci-1', 'ci-missing'],
        operation: BulkOperationType.DELETE,
      } as any);

      expect(mockPrismaService.contentItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['ci-1'] } },
      });
      expect(res).toEqual({ count: 1 });
    });
  });

  afterAll(async () => {
    await moduleRef?.close?.();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (input: any, _options?: any) => {
      if (typeof input === 'function') {
        return input(mockPrismaService);
      }

      // Batch mode: array of Prisma promises
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return undefined;
    });
  });

  describe('create', () => {
    it('should create even when blocks are not provided', async () => {
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1', tagObjects: [] });

      await expect(
        service.create(
          {
            scope: 'personal',
          } as any,
          'user-1',
        ),
      ).resolves.toEqual({ id: 'ci-1', tagObjects: [], tags: [] });
    });

    it('should create personal item', async () => {
      mockPrismaService.contentItem.create.mockResolvedValue({ id: 'ci-1', tagObjects: [] });

      const result = await service.create(
        {
          scope: 'personal',
          title: 't',
          text: 'hello',
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentItem.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'ci-1', tagObjects: [], tags: [] });
    });

    it('should require projectId for project scope', async () => {
      await expect(
        service.create(
          {
            scope: 'project',
            text: 'hello',
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
          text: 'hello',
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

    it('should include totalUnfiltered by default for first page (offset = 0)', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll({ scope: 'project', projectId: 'p1', offset: 0 } as any, 'user-1');

      expect(mockPrismaService.contentItem.count).toHaveBeenCalledTimes(2);
    });

    it('should skip totalUnfiltered for pagination requests (offset > 0) unless explicitly requested', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll({ scope: 'project', projectId: 'p1', offset: 20 } as any, 'user-1');

      expect(mockPrismaService.contentItem.count).toHaveBeenCalledTimes(1);
    });

    it('should include totalUnfiltered for pagination when includeTotalUnfiltered=true', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll(
        {
          scope: 'project',
          projectId: 'p1',
          offset: 20,
          includeTotalUnfiltered: true,
        } as any,
        'user-1',
      );

      expect(mockPrismaService.contentItem.count).toHaveBeenCalledTimes(2);
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

    it('should validate groupId access and apply group filter', async () => {
      mockPrismaService.contentCollection.findUnique.mockResolvedValue({
        id: 'f-1',
        type: 'GROUP',
        userId: 'user-1',
        projectId: null,
      });
      mockPrismaService.contentItem.findMany.mockResolvedValue([]);
      mockPrismaService.contentItem.count.mockResolvedValue(0);

      await service.findAll({ scope: 'personal', groupId: 'f-1' } as any, 'user-1');

      expect(mockPrismaService.contentCollection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'f-1' } }),
      );
      expect(mockPrismaService.contentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groups: { some: { collectionId: 'f-1' } },
          }),
        }),
      );
    });
  });

  describe('collections', () => {
    it('listCollections should return collections ordered by order for personal scope with direct items count', async () => {
      mockPrismaService.contentCollection.findMany.mockResolvedValue([
        { id: 't-1', type: 'GROUP' },
      ]);

      await expect(
        service.listCollections({ scope: 'personal' } as any, 'user-1'),
      ).resolves.toEqual([{ id: 't-1', type: 'GROUP', directItemsCount: 0 }]);

      expect(mockPrismaService.contentCollection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', projectId: null }),
          orderBy: { order: 'asc' },
        }),
      );
    });

    it('listCollections should filter project scope collections: shared groups + own groups + own saved views', async () => {
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.contentCollection.findMany.mockResolvedValue([
        { id: 'g-shared', type: 'GROUP' },
        { id: 'g-user', type: 'GROUP' },
        { id: 'sv-1', type: 'SAVED_VIEW' },
      ]);

      await expect(
        service.listCollections({ scope: 'project', projectId: 'p1' } as any, 'user-1'),
      ).resolves.toEqual([
        { id: 'g-shared', type: 'GROUP', directItemsCount: 0 },
        { id: 'g-user', type: 'GROUP', directItemsCount: 0 },
        { id: 'sv-1', type: 'SAVED_VIEW' },
      ]);

      expect(mockPrismaService.contentCollection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
          orderBy: { order: 'asc' },
        }),
      );
    });

    it('deleteCollection should delete root group subtree and orphan items (executeRaw x2)', async () => {
      jest.spyOn(service as any, 'assertCollectionAccess').mockResolvedValue({
        id: 'root-group',
        type: 'GROUP',
        userId: 'user-1',
        projectId: null,
        parentId: null,
      });

      mockPrismaService.contentCollection.findUnique.mockResolvedValueOnce({
        id: 'root-group',
        type: 'GROUP',
        groupType: 'PERSONAL_USER',
        userId: 'user-1',
        projectId: null,
        parentId: null,
      });

      const executeRaw = (jest.fn() as any)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      mockPrismaService.$transaction.mockImplementationOnce(async (fn: any) => {
        return fn({
          $executeRaw: executeRaw,
        });
      });

      await expect(
        service.deleteCollection('root-group', { scope: 'personal' } as any, 'user-1'),
      ).resolves.toEqual({ count: 1 });

      expect(executeRaw).toHaveBeenCalledTimes(2);
    });

    it('deleteCollection should delete subgroup, move direct items to parent and reparent children', async () => {
      jest.spyOn(service as any, 'assertCollectionAccess').mockResolvedValue({
        id: 'sub-group',
        type: 'GROUP',
        userId: 'user-1',
        projectId: null,
        parentId: 'parent-group',
      });

      mockPrismaService.contentCollection.findUnique.mockResolvedValueOnce({
        id: 'sub-group',
        type: 'GROUP',
        groupType: 'PERSONAL_USER',
        userId: 'user-1',
        projectId: null,
        parentId: 'parent-group',
      });

      const executeRaw = (jest.fn() as any).mockResolvedValue({ count: 1 });
      const deleteMany = (jest.fn() as any).mockResolvedValue({ count: 3 });
      const updateMany = (jest.fn() as any).mockResolvedValue({ count: 2 });
      const del = (jest.fn() as any).mockResolvedValue({ id: 'sub-group' });

      mockPrismaService.$transaction.mockImplementationOnce(async (fn: any) => {
        return fn({
          $executeRaw: executeRaw,
          contentItemGroup: {
            deleteMany,
          },
          contentCollection: {
            updateMany,
            delete: del,
          },
        });
      });

      await expect(
        service.deleteCollection('sub-group', { scope: 'personal' } as any, 'user-1'),
      ).resolves.toEqual({ id: 'sub-group' });

      expect(executeRaw).toHaveBeenCalledTimes(1);
      expect(deleteMany).toHaveBeenCalledWith({ where: { collectionId: 'sub-group' } });
      expect(updateMany).toHaveBeenCalledWith({
        where: { parentId: 'sub-group' },
        data: { parentId: 'parent-group' },
      });
      expect(del).toHaveBeenCalledWith({ where: { id: 'sub-group' } });
    });

    it('reorderCollections should reject ids outside scope', async () => {
      mockPrismaService.contentCollection.findMany.mockResolvedValue([{ id: 't-1' }]);

      await expect(
        service.reorderCollections({ scope: 'personal', ids: ['t-1', 't-2'] } as any, 'user-1'),
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
});
