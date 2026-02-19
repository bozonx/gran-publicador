import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { NewsNotificationsScheduler } from '../../src/modules/news-queries/news-notifications.scheduler.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { RedisService } from '../../src/common/redis/redis.service.js';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'news') {
      return {
        schedulerLookbackHours: 3,
        schedulerFetchLimit: 100,
      };
    }

    return null;
  }),
};

const mockRedisService = {
  acquireLock: jest.fn() as any,
  releaseLock: jest.fn() as any,
};

const mockPrismaService = {
  projectNewsQuery: {
    findMany: jest.fn() as any,
  },
  $queryRaw: jest.fn() as any,
  $executeRaw: jest.fn() as any,
  $queryRawUnsafe: jest.fn() as any,
};

const mockProjectsService = {
  searchNews: jest.fn() as any,
};

const mockNotificationsService = {
  create: jest.fn() as any,
};

const mockI18nService = {
  t: jest.fn((key: string, options: any) => {
    if (key.endsWith('NEW_NEWS_TITLE')) {
      return `New news: ${options?.args?.queryName || ''}`;
    }

    if (key.endsWith('NEW_NEWS_MESSAGE')) {
      return `Found ${options?.args?.count || 0} items`;
    }

    return key;
  }),
};

describe('NewsNotificationsScheduler (unit)', () => {
  let service: NewsNotificationsScheduler;
  let module: TestingModule | undefined;

  beforeEach(async () => {
    mockRedisService.acquireLock.mockResolvedValue('test-lock-token');
    mockRedisService.releaseLock.mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      providers: [
        NewsNotificationsScheduler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<NewsNotificationsScheduler>(NewsNotificationsScheduler);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
  });

  it('should not resend already delivered news to the same user', async () => {
    const query = {
      id: 'query-1',
      projectId: 'project-1',
      name: 'Main feed',
      settings: { q: 'test' },
      project: {
        owner: { id: 'user-owner', uiLanguage: 'en-US' },
        members: [{ user: { id: 'user-member', uiLanguage: 'en-US' } }],
      },
    };

    mockPrismaService.projectNewsQuery.findMany.mockResolvedValue([query]);
    mockPrismaService.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        userId: 'user-owner',
        queryId: 'query-1',
        lastSentSavedAt: new Date('2026-02-15T10:00:00.000Z'),
        lastSentNewsId: 'news-1',
      },
      {
        userId: 'user-member',
        queryId: 'query-1',
        lastSentSavedAt: new Date('2026-02-15T10:00:00.000Z'),
        lastSentNewsId: 'news-1',
      },
    ]);

    mockProjectsService.searchNews
      .mockResolvedValueOnce({
        items: [
          {
            _id: 'news-1',
            _savedAt: '2026-02-15T10:00:00.000Z',
            title: 'Breaking #1',
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [
          {
            _id: 'news-1',
            _savedAt: '2026-02-15T10:00:00.000Z',
            title: 'Breaking #1',
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null });

    mockPrismaService.$queryRawUnsafe
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }])
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    mockNotificationsService.create.mockResolvedValue({ id: 'notif-1' });

    const firstRun = await service.runNow();

    const secondRun = await service.runNow();

    expect(firstRun.createdNotificationsCount).toBe(2);
    expect(secondRun.createdNotificationsCount).toBe(0);
    expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('should skip run when distributed lock is not acquired', async () => {
    mockRedisService.acquireLock.mockResolvedValueOnce(null);

    const result = await service.runNow();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('distributed_lock_not_acquired');
    expect(mockPrismaService.projectNewsQuery.findMany).not.toHaveBeenCalled();
  });
});
