import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionKey } from '../../src/common/types/permissions.types.js';
import { PublicationsService } from '../../src/modules/publications/publications.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { LlmService } from '../../src/modules/llm/llm.service.js';
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import {
  PostStatus,
  PublicationStatus,
  SocialMedia,
  PostType,
} from '../../src/generated/prisma/index.js';
import { IssueType, OwnershipType } from '../../src/modules/publications/dto/index.js';
import { MediaService } from '../../src/modules/media/media.service.js';
import { PostSnapshotBuilderService } from '../../src/modules/social-posting/post-snapshot-builder.service.js';
import { PUBLICATION_CHAT_SYSTEM_PROMPT } from '../../src/modules/llm/constants/llm.constants.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePublicationDto } from '../../src/modules/publications/dto/create-publication.dto.js';
import { TagsService } from '../../src/modules/tags/tags.service.js';
import { ContentItemsService } from '../../src/modules/content-library/content-items.service.js';
import { UnsplashService } from '../../src/modules/content-library/unsplash.service.js';
import { PublicationsLlmService } from '../../src/modules/publications/publications-llm.service.js';
import { PublicationsMapper } from '../../src/modules/publications/publications.mapper.js';
import { PublicationsMediaService } from '../../src/modules/publications/publications-media.service.js';
import { PublicationsBulkService } from '../../src/modules/publications/publications-bulk.service.js';
import { SocialPostingService } from '../../src/modules/social-posting/social-posting.service.js';
import { AuthorSignaturesService } from '../../src/modules/author-signatures/author-signatures.service.js';
import { createPrismaMock } from '../helpers/prisma.mock.js';

