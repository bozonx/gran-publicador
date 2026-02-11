import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SocialPostingService } from '../../../src/modules/social-posting/social-posting.service.js';
import { PrismaService } from '../../../src/modules/prisma/prisma.service.js';
import { ShutdownService } from '../../../src/common/services/shutdown.service.js';
import { PostStatus } from '../../../src/generated/prisma/index.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { jest } from '@jest/globals';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { MediaService } from '../../../src/modules/media/media.service.js';

import { I18nService } from 'nestjs-i18n';

describe('SocialPostingService', () => {
  let service: SocialPostingService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockI18nService = {
    translate: jest.fn().mockImplementation(key => key),
  };

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
      if (key === 'media') {
        return {
          serviceUrl: 'http://media-storage/api/v1',
          appId: 'gran-publicador',
          timeoutSecs: 60,
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
      aggregate: jest.fn(),
    },
  };

  const mockShutdownService = {
    isShutdownInProgress: jest.fn().mockReturnValue(false),
  };

  const mockNotificationsService = {
    create: jest.fn() as any,
  };

  const mockMediaService = {
    generatePublicToken: jest.fn().mockReturnValue('mock-token'),
  };

  beforeAll(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterAll(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPostingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ShutdownService, useValue: mockShutdownService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<SocialPostingService>(SocialPostingService);
    jest.clearAllMocks();

    (mockPrismaService.post.aggregate as any).mockResolvedValue({
      _max: { publishedAt: null },
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testChannel', () => {
    it('should call preview endpoint and return success', async () => {
      const channelId = 'chan-123';
      const mockChannel = {
        id: channelId,
        socialMedia: 'telegram',
        channelIdentifier: '@test',
        isActive: true,
        credentials: {
          telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
          telegramChannelId: '@test',
        },
      };

      (mockPrismaService.channel.findUnique as any).mockResolvedValue(mockChannel);

      const client = mockAgent.get('http://test-service');
      client
        .intercept({
          path: '/api/v1/preview',
          method: 'POST',
        })
        .reply(200, {
          success: true,
          data: { valid: true },
        });

      const result = await service.testChannel(channelId);
      expect(result.success).toBe(true);
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
        postingSnapshot: {
          version: 1,
          body: 'Test body content',
          media: [],
        },
        publication: {
          id: 'pub-1',
          meta: {},
          media: [],
          projectId: 'proj-1',
        },
        channel: {
          id: 'chan-1',
          socialMedia: 'telegram',
          channelIdentifier: '@test',
          isActive: true,
          credentials: {
            telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            telegramChannelId: '@test',
          },
          project: {},
        },
      };

      (mockPrismaService.post.findUnique as any).mockResolvedValue(mockPost);
      (mockPrismaService.publication.updateMany as any).mockResolvedValue({ count: 1 });
      (mockPrismaService.post.findMany as any).mockResolvedValue([
        { ...mockPost, status: PostStatus.PUBLISHED },
      ]);
      (mockPrismaService.publication.update as any).mockResolvedValue({});

      const client = mockAgent.get('http://test-service');
      client
        .intercept({
          path: '/api/v1/post',
          method: 'POST',
        })
        .reply(200, {
          success: true,
          data: {
            url: 'http://t.me/post/1',
            publishedAt: new Date().toISOString(),
          },
        });

      const result = await service.publishPost(postId);
      expect(result.success).toBe(true);
      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });
  });
});
