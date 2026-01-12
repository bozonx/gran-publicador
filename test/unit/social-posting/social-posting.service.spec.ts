import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SocialPostingService } from '../../../src/modules/social-posting/social-posting.service.js';
import { PrismaService } from '../../../src/modules/prisma/prisma.service.js';
import { ShutdownService } from '../../../src/common/services/shutdown.service.js';
import { PostStatus, PublicationStatus } from '../../../src/generated/prisma/client.js';
import { jest } from '@jest/globals';

// Mock undici
const mockFetch = jest.fn();

describe('SocialPostingService', () => {
  let service: SocialPostingService;
  let prismaService: any;
  
  // Set fallback env var
  process.env.MEDIA_DIR = '/tmp/media';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'socialPosting') {
        return {
          serviceUrl: 'http://test-service/api/v1',
          requestTimeoutSecs: 60,
          retryAttempts: 3,
        };
      }
      if (key === 'app') {
        return {
          postProcessingTimeoutSeconds: 60,
          logLevel: 'debug',
        };
      }
      return null;
    }),
  };

  const mockPrismaService = {
    channel: {
      findUnique: jest.fn(),
    },
    publication: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    post: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockShutdownService = {
    isShutdownInProgress: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPostingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ShutdownService, useValue: mockShutdownService },
      ],
    }).compile();

    service = module.get<SocialPostingService>(SocialPostingService);
    // Mock instance fetch
    (service as any).fetch = mockFetch;
    (mockFetch as any).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testChannel', () => {
    it('should call preview endpoint and return success', async () => {
      const channelId = 'chan-123';
      const mockChannel = {
        id: channelId,
        socialMedia: 'TELEGRAM',
        channelIdentifier: '@test',
        isActive: true,
        credentials: { telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
      };

      (mockPrismaService.channel.findUnique as any).mockResolvedValue(mockChannel);
      (mockFetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { valid: true },
        }),
      });

      const result = await service.testChannel(channelId);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-service/api/v1/preview',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"platform":"telegram"'),
        }),
      );
    });
  });

  describe('publishPost', () => {
    it('should call post endpoint and update post status on success', async () => {
      const postId = 'post-123';
      const mockPost = {
        id: postId,
        status: PostStatus.PENDING,
        publicationId: 'pub-1',
        channelId: 'chan-1',
        publication: {
           id: 'pub-1',
           meta: {},
           media: [],
        },
        channel: {
          id: 'chan-1',
          socialMedia: 'TELEGRAM',
          channelIdentifier: '@test',
          isActive: true,
          credentials: { telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
          project: {},
        },
      };

      (mockPrismaService.post.findUnique as any).mockResolvedValue(mockPost);
      (mockPrismaService.publication.updateMany as any).mockResolvedValue({ count: 1 });
      (mockPrismaService.post.findMany as any).mockResolvedValue([
        { ...mockPost, status: PostStatus.PUBLISHED },
      ]);
      (mockPrismaService.publication.update as any).mockResolvedValue({});

      (mockFetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            url: 'http://t.me/post/1',
            publishedAt: new Date().toISOString(),
          },
        }),
      });

      const result = await service.publishPost(postId);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-service/api/v1/post',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { id: postId },
            data: expect.objectContaining({ status: PostStatus.PUBLISHED })
        })
      );
    });
  });
});
