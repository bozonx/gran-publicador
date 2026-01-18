import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from '../../src/modules/posts/posts.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ChannelsService } from '../../src/modules/channels/channels.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest } from '@jest/globals';
import { PostStatus, PublicationStatus, SocialMedia } from '../../src/generated/prisma/client.js';

describe('PostsService (unit)', () => {
  let service: PostsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    post: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    publication: {
      findFirst: jest.fn() as any,
      findUnique: jest.fn() as any,
    },
    channel: {
      findUnique: jest.fn() as any,
    },
    publicationMedia: {
      count: jest.fn() as any,
    },
    authorSignature: {
      findFirst: jest.fn() as any,
    },
  };

  const mockChannelsService = {
    findOne: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ChannelsService,
          useValue: mockChannelsService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = moduleRef.get<PostsService>(PostsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should allow author to update post', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const updateDto = { status: PostStatus.PUBLISHED };

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: userId },
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.post.update.mockResolvedValue({ ...mockPost, ...updateDto });

      await service.update(postId, userId, updateDto);

      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });

    it('should allow admin to update post', async () => {
      const userId = 'admin-1';
      const postId = 'post-1';
      const updateDto = { status: PostStatus.PUBLISHED };

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: 'other-user' },
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.channel.findUnique.mockResolvedValue({
        projectId: 'p1',
        socialMedia: SocialMedia.TELEGRAM,
      });
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined); // Authorized
      mockPrismaService.post.update.mockResolvedValue({ ...mockPost, ...updateDto });
      // Validation mocks
      mockPrismaService.publicationMedia.count.mockResolvedValue(0);

      await service.update(postId, userId, updateDto);

      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });

    it('should validate scheduledAt: prevent setting if publication has no scheduledAt', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const updateDto = { scheduledAt: new Date() };

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: userId },
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.publication.findUnique.mockResolvedValue({ scheduledAt: null }); // Publication has no schedule

      await expect(service.update(postId, userId, updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should validate scheduledAt: allow setting if publication has scheduledAt', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const updateDto = { scheduledAt: new Date() };

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: userId },
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.publication.findUnique.mockResolvedValue({ scheduledAt: new Date() });

      mockPrismaService.post.update.mockResolvedValue({});

      await service.update(postId, userId, updateDto);

      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledAt: updateDto.scheduledAt,
            publishedAt: null,
            status: PostStatus.PENDING,
            errorMessage: null,
          }),
        }),
      );
    });

    it('should reset status to PENDING and clear error when scheduledAt is set', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const updateDto = { scheduledAt: new Date() };

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: userId },
        status: PostStatus.FAILED,
        errorMessage: 'Some error',
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.publication.findUnique.mockResolvedValue({ scheduledAt: new Date() });
      mockPrismaService.post.update.mockResolvedValue({});

      await service.update(postId, userId, updateDto);

      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PostStatus.PENDING,
            publishedAt: null,
            errorMessage: null,
          }),
        }),
      );
    });

    it('should clear errorMessage when scheduledAt is removed', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const updateDto = { scheduledAt: null } as any; // Cast for simplified DTO

      const mockPost = {
        id: postId,
        channelId: 'channel-1',
        publicationId: 'pub-1',
        publication: { createdBy: userId },
        errorMessage: 'Old error',
      };

      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.post.update.mockResolvedValue({});

      await service.update(postId, userId, updateDto);

      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledAt: null,
            errorMessage: null,
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a post when user has access', async () => {
      const userId = 'user-1';
      const channelId = 'channel-1';
      const dto = { publicationId: 'pub-1', content: 'hello' };
      const projectId = 'p1';

      mockChannelsService.findOne.mockResolvedValue({
        id: channelId,
        projectId,
        socialMedia: SocialMedia.TELEGRAM,
      });
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findFirst.mockResolvedValue({ id: 'pub-1', projectId });

      mockPrismaService.post.create.mockResolvedValue({
        id: 'new-post',
        ...dto,
      });

      // Validation mocks
      mockPrismaService.publicationMedia.count.mockResolvedValue(0);

      const result = await service.create(userId, channelId, dto);
      expect(result).toBeDefined();
      expect(mockPrismaService.post.create).toHaveBeenCalled();
    });

    it('should throw if publication does not belong to project', async () => {
      mockChannelsService.findOne.mockResolvedValue({ id: 'c1', projectId: 'p1' });
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.publication.findFirst.mockResolvedValue(null);

      await expect(service.create('u', 'c', { publicationId: 'pub' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllForProject', () => {
    it('should return posts for project members', async () => {
      const userId = 'u1';
      const projectId = 'p1';
      mockPermissionsService.getUserProjectRole.mockResolvedValue('VIEWER');
      mockPrismaService.post.findMany.mockResolvedValue([]);

      await service.findAllForProject(projectId, userId);
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channel: expect.objectContaining({ projectId }),
          }),
        }),
      );
    });

    it('should throw forbidden if user not member', async () => {
      mockPermissionsService.getUserProjectRole.mockResolvedValue(null);
      await expect(service.findAllForProject('p', 'u')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllForUser', () => {
    it('should return posts for user projects', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([]);
      await service.findAllForUser('u1');
      expect(mockPrismaService.post.findMany).toHaveBeenCalled();
    });
  });

  describe('findAllForChannel', () => {
    it('should return posts for channel if user has access', async () => {
      mockChannelsService.findOne.mockResolvedValue({ role: 'VIEWER' });
      mockPrismaService.post.findMany.mockResolvedValue([]);

      await service.findAllForChannel('c1', 'u1');
      expect(mockPrismaService.post.findMany).toHaveBeenCalled();
    });

    it('should throw forbidden if no access to channel', async () => {
      mockChannelsService.findOne.mockResolvedValue({ role: null }); // Mock returning no role
      await expect(service.findAllForChannel('c1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return post if found and user has access', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ id: 'post1', channelId: 'c1' });
      mockChannelsService.findOne.mockResolvedValue({}); // check access inside

      const res = await service.findOne('post1', 'u1');
      expect(res).toBeDefined();
    });

    it('should throw not found if post missing', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);
      await expect(service.findOne('p', 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should allow author to delete post', async () => {
      const userId = 'u1';
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 'post1',
        channelId: 'c1',
        publication: { createdBy: userId },
      });
      mockChannelsService.findOne.mockResolvedValue({});
      mockPrismaService.post.delete.mockResolvedValue({});

      await service.remove('post1', userId);
      expect(mockPrismaService.post.delete).toHaveBeenCalled();
    });

    it('should allow admin to delete post', async () => {
      const userId = 'admin';
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 'post1',
        channelId: 'c1',
        publication: { createdBy: 'other' },
      });
      mockChannelsService.findOne.mockResolvedValue({});
      // Simulate channel lookup for permission check
      mockPrismaService.channel.findUnique.mockResolvedValue({ projectId: 'p1' });
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);

      await service.remove('post1', userId);
      expect(mockPrismaService.post.delete).toHaveBeenCalled();
    });
  });
});
