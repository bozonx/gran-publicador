import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PublicationsService } from '../../src/modules/publications/publications.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest } from '@jest/globals';
import { PostStatus, PublicationStatus, SocialMedia } from '../../src/generated/prisma/client.js';
import {
  IssueType,
  OwnershipType,
} from '../../src/modules/publications/dto/index.js';

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
    projectMember: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
    },
    channel: {
      findMany: jest.fn() as any,
    },
    post: {
      create: jest.fn() as any,
      updateMany: jest.fn() as any,
    },
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
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
      ],
    }).compile();

    service = moduleRef.get<PublicationsService>(PublicationsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a publication when user has access to project', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const createDto = {
        projectId,
        title: 'Test Publication',
        content: 'Test content',
        tags: 'test,demo',
        status: PublicationStatus.DRAFT,
        language: 'ru-RU',
      };

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

      const mockPublication = {
        id: 'pub-1',
        ...createDto,
        createdBy: userId,
        meta: '{}',
        sourceTexts: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.publication.create.mockResolvedValue(mockPublication);

      const result = await service.create(createDto, userId);

      expect(result).toEqual({
        ...mockPublication,
        meta: {},
        sourceTexts: [],
      });
      expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith(projectId, userId);
    });

    it('should throw ForbiddenException when user does not have access', async () => {
      mockPermissionsService.checkProjectAccess.mockRejectedValue(new ForbiddenException());
      await expect(service.create({ projectId: 'p1', content: 'c' } as any, 'u')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return publications with filters', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.publication.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrismaService.publication.count.mockResolvedValue(1);

      const result = await service.findAll(projectId, userId, {
        status: PublicationStatus.DRAFT,
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

    it('should apply complex filters (socialMedia, issueType, ownership)', async () => {
      const userId = 'user-1';
      const projectId = 'project-1';
      const filters = {
        ownership: OwnershipType.OWN,
        socialMedia: SocialMedia.TELEGRAM,
        issueType: IssueType.FAILED,
      };

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
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
      expect(issueTypeCondition.OR[0].status).toBe(PublicationStatus.FAILED);
    });
  });

  describe('update', () => {
    it('should allow author to update their publication', async () => {
      const userId = 'user-1';
      const publicationId = 'pub-1';
      const updateDto = { title: 'Updated Title' };

      const mockPublication = {
        id: publicationId,
        projectId: 'project-1',
        createdBy: userId,
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      const result = await service.update(publicationId, userId, updateDto);

      expect(result).toBeDefined();
    });

    it('should allow admin to update others publication', async () => {
      const userId = 'admin-user';
      mockPrismaService.publication.findUnique.mockResolvedValue({
        createdBy: 'other',
        projectId: 'p1',
      });
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined); // Admin has perm
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: { publicationId },
        data: {
          status: PostStatus.PENDING,
          scheduledAt: null,
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.publication.update.mockResolvedValue({ ...mockPublication, ...updateDto });

      await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: { publicationId },
        data: {
          status: PostStatus.PENDING,
          scheduledAt: null,
          errorMessage: null,
        },
      });
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

      await expect(service.update(publicationId, userId, updateDto)).rejects.toThrow(
        'Content or Media is required when status is READY',
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        status: PublicationStatus.SCHEDULED,
        scheduledAt,
      });

      const result = await service.update(publicationId, userId, updateDto);

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: {
          publicationId,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
          scheduledAt: null,
          publishedAt: null,
        },
      });
      expect(result.status).toBe(PublicationStatus.SCHEDULED);
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

      await expect(service.update(publicationId, userId, updateDto)).rejects.toThrow(
        'Content or Media is required when setting scheduledAt',
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.publication.update.mockResolvedValue({
        ...mockPublication,
        scheduledAt: newScheduledAt,
      });

      await service.update(publicationId, userId, updateDto);

      // Should update ALL posts
      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: {
          publicationId,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
          scheduledAt: null,
          publishedAt: null,
        },
      });
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
        meta: '{}',
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        { id: 'channel-1', projectId: 'project-1' },
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

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(PostStatus.PENDING);
      expect(result[0].scheduledAt).toEqual(scheduledAt);
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
        meta: '{}',
        scheduledAt: pubScheduledAt,
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(mockPublication);
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([
        { id: 'channel-1', projectId: 'project-1' },
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

      expect(result).toHaveLength(1);
      expect(result[0].scheduledAt).toEqual(pubScheduledAt);
    });

    it('should throw NotFoundException if some channels missing', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({ projectId: 'p1' });
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      await expect(service.createPostsFromPublication('p1', ['c1'], 'u')).rejects.toThrow(
        NotFoundException,
      );
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
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.publication.delete.mockResolvedValue(mockPublication);

      await expect(service.remove(publicationId, userId)).resolves.toBeDefined();
    });
  });

  describe('findAllForUser', () => {
    it('should return publications from all user projects', async () => {
      const userId = 'u1';
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        { projectId: 'p1' },
        { projectId: 'p2' },
      ]);
      mockPrismaService.publication.findMany.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      await service.findAllForUser(userId);

      expect(mockPrismaService.projectMember.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { projectId: true },
      });
      // Check that it calls findMany with proper where clause including projectIds
      expect(mockPrismaService.publication.findMany).toHaveBeenCalled();
    });

    it('should return empty list if user has no projects', async () => {
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
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

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

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

      mockPrismaService.publication.findMany.mockResolvedValue([
        scheduledFar,
        publishedRecent,
        publishedOld,
        draft,
      ]);
      mockPrismaService.publication.count.mockResolvedValue(4);

      const result = await service.findAll(projectId, userId, { sortBy: 'chronology' });

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
  });
});
