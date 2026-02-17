import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ContentItemsService } from '../../src/modules/content-library/content-items.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { TagsService } from '../../src/modules/tags/tags.service.js';
import { ContentCollectionsService } from '../../src/modules/content-library/content-collections.service.js';

describe('ContentItemsService (unit)', () => {
  let service: ContentItemsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    contentItem: {
      update: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
    media: {
      findMany: jest.fn() as any,
    },
    contentItemMedia: {
      deleteMany: jest.fn() as any,
      createMany: jest.fn() as any,
    },
    $transaction: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
  };

  const mockTagsService = {
    prepareTagsConnectOrCreate: jest.fn() as any,
  };

  const mockCollectionsService = {
    assertGroupAccess: jest.fn() as any,
  };

  beforeAll(async () => {
    mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));

    moduleRef = await Test.createTestingModule({
      providers: [
        ContentItemsService,
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
        {
          provide: ContentCollectionsService,
          useValue: mockCollectionsService,
        },
      ],
    }).compile();

    service = moduleRef.get<ContentItemsService>(ContentItemsService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));
    jest.spyOn(service, 'assertContentItemAccess').mockResolvedValue({
      id: 'ci-1',
      userId: 'user-1',
      projectId: null,
      archivedAt: null,
      title: null,
    } as any);
    jest.spyOn(service, 'assertContentItemMutationAllowed').mockResolvedValue({
      id: 'ci-1',
      userId: 'user-1',
      projectId: null,
      archivedAt: null,
      title: null,
    } as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'ci-1' } as any);

    mockPrismaService.contentItem.update.mockResolvedValue({ id: 'ci-1' });
  });

  describe('sync', () => {
    it('should throw 400 when mediaIds contain non-existent media', async () => {
      mockPrismaService.media.findMany.mockResolvedValue([]);

      await expect(
        service.sync(
          'ci-1',
          {
            mediaIds: ['m-missing'],
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.sync(
          'ci-1',
          {
            mediaIds: ['m-missing'],
          } as any,
          'user-1',
        ),
      ).rejects.toThrow('Media not found: m-missing');

      expect(mockPrismaService.contentItemMedia.createMany).not.toHaveBeenCalled();
    });

    it('should recreate media links when all mediaIds exist', async () => {
      mockPrismaService.media.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

      await expect(
        service.sync(
          'ci-1',
          {
            mediaIds: ['m1', 'm2'],
            media: [
              { mediaId: 'm1', hasSpoiler: true },
              { mediaId: 'm2', hasSpoiler: false },
            ],
          } as any,
          'user-1',
        ),
      ).resolves.toEqual({ id: 'ci-1' });

      expect(mockPrismaService.contentItemMedia.deleteMany).toHaveBeenCalledWith({
        where: { contentItemId: 'ci-1' },
      });
      expect(mockPrismaService.contentItemMedia.createMany).toHaveBeenCalledWith({
        data: [
          { contentItemId: 'ci-1', mediaId: 'm1', order: 0, hasSpoiler: true },
          { contentItemId: 'ci-1', mediaId: 'm2', order: 1, hasSpoiler: false },
        ],
      });
    });
  });

  describe('findAll', () => {
    it('should apply groups.none filter when orphansOnly=true', async () => {
      mockPrismaService.contentItem.findMany.mockResolvedValueOnce([]);
      mockPrismaService.contentItem.count.mockResolvedValueOnce(0);

      await expect(
        service.findAll(
          {
            scope: 'personal',
            orphansOnly: true,
            limit: 20,
            offset: 0,
          } as any,
          'user-1',
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          items: [],
          total: 0,
        }),
      );

      expect(mockPrismaService.contentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            projectId: null,
            groups: { none: {} },
          }),
        }),
      );
    });

    it('should throw 400 when orphansOnly=true and groupId is provided', async () => {
      await expect(
        service.findAll(
          {
            scope: 'personal',
            orphansOnly: true,
            groupId: 'group-1',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.findAll(
          {
            scope: 'personal',
            orphansOnly: true,
            groupId: 'group-1',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow('groupId cannot be used together with orphansOnly');
    });
  });
});
