import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SocialPostingService } from '../../../src/modules/social-posting/social-posting.service.js';
import { PrismaService } from '../../../src/modules/prisma/prisma.service.js';
import { ShutdownService } from '../../../src/common/services/shutdown.service.js';
import { PostStatus, PublicationStatus } from '../../../src/generated/prisma/client.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { jest } from '@jest/globals';

import { I18nService } from 'nestjs-i18n';

// Mock undici
const mockFetch = jest.fn();

describe('SocialPostingService', () => {
  let service: SocialPostingService;
  
  const mockI18nService = {
    translate: jest.fn().mockImplementation((key) => key),
  };

  // Set fallback env var for Media Storage
  process.env.MEDIA_STORAGE_SERVICE_URL = 'http://media-storage/api/v1';
  process.env.MEDIA_STORAGE_TIMEOUT_SECS = '60';
  process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB = '100';

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

  const mockNotificationsService = {
    create: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPostingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ShutdownService, useValue: mockShutdownService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<SocialPostingService>(SocialPostingService);
    // Mock instance fetch
    (service as any).fetch = mockFetch;
    (mockFetch as any).mockReset();
    jest.clearAllMocks();
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
        json: async () => {
          return {
            success: true,
            data: { valid: true },
          };
        },
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
        json: async () => {
          return {
            success: true,
            data: {
              url: 'http://t.me/post/1',
              publishedAt: new Date().toISOString(),
            },
          };
        },
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
          data: expect.objectContaining({ status: PostStatus.PUBLISHED }),
        }),
      );
    });
  });
  describe('publishPublication', () => {
    it('should publish all posts in publication', async () => {
      const publicationId = 'pub-1';
      const mockPublication = {
        id: publicationId,
        status: PublicationStatus.SCHEDULED,
        content: 'Test content',
        media: [],
        posts: [
          {
            id: 'post-1',
            status: PostStatus.PENDING,
            channelId: 'chan-1',
            channel: {
              id: 'chan-1',
              socialMedia: 'TELEGRAM',
              channelIdentifier: '@test',
              isActive: true,
              credentials: { telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
            },
            meta: {},
          },
        ],
      };

      // Mock database calls
      // 1. Initial find (before lock)
      (mockPrismaService.publication.findUnique as any)
        .mockResolvedValueOnce(mockPublication) // first check
        .mockResolvedValueOnce(mockPublication); // second check (with posts)

      // 2. Lock
      (mockPrismaService.publication.updateMany as any).mockResolvedValue({ count: 1 });

      // 3. Post update (publishSinglePost)
      (mockPrismaService.post.update as any).mockResolvedValue({});

      // 4. Final update
      (mockPrismaService.publication.update as any).mockResolvedValue({});

      // Mock Fetch for microservice
      (mockFetch as any).mockResolvedValue({
        ok: true,
        json: async () => {
          return {
            success: true,
            data: { url: 'http://test.com', publishedAt: new Date().toISOString() },
          };
        },
      });

      const result = await service.publishPublication(publicationId);

      expect(result.success).toBe(true);
      expect(mockPrismaService.publication.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: publicationId,
            status: { not: PublicationStatus.PROCESSING },
          },
          data: expect.objectContaining({ status: PublicationStatus.PROCESSING }),
        }),
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.publication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: publicationId },
          data: expect.objectContaining({ status: PublicationStatus.PUBLISHED }),
        }),
      );
    });
  });
});
