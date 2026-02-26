import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ContentLibraryController } from '../../src/modules/content-library/content-library.controller.js';

describe('ContentLibraryController.listCollectionItems (unit)', () => {
  let controller: ContentLibraryController;

  const mockCollectionsService = {
    assertCollectionAccess: jest.fn() as any,
  };

  const mockItemsService = {
    findAll: jest.fn() as any,
  };

  const mockBulkService = {
    bulkOperation: jest.fn() as any,
  };

  const mockVirtualService = {
    listPublicationItems: jest.fn() as any,
    listUnsplashItems: jest.fn() as any,
  };

  const mockPrismaService = {
    contentItem: {
      findUnique: jest.fn() as any,
    },
  };

  const mockApiTokenScopeService = {
    validateProjectScopeOrThrow: jest.fn() as any,
    validateManyProjectScopesOrThrow: jest.fn() as any,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    controller = new ContentLibraryController(
      mockCollectionsService as any,
      mockItemsService as any,
      {} as any,
      {} as any,
      mockBulkService as any,
      mockVirtualService as any,
      mockPrismaService as any,
      mockApiTokenScopeService as any,
    );
  });

  it('uses PublicationsService.findAll for project scope PUBLICATION_MEDIA_VIRTUAL', async () => {
    mockCollectionsService.assertCollectionAccess.mockResolvedValue({
      id: 'c1',
      type: 'PUBLICATION_MEDIA_VIRTUAL',
      userId: 'u1',
      projectId: 'p1',
    });

    mockVirtualService.listPublicationItems.mockResolvedValue({
      items: [],
      total: 0,
      totalUnfiltered: 0,
    });

    const req: any = {
      user: { userId: 'u1', allProjects: true, projectIds: ['p1'], tokenId: 't1' },
    };

    await controller.listCollectionItems(req, 'c1', {
      scope: 'project',
      projectId: 'p1',
      search: 'q',
      tags: ['t1'],
      sortBy: 'combined' as any,
      sortOrder: 'desc' as any,
      limit: 20,
      offset: 0,
    } as any);

    expect(mockVirtualService.listPublicationItems).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'project',
        projectId: 'p1',
        userId: 'u1',
        search: 'q',
        tags: 't1',
        sortBy: 'combined',
        sortOrder: 'desc',
        limit: 20,
        offset: 0,
      }),
    );
  });

  it('maps publications for PUBLICATION_MEDIA_VIRTUAL', async () => {
    mockCollectionsService.assertCollectionAccess.mockResolvedValue({
      id: 'c1',
      type: 'PUBLICATION_MEDIA_VIRTUAL',
      userId: 'u1',
      projectId: null,
    });

    mockVirtualService.listPublicationItems.mockResolvedValue({
      items: [
        {
          id: 'p1',
          title: 'Pub',
          content: 'Text',
          effectiveAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          tags: ['t1'],
          media: [{ order: 0, mediaId: 'm1', hasSpoiler: false, media: { id: 'm1' } }],
        },
      ],
      total: 1,
      totalUnfiltered: 2,
    });

    const req: any = { user: { userId: 'u1' } };
    const res = await controller.listCollectionItems(req, 'c1', {
      scope: 'personal',
      search: 'q',
      tags: ['t1'],
      sortBy: 'combined' as any,
      sortOrder: 'desc' as any,
      limit: 20,
      offset: 0,
    } as any);

    expect(mockVirtualService.listPublicationItems).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'personal',
        userId: 'u1',
        search: 'q',
        tags: 't1',
        sortBy: 'combined',
        sortOrder: 'desc',
        limit: 20,
        offset: 0,
      }),
    );

    expect(res).toEqual(
      expect.objectContaining({
        total: 1,
        totalUnfiltered: 2,
        items: [
          expect.objectContaining({
            id: 'p1',
            title: 'Pub',
            content: 'Text',
            tags: ['t1'],
            media: [expect.objectContaining({ mediaId: 'm1' })],
          }),
        ],
      }),
    );
  });

  it('delegates to itemsService.findAll for GROUP collections', async () => {
    mockCollectionsService.assertCollectionAccess.mockResolvedValue({
      id: 'g1',
      type: 'GROUP',
      userId: 'u1',
      projectId: null,
    });

    mockItemsService.findAll.mockResolvedValue({ items: [], total: 0 });
    const req: any = { user: { userId: 'u1' } };

    await controller.listCollectionItems(req, 'g1', {
      scope: 'personal',
      limit: 20,
      offset: 0,
    } as any);

    expect(mockItemsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'personal',
        groupIds: ['g1'],
        includeTotalInScope: true,
        includeTotalUnfiltered: true,
      }),
      'u1',
    );
  });

  it('does not enforce api-token scope validation inside controller method (covered by guards)', async () => {
    const req: any = {
      user: { userId: 'u1', allProjects: false, projectIds: ['p1'], tokenId: 't1' },
    };

    mockApiTokenScopeService.validateProjectScopeOrThrow.mockImplementation(
      (_req: any, projectId: string) => {
        if (projectId === 'p2') {
          throw new ForbiddenException('Access denied: project not in token scope');
        }
      },
    );

    mockCollectionsService.assertCollectionAccess.mockResolvedValue({
      id: 'g1',
      type: 'GROUP',
      userId: 'u1',
      projectId: 'p1',
    });

    mockItemsService.findAll.mockResolvedValue({ items: [], total: 0 });

    await expect(
      controller.listCollectionItems(req, 'g1', {
        scope: 'project',
        projectId: 'p2',
        limit: 20,
        offset: 0,
      } as any),
    ).resolves.toEqual({ items: [], total: 0 });

    expect(mockApiTokenScopeService.validateProjectScopeOrThrow).not.toHaveBeenCalled();
  });
});
