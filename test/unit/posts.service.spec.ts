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
      mockPrismaService.channel.findUnique.mockResolvedValue({ projectId: 'p1' });
      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined); // Authorized
      mockPrismaService.post.update.mockResolvedValue({ ...mockPost, ...updateDto });

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

      await expect(service.update(postId, userId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
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
            status: PostStatus.PENDING,
            errorMessage: undefined,
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
            errorMessage: undefined,
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
            errorMessage: undefined,
          }),
        }),
      );
    });
  });
});
