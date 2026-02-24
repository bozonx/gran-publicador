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

  const mockPublicationsService = {
    findAll: jest.fn() as any,
    findAllForUser: jest.fn() as any,
  };

  const mockUnsplashService = {
    searchPhotos: jest.fn() as any,
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
      mockPublicationsService as any,
      mockUnsplashService as any,
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

    mockPublicationsService.findAll.mockResolvedValue({ items: [], total: 0, totalUnfiltered: 0 });

    const req: any = {
      user: { userId: 'u1', allProjects: true, projectIds: ['p1'], tokenId: 't1' },
    };

    await controller.listCollectionItems(
      req,
      'c1',
      'project',
      'p1',
      'q',
      't1',
      'combined',
      'desc',
      20,
      0,
      undefined,
    );

    expect(mockPublicationsService.findAll).toHaveBeenCalledWith(
      'p1',
      'u1',
      expect.objectContaining({
        search: 'q',
        sortBy: 'chronology',
        sortOrder: 'desc',
        tags: ['t1'],
      }),
    );
    expect(mockPublicationsService.findAllForUser).not.toHaveBeenCalled();
  });

  it('maps publications for PUBLICATION_MEDIA_VIRTUAL', async () => {
    mockCollectionsService.assertCollectionAccess.mockResolvedValue({
      id: 'c1',
      type: 'PUBLICATION_MEDIA_VIRTUAL',
      userId: 'u1',
      projectId: null,
    });

    mockPublicationsService.findAllForUser.mockResolvedValue({
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
    const res = await controller.listCollectionItems(
      req,
      'c1',
      'personal',
      undefined,
      'q',
      't1',
      'combined',
      'desc',
      20,
      0,
      undefined,
    );

    expect(mockPublicationsService.findAllForUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        search: 'q',
        sortBy: 'chronology',
        sortOrder: 'desc',
        tags: ['t1'],
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
            text: 'Text',
            tags: ['t1'],
            media: [expect.objectContaining({ mediaId: 'm1' })],
            _virtual: { source: 'publication', publicationId: 'p1' },
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

    await controller.listCollectionItems(
      req,
      'g1',
      'personal',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      20,
      0,
      undefined,
    );

    expect(mockItemsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'personal',
        groupIds: ['g1'],
      }),
      'u1',
    );
  });

  it('rejects when project scope request violates api-token project scope', async () => {
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

    await expect(
      controller.listCollectionItems(
        req,
        'g1',
        'project',
        'p2',
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        0,
        undefined,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
