import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialPostingService } from '../../src/modules/social-posting/social-posting.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ShutdownService } from '../../src/common/services/shutdown.service.js';
import { jest } from '@jest/globals';
import {
  PublicationStatus,
  PostStatus,
  SocialMedia,
} from '../../src/generated/prisma/client.js';

describe('SocialPostingService (unit)', () => {
  let service: SocialPostingService;
  let moduleRef: TestingModule;

  // Mock methods for the client
  const mockPreview = jest.fn() as any;
  const mockPost = jest.fn() as any;
  const mockDestroy = jest.fn() as any;

  const mockPrismaService = {
    channel: {
      findUnique: jest.fn() as any,
    },
    publication: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })) as any,
    },
    post: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
    },
  };

  const mockShutdownService = {
    isShutdownInProgress: jest.fn().mockReturnValue(false),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'app') {
        return { postProcessingTimeoutSeconds: 1, logLevel: 'warn' };
      }
      if (key === 'socialPosting') {
        return {
          requestTimeoutSecs: 60,
          retryAttempts: 3,
          retryDelayMs: 1000,
          idempotencyTtlMinutes: 10,
        };
      }
      return null;
    }),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SocialPostingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ShutdownService,
          useValue: mockShutdownService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = moduleRef.get<SocialPostingService>(SocialPostingService);
    
    // Initialize (might fail or succeed with real lib, we don't care, we catch errors in onModuleInit inside service)
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockShutdownService.isShutdownInProgress.mockReturnValue(false);

    // FORCE REPLACE the private client with our mock
    (service as any).postingClient = {
      preview: mockPreview,
      post: mockPost,
      destroy: mockDestroy,
    };
  });

  describe('testChannel', () => {
    it('should return success when preview passes', async () => {
      const channel = {
        id: 'c1',
        isActive: true,
        channelIdentifier: 'chk_1',
        socialMedia: SocialMedia.TELEGRAM,
        credentials: { botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
      };

      mockPrismaService.channel.findUnique.mockResolvedValue(channel);
      mockPreview.mockResolvedValue({ success: true, data: {} });

      const result = await service.testChannel('c1');
      expect(result.success).toBe(true);
    });

    it('should return failure when validation fails', async () => {
      const channel = {
        id: 'c1',
        isActive: false, // Inactive
      };
      mockPrismaService.channel.findUnique.mockResolvedValue(channel);

      const result = await service.testChannel('c1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
    });

    it('should fail if channel not found', async () => {
      mockPrismaService.channel.findUnique.mockResolvedValue(null);
      await expect(service.testChannel('c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishPublication', () => {
    it('should publish successfully', async () => {
      const pubId = 'p1';
      const publication = {
        id: pubId,
        content: 'Hello World',
        media: [],
        posts: [
          {
            id: 'post1',
            status: PostStatus.PENDING,
            channelId: 'c1',
            channel: {
              id: 'c1',
              isActive: true,
              socialMedia: SocialMedia.TELEGRAM,
              channelIdentifier: '@test',
              credentials: { botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
            },
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(publication);
      mockPost.mockResolvedValue({
        success: true,
        data: { publishedAt: new Date().toISOString() },
      });

      const result = await service.publishPublication(pubId);

      expect(result.success).toBe(true);
      expect(mockPrismaService.publication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pubId },
          data: expect.objectContaining({ 
            status: PublicationStatus.PUBLISHED,
            processingStartedAt: null,
          }),
        }),
      );
      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post1' },
          data: expect.objectContaining({ status: PostStatus.PUBLISHED }),
        }),
      );
    });

    it('should flag as FAILED if all posts fail', async () => {
      const pubId = 'p1';
      const publication = {
        id: pubId,
        content: 'Hello World',
        media: [],
        posts: [
          {
            id: 'post1',
            status: PostStatus.PENDING,
            channelId: 'c1',
            channel: {
              id: 'c1',
              isActive: true,
              socialMedia: SocialMedia.TELEGRAM,
              channelIdentifier: '@test',
              credentials: { botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
            },
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(publication);
      mockPost.mockResolvedValue({
        success: false,
        error: { message: 'Api Error' },
      });

      const result = await service.publishPublication(pubId);

      expect(result.success).toBe(false);
      expect(mockPrismaService.publication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pubId },
          data: expect.objectContaining({ 
            status: PublicationStatus.FAILED,
            processingStartedAt: null,
          }),
        }),
      );
    });

    it('should flag as PARTIAL if some fail and some success', async () => {
      const pubId = 'p1';
      const publication = {
        id: pubId,
        content: 'Hello World',
        media: [],
        posts: [
          {
            id: 'post1',
            status: PostStatus.PENDING,
            channelId: 'c1',
            channel: {
              id: 'c1',
              isActive: true,
              socialMedia: SocialMedia.TELEGRAM,
              channelIdentifier: '@test',
              credentials: { botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
            },
            updatedAt: new Date(),
          },
          {
            id: 'post2',
            status: PostStatus.PENDING,
            channelId: 'c2',
            channel: {
              id: 'c2',
              isActive: true,
              socialMedia: SocialMedia.TELEGRAM,
              channelIdentifier: '@test2',
              credentials: { botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
            },
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(publication);

      mockPost
        .mockResolvedValueOnce({ success: true, data: { publishedAt: new Date() } })
        .mockResolvedValueOnce({ success: false, error: { message: 'Err' } });

      const result = await service.publishPublication(pubId);

      expect(result.success).toBe(false);
      expect(mockPrismaService.publication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pubId },
          data: expect.objectContaining({ 
            status: PublicationStatus.PARTIAL,
            processingStartedAt: null,
          }),
        }),
      );
    });

    it('should abort if shutdown in progress', async () => {
      const pubId = 'p1';
      const publication = {
        id: pubId,
        content: 'Hello',
        media: [],
        posts: [{ id: 'p1', status: PostStatus.PENDING, channelId: 'c1' }],
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(publication);
      // Simulate shutdown
      mockShutdownService.isShutdownInProgress.mockReturnValue(true);

      const result = await service.publishPublication(pubId);

      expect(result.data?.failedCount).toBe(1);
      expect(result.data?.results?.[0]?.error).toContain('Publication aborted due to system shutdown');
    });

    it('should fail with timeout error if processing takes too long', async () => {
      const pubId = 'p1';
      const publication = {
        id: pubId,
        content: 'Hello',
        media: [],
        posts: [
          {
            id: 'post1',
            status: PostStatus.PENDING,
            channelId: 'c1',
            channel: {
              id: 'c1',
              isActive: true,
              socialMedia: SocialMedia.TELEGRAM,
              channelIdentifier: '@test',
              credentials: { botToken: '1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890' },
            },
          },
        ],
      };

      mockPrismaService.publication.findUnique.mockResolvedValue(publication);

      // Simulate slow response > 1000ms configured in mockConfigService
      mockPost.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true };
      });

      const result = await service.publishPublication(pubId);

      expect(result.data?.results?.[0]?.success).toBe(false);
      expect(result.data?.results?.[0]?.error).toContain('Timeout reached (1s)');
    });
  });
});