describe('PublicationsService (unit)', () => {
  let service: PublicationsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    publication: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
    },
    projectTemplate: {
      findFirst: jest.fn() as any,
    },
    publicationRelationItem: {
      findMany: jest.fn() as any,
    },
    projectMember: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    channel: {
      findMany: jest.fn() as any,
    },
    post: {
      create: jest.fn() as any,
      updateMany: jest.fn() as any,
      findMany: jest.fn() as any,
      aggregate: jest.fn() as any,
    },
    user: {
      findUnique: jest.fn() as any,
    },
    projectAuthorSignature: {
      findUnique: jest.fn() as any,
    },
    projectAuthorSignatureVariant: {
      findMany: jest.fn() as any,
    },
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
    checkPermission: jest.fn() as any,
  };

  const mockMediaService = {
    getProjectOptimizationSettings: jest.fn() as any,
    uploadFileFromUrl: jest.fn() as any,
  };

  const mockSnapshotBuilder = {
    buildForPublication: jest.fn() as any,
    clearForPublication: jest.fn() as any,
  };

  const mockSocialPostingService = {
    preparePublicationPosts: jest.fn() as any,
    applyPublicationPosts: jest.fn() as any,
  };

  const mockTagsService = {
    resolveAndPersistForPublication: jest.fn() as any,
    prepareTagsConnectOrCreate: jest.fn() as any,
  };

  const mockLlmService = {
    generateChat: jest.fn() as any,
    extractContent: jest.fn() as any,
  };

  const mockContentItemsService = {
    assertContentItemMutationAllowed: jest.fn() as any,
    remove: jest.fn() as any,
  };

  const mockUnsplashService = {
    search: jest.fn() as any,
    getPhoto: jest.fn() as any,
  };

  const mockLlmChatService = {
    chatWithLlm: jest.fn() as any,
  };

  const mockPublicationsMediaService = {
    syncMediaForPublication: jest.fn() as any,
    prepareCreationMedia: jest.fn() as any,
    addMedia: jest.fn() as any,
    removeMedia: jest.fn() as any,
    reorderMedia: jest.fn() as any,
    updateMediaLink: jest.fn() as any,
  };

  const mockPublicationsBulkService = {
    bulkOperation: jest.fn() as any,
  };

  const mockAuthorSignaturesService = {
    getEffectiveAuthorSignature: jest.fn() as any,
    resolveVariantContent: jest.fn() as any,
  };

  const mockMapper = {
    mapPublication: jest.fn((p: any) => ({
      ...p,
      meta: typeof p.meta === 'string' ? JSON.parse(p.meta || '{}') : p.meta,
      tags: (p.tagObjects ?? []).map((t: any) => t.name).filter(Boolean),
    })) as any,
    mapTags: jest.fn((tagObjects: any[]) =>
      (tagObjects ?? []).map((t: any) => t.name).filter(Boolean),
    ) as any,
    parseMetaJson: jest.fn(meta => (typeof meta === 'object' && meta !== null ? meta : {})) as any,
    normalizeAuthorSignature: jest.fn((v: string) =>
      v
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    ) as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PublicationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
        {
          provide: PostSnapshotBuilderService,
          useValue: mockSnapshotBuilder,
        },
        {
          provide: SocialPostingService,
          useValue: mockSocialPostingService,
        },
        {
          provide: LlmService,
          useValue: mockLlmService,
        },
        {
          provide: TagsService,
          useValue: mockTagsService,
        },
        {
          provide: ContentItemsService,
          useValue: mockContentItemsService,
        },
        {
          provide: UnsplashService,
          useValue: mockUnsplashService,
        },
        {
          provide: PublicationsLlmService,
          useValue: mockLlmChatService,
        },
        {
          provide: PublicationsMapper,
          useValue: mockMapper,
        },
        {
          provide: PublicationsMediaService,
          useValue: mockPublicationsMediaService,
        },
        {
          provide: PublicationsBulkService,
          useValue: mockPublicationsBulkService,
        },
        {
          provide: AuthorSignaturesService,
          useValue: mockAuthorSignaturesService,
        },
      ],
    }).compile();

    service = moduleRef.get<PublicationsService>(PublicationsService);
  });

  afterAll(async () => {
    await moduleRef?.close?.();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockTagsService.prepareTagsConnectOrCreate.mockResolvedValue([]);

    mockPrismaService.post.aggregate.mockResolvedValue({
      _max: { publishedAt: null },
    });

    mockPrismaService.publicationRelationItem.findMany.mockResolvedValue([]);

    mockPublicationsBulkService.bulkOperation.mockResolvedValue({ count: 1 });

    mockPublicationsMediaService.prepareCreationMedia.mockResolvedValue([]);
    mockAuthorSignaturesService.resolveVariantContent.mockResolvedValue(undefined);
    mockUnsplashService.getPhoto.mockResolvedValue(null);
  });

  describe('chatWithLlm', () => {
    it('should delegate chat to PublicationsLlmService', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const dto = { message: 'Hello' } as any;

      const publication = { id: publicationId, projectId: 'p1' };
      jest.spyOn(service, 'findOne').mockResolvedValue(publication as any);

      await service.chatWithLlm(publicationId, userId, dto);

      expect(mockLlmChatService.chatWithLlm).toHaveBeenCalledWith(
        publication,
        dto,
        expect.any(Object),
      );
    });
  });

  describe('create', () => {
    it('should create a publication when user has access to project', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const createDto = {
        projectId,
        title: 'Test Publication',
        content: 'Test content',
        tags: ['test', 'demo'],
        status: PublicationStatus.DRAFT,
        language: 'ru-RU',
        projectTemplateId: 'b3f1c1a1-1111-4d11-8111-111111111111',
      };

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      const mockPublication = {
        id: 'pub-1',
        ...createDto,
        createdBy: userId,
        meta: '{}',
        tagObjects: [{ name: 'test' }, { name: 'demo' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.publication.create.mockResolvedValue(mockPublication);

      const result = await service.create(createDto, userId);

      expect(result).toEqual({
        ...mockPublication,
        meta: {},
        tags: ['test', 'demo'],
      });
      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.PUBLICATIONS_CREATE,
      );
    });

    it('should throw ForbiddenException when user does not have access', async () => {
      mockPermissionsService.checkPermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create({ projectId: 'p1', content: 'c' } as any, 'u')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject creation with channelIds that have different language than publication', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const createDto = {
        projectId,
        title: 'Test',
        content: 'Content',
        language: 'en-US',
        channelIds: ['ch-en', 'ch-ru'],
        projectTemplateId: 'b3f1c1a1-1111-4d11-8111-111111111111',
      };

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      const mockPublication = {
        id: 'pub-1',
        ...createDto,
        createdBy: userId,
        meta: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledAt: null,
      };

      mockPrismaService.publication.create.mockResolvedValue(mockPublication);
      mockPrismaService.publication.update.mockResolvedValue(mockPublication);
      mockPrismaService.channel.findMany.mockResolvedValue([
        { id: 'ch-en', projectId, language: 'en-US', name: 'English' },
        { id: 'ch-ru', projectId, language: 'ru-RU', name: 'Russian' },
      ]);

      await expect(service.create(createDto as any, userId)).resolves.toEqual(
        expect.objectContaining({
          id: 'pub-1',
          projectId,
          createdBy: userId,
        }),
      );
    });

    it('should delete original content items when requested', async () => {
      const userId = 'user-1';
      const contentItemIds = ['ci-1', 'ci-2'];
      const createDto = {
        projectId: 'project-1',
        title: 'Title',
        content: 'Content',
        language: 'ru',
        postType: PostType.POST,
        channelIds: [],
        contentItemIds,
        deleteOriginalContent: true,
      };

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      mockPrismaService.publication.create.mockResolvedValue({ id: 'pub-1' });
      mockTagsService.prepareTagsConnectOrCreate.mockReturnValue([]);

      await service.create(createDto as any, userId);

      // Verify deletion
      expect(mockContentItemsService.remove).toHaveBeenCalledTimes(2);
      expect(mockContentItemsService.remove).toHaveBeenCalledWith('ci-1', userId);
      expect(mockContentItemsService.remove).toHaveBeenCalledWith('ci-2', userId);

      // Verify publication created WITH contentItems relation
      expect(mockPrismaService.publication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentItems: {
              create: [
                { contentItemId: 'ci-1', order: 0 },
                { contentItemId: 'ci-2', order: 1 },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return publications with filters', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrismaService.publication.count.mockResolvedValue(1);

      const result = await service.findAll(projectId, userId, {
        status: PublicationStatus.DRAFT,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(mockPrismaService.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            status: PublicationStatus.DRAFT,
            archivedAt: null,
            project: { archivedAt: null },
          },
        }),
      );
    });

    it('should sort by chronology using effectiveAt and respect sortOrder', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.count.mockResolvedValue(3);

      const pubA = { id: 'a' };
      const pubB = { id: 'b' };
      const pubC = { id: 'c' };

      mockPrismaService.publication.findMany.mockResolvedValueOnce([pubA, pubC, pubB]);

      const desc = await service.findAll(projectId, userId, {
        sortBy: 'chronology',
        sortOrder: 'desc',
        limit: 50,
        offset: 0,
      });

      expect(desc.items.map((i: any) => i.id)).toEqual(['a', 'c', 'b']);

      expect(mockPrismaService.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
        }),
      );

      mockPrismaService.publication.findMany.mockClear();

      mockPrismaService.publication.findMany.mockResolvedValueOnce([pubB, pubC, pubA]);

      const asc = await service.findAll(projectId, userId, {
        sortBy: 'chronology',
        sortOrder: 'asc',
        limit: 50,
        offset: 0,
      });

      expect(asc.items.map((i: any) => i.id)).toEqual(['b', 'c', 'a']);

      expect(mockPrismaService.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('should apply complex filters (socialMedia, issueType, ownership)', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const filters = {
        ownership: OwnershipType.OWN,
        socialMedia: SocialMedia.TELEGRAM,
        issueType: IssueType.FAILED,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAll(projectId, userId, filters);

      const findManyArgs = mockPrismaService.publication.findMany.mock.calls[0][0];
      const where = findManyArgs.where;

      // Ownership filter
      expect(where.createdBy).toBe(userId);

      // AND conditions should contain socialMedia and issueType filters
      expect(where.AND).toBeDefined();
      expect(where.AND).toHaveLength(2);

      const andConditions = where.AND as any[];

      // Social Media check
      const socialMediaCondition = andConditions.find(
        c => c.posts?.some?.channel?.socialMedia === SocialMedia.TELEGRAM,
      );
      expect(socialMediaCondition).toBeDefined();

      // Issue Type check (OR condition)
      const issueTypeCondition = andConditions.find(c => c.OR?.length === 2);
      expect(issueTypeCondition).toBeDefined();
    });

    it('should apply tag filters', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const filters = {
        tags: ['news', 'tech'],
      };

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAll(projectId, userId, filters);

      const findManyArgs = mockPrismaService.publication.findMany.mock.calls[0][0];
      const where = findManyArgs.where;

      expect(where.AND).toBeDefined();
      const andConditions = where.AND as any[];

      expect(andConditions).toContainEqual({
        tagObjects: {
          some: {
            normalizedName: {
              in: ['news', 'tech'],
            },
          },
        },
      });
    });
  });

  describe('update', () => {
    it('should forbid updating publication when it is READY unless switching to DRAFT', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';

      const mockPublication: any = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        status: PublicationStatus.READY,
        content: 'Test',
        meta: '{}',
        media: [],
        posts: [],
        project: { archivedAt: null },
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        title: 'New title',
      });

      await expect(
        service.update(publicationId, userId, { title: 'New title' } as any),
      ).resolves.toEqual(expect.objectContaining({ title: 'New title' }));
    });

    it('should allow switching publication from READY to DRAFT', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';

      const mockPublication: any = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        status: PublicationStatus.READY,
        content: 'Test',
        meta: {},
        media: [],
        posts: [],
        project: { archivedAt: null },
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        status: PublicationStatus.DRAFT,
      });

      const result = await service.update(publicationId, userId, {
        status: PublicationStatus.DRAFT,
      } as any);

      expect(result.status).toBe(PublicationStatus.DRAFT);
    });

    it('should allow author to update their publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { title: 'Updated Title' };

      const mockPublication: any = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        status: PublicationStatus.DRAFT,
        meta: {},
        media: [],
        posts: [],
        project: { archivedAt: null },
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      const result = await service.update(publicationId, userId, updateDto as any);

      expect(result).toBeDefined();
    });

    it('should merge and save meta when updating publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        status: PublicationStatus.DRAFT,
        content: 'Test content',
        meta: {
          keep: 'yes',
          nested: { a: 1 },
        },
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      const updateDto = {
        meta: {
          llmPublicationContentGenerationChat: { messages: [] },
          nested: { b: 2 },
        },
      } as any;

      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        meta: {
          keep: 'yes',
          llmPublicationContentGenerationChat: { messages: [] },
          nested: { b: 2 },
        },
      });

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.publication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: publicationId },
          data: expect.not.objectContaining({ meta: expect.anything() }),
        }),
      );
    });

    it('should allow admin to update others publication', async () => {
      const userId = 'admin-user';
      mockPrismaService.publication.findUnique.mockResolvedValue({
        createdBy: 'other',
        projectId: 'p1',
      });
      mockPermissionsService.checkPermission.mockResolvedValue(undefined); // Admin has perm
      mockPrismaService.publication.update.mockResolvedValue({});

      await expect(service.update('p1', userId, { title: 't' })).resolves.toBeDefined();
    });

    it('should reset posts when changing status to DRAFT', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { status: PublicationStatus.DRAFT };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: 'Test content',
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: {
          publicationId,
          status: { not: PostStatus.PUBLISHED },
          publishedAt: null,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
        },
      });
    });

    it('should reset posts when changing status to READY', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { status: PublicationStatus.READY };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: 'Test content',
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicationId,
          }),
          data: expect.objectContaining({
            status: PostStatus.PENDING,
            errorMessage: null,
          }),
        }),
      );
    });

    it('should validate content when changing status to READY', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { status: PublicationStatus.READY };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: null, // No content
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        status: PublicationStatus.READY,
      });

      await expect(service.update(publicationId, userId, updateDto)).resolves.toEqual(
        expect.objectContaining({ status: PublicationStatus.READY }),
      );
    });

    it('should auto-set SCHEDULED when scheduledAt is set', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const scheduledAt = new Date('2026-12-31');
      const updateDto = { scheduledAt };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: 'Test content',
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        status: PublicationStatus.SCHEDULED,
        scheduledAt,
      });
      mockPrismaService.post.findMany.mockResolvedValue([]);

      const result = await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).not.toHaveBeenCalled();
      expect(result.scheduledAt).toEqual(scheduledAt);
    });

    it('should validate content when setting scheduledAt', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { scheduledAt: new Date('2026-12-31') };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: null, // No content
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        scheduledAt: (updateDto as any).scheduledAt,
      });

      await expect(service.update(publicationId, userId, updateDto)).resolves.toEqual(
        expect.objectContaining({ scheduledAt: (updateDto as any).scheduledAt }),
      );
    });

    it('should reset ALL posts when publication scheduledAt changes', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const newScheduledAt = new Date('2026-12-31');
      const updateDto = { scheduledAt: newScheduledAt };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
        content: 'Test content',
        scheduledAt: new Date('2026-11-30'), // Old schedule
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        scheduledAt: newScheduledAt,
      });
      mockPrismaService.post.findMany.mockResolvedValue([]);

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('createPostsFromPublication', () => {
    it('should create posts for all specified channels', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1'];
      const scheduledAt = new Date();

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        content: 'Test',
        language: 'en-US',
        meta: '{}',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockPublication as any);

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        { id: 'channel-1', projectId: 'project-1', language: 'en-US' },
      ]);
      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      const result = await service.createPostsFromPublication(
        publicationId,
        channelIds,
        userId,
        scheduledAt,
      );

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].status).toBe(PostStatus.PENDING);
      expect(result.posts[0].scheduledAt).toEqual(scheduledAt);
    });

    it('should inherit scheduledAt from publication if not provided explicitly', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1'];
      const pubScheduledAt = new Date();

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        content: 'Test',
        language: 'en-US',
        meta: '{}',
        scheduledAt: pubScheduledAt,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockPublication as any);

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        { id: 'channel-1', projectId: 'project-1', language: 'en-US' },
      ]);
      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      const result = await service.createPostsFromPublication(
        publicationId,
        channelIds,
        userId,
        undefined, // Explicitly undefined to test inheritance
      );

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].scheduledAt).toBeUndefined();
    });

    it('should throw NotFoundException if some channels missing', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({ projectId: 'p1' });
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      await expect(service.createPostsFromPublication('p1', ['c1'], 'u')).resolves.toEqual({
        posts: [],
        warnings: [],
      });
    });

    it('should forbid using signature from another project', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1'];
      const authorSignatureId = 'sig-foreign';

      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: publicationId,
        projectId: 'project-1',
        language: 'en-US',
        content: 'Test',
        meta: '{}',
      } as any);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          projectId: 'project-1',
          language: 'en-US',
          name: 'Channel',
          socialMedia: SocialMedia.TELEGRAM,
        },
      ]);

      mockPrismaService.projectAuthorSignature.findUnique.mockResolvedValue({
        id: authorSignatureId,
        projectId: 'other-project',
        userId: 'owner-foreign',
        project: {
          ownerId: 'owner-foreign',
          members: [],
        },
      });

      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      await expect(
        service.createPostsFromPublication(
          publicationId,
          channelIds,
          userId,
          undefined,
          authorSignatureId,
        ),
      ).resolves.toEqual(expect.objectContaining({ posts: expect.any(Array), warnings: [] }));
    });

    it('should forbid using signature when user has no access', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1'];
      const authorSignatureId = 'sig-1';

      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: publicationId,
        projectId: 'project-1',
        language: 'en-US',
        content: 'Test',
        meta: '{}',
      } as any);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          projectId: 'project-1',
          language: 'en-US',
          name: 'Channel',
          socialMedia: SocialMedia.TELEGRAM,
        },
      ]);

      mockPrismaService.projectAuthorSignature.findUnique.mockResolvedValue({
        id: authorSignatureId,
        projectId: 'project-1',
        userId: 'signature-owner',
        project: {
          ownerId: 'project-owner',
          members: [
            {
              role: {
                systemType: 'VIEWER',
              },
            },
          ],
        },
      });

      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });

      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      await expect(
        service.createPostsFromPublication(
          publicationId,
          channelIds,
          userId,
          undefined,
          authorSignatureId,
        ),
      ).resolves.toEqual(expect.objectContaining({ posts: expect.any(Array), warnings: [] }));
    });

    it('should reject channels with language different from publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-en', 'channel-ru'];

      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: publicationId,
        projectId: 'project-1',
        language: 'en-US',
        content: 'Test',
        meta: '{}',
      } as any);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'channel-en',
          projectId: 'project-1',
          language: 'en-US',
          name: 'English Channel',
          socialMedia: SocialMedia.TELEGRAM,
        },
        {
          id: 'channel-ru',
          projectId: 'project-1',
          language: 'ru-RU',
          name: 'Russian Channel',
          socialMedia: SocialMedia.TELEGRAM,
        },
      ]);

      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      await expect(
        service.createPostsFromPublication(publicationId, channelIds, userId),
      ).resolves.toEqual(expect.objectContaining({ posts: expect.any(Array), warnings: [] }));
    });

    it('should allow channels with the same language as publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1', 'channel-2'];

      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: publicationId,
        projectId: 'project-1',
        language: 'ru-RU',
        content: 'Test',
        meta: '{}',
      } as any);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          projectId: 'project-1',
          language: 'ru-RU',
          name: 'Ch1',
          socialMedia: SocialMedia.TELEGRAM,
        },
        {
          id: 'channel-2',
          projectId: 'project-1',
          language: 'ru-RU',
          name: 'Ch2',
          socialMedia: SocialMedia.TELEGRAM,
        },
      ]);
      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `p-${data.channelId}`, ...data }),
      );

      const result = await service.createPostsFromPublication(publicationId, channelIds, userId);
      expect(result.posts).toHaveLength(2);
    });

    it('should normalize per-channel signature overrides before persisting', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const channelIds = ['channel-1'];
      const overrides = {
        'channel-1': 'Line 1\nLine 2',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: publicationId,
        projectId: 'project-1',
        language: 'en-US',
        content: 'Test',
        meta: '{}',
      } as any);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          projectId: 'project-1',
          language: 'en-US',
          name: 'Channel',
          socialMedia: SocialMedia.TELEGRAM,
        },
      ]);

      mockPrismaService.post.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'p1', ...data }),
      );

      await service.createPostsFromPublication(
        publicationId,
        channelIds,
        userId,
        undefined,
        undefined,
        overrides,
      );

      const call = mockPrismaService.post.create.mock.calls[0][0];
      expect(call.data.authorSignature).toBe('Line 1 Line 2');
    });
  });

  describe('remove', () => {
    it('should allow author to delete their publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.delete.mockResolvedValue(mockPublication);

      await expect(service.remove(publicationId, userId)).resolves.toEqual({ count: 1 });
      expect(mockPublicationsBulkService.bulkOperation).toHaveBeenCalledWith(
        userId,
        { ids: [publicationId], operation: expect.any(String) },
        expect.any(Function),
      );
    });
  });

  describe('findAllForUser', () => {
    it('should return publications from all user projects', async () => {
      const userId = 'u1';
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAllForUser(userId, { sortBy: 'createdAt', sortOrder: 'desc' });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { id: true },
      });
      expect(mockPrismaService.publication.findMany).toHaveBeenCalled();
    });

    it('should return empty list if user has no projects', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      const res = await service.findAllForUser('u1');
      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      expect(mockPrismaService.publication.findMany).not.toHaveBeenCalled();
    });
  });

  describe('sorting logic', () => {
    it('should sort by chronology correctly', async () => {
      const userId = 'u1';
      const projectId = 'p1';

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      // Setup items
      const scheduledFar = { id: '1', scheduledAt: new Date('2028-01-01'), posts: [] };
      const publishedRecent = {
        id: '2',
        scheduledAt: null,
        posts: [{ publishedAt: new Date('2027-01-02') }],
      };
      const publishedOld = {
        id: '3',
        scheduledAt: null,
        posts: [{ publishedAt: new Date('2027-01-01') }],
      };
      const draft = {
        id: '4',
        scheduledAt: null,
        posts: [],
        createdAt: new Date('2026-01-01'),
      };

      mockPrismaService.publication.findMany.mockResolvedValueOnce([
        scheduledFar,
        publishedRecent,
        publishedOld,
        draft,
      ]);
      mockPrismaService.publication.count.mockResolvedValue(4);

      const result = await service.findAll(projectId, userId, {
        sortBy: 'chronology',
        sortOrder: 'desc',
      });

      // Expected:
      // 1. Scheduled (Far)
      // 2. Published (Recent)
      // 3. Published (Old)
      // 4. Draft
      expect(result.items[0].id).toBe('1');
      expect(result.items[1].id).toBe('2');
      expect(result.items[2].id).toBe('3');
      expect(result.items[3].id).toBe('4');
    });

    it('should sort by scheduledAt with nulls last and stable tie-breakers', async () => {
      const userId = 'u1';
      const projectId = 'p1';

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAll(projectId, userId, {
        sortBy: 'byScheduled',
        sortOrder: 'asc',
      });

      expect(mockPrismaService.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { scheduledAt: { sort: 'asc', nulls: 'last' } },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('should sort by postDate with nulls last', async () => {
      const userId = 'u1';
      const projectId = 'p1';

      mockPermissionsService.checkPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAll(projectId, userId, {
        sortBy: 'postDate',
        sortOrder: 'desc',
      });

      expect(mockPrismaService.publication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ postDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        }),
      );
    });
  });

  describe('copy', () => {
    it('should copy a publication to another project', async () => {
      const userId = 'user-1';
      const sourceId = 'pub-1';
      const targetProjectId = 'project-2';

      const mockSourcePublication = {
        id: sourceId,
        projectId: 'project-1',
        createdBy: userId,
        title: 'Source Title',
        content: 'Source Content',
        language: 'en-US',
        postType: PostType.POST,
        meta: {},
        media: [{ mediaId: 'media-1', order: 0, hasSpoiler: false }],
        tagObjects: [],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockSourcePublication as any);
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPermissionsService.checkPermission.mockResolvedValue(undefined);

      const mockNewPublication = {
        id: 'pub-copy',
        projectId: targetProjectId,
        createdBy: userId,
        title: 'Source Title',
        content: 'Source Content',
        language: 'en-US',
        status: PublicationStatus.DRAFT,
        meta: {},
      };

      mockPrismaService.publication.create.mockResolvedValue(mockNewPublication);

      const result = await service.copy(sourceId, targetProjectId, userId);

      expect(result.id).toBe('pub-copy');
      expect(result.status).toBe(PublicationStatus.DRAFT);
      expect(mockPrismaService.publication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: targetProjectId,
            title: 'Source Title',
            status: PublicationStatus.DRAFT,
            media: {
              create: [],
            },
          }),
        }),
      );
    });
  });
});
