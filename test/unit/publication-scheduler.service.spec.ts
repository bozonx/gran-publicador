import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { PublicationSchedulerService } from '../../src/modules/social-posting/publication-scheduler.service.js';
import { SocialPostingService } from '../../src/modules/social-posting/social-posting.service.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PostStatus, PublicationStatus } from '../../src/generated/prisma/index.js';
import { RedisService } from '../../src/common/redis/redis.service.js';

// Mock ConfigService
const mockConfigService = {
  get: jest.fn(key => {
    if (key === 'app') {
      return {
        schedulerWindowMinutes: 10,
      };
    }
    return null;
  }),
};

// Mock PrismaService
const mockPrismaService = {
  publication: {
    findMany: jest.fn() as any,
    update: jest.fn() as any,
    updateMany: jest.fn(() => Promise.resolve({ count: 0 })) as any,
    findUnique: jest.fn() as any,
  },
  post: {
    update: jest.fn() as any,
    updateMany: jest.fn(() => Promise.resolve({ count: 0 })) as any,
    findMany: jest.fn() as any,
  },
};

// Mock SocialPostingService
const mockSocialPostingService = {
  publishPublication: jest.fn(),
};

// Mock NotificationsService
const mockNotificationsService = {
  create: jest.fn() as any,
};

const mockRedisService = {
  acquireLock: jest.fn() as any,
  releaseLock: jest.fn() as any,
};

describe('PublicationSchedulerService', () => {
  let service: PublicationSchedulerService;
  let prisma: typeof mockPrismaService;
  let socialPostingService: typeof mockSocialPostingService;
  let module: TestingModule | undefined;

  beforeEach(async () => {
    mockRedisService.acquireLock.mockResolvedValue('test-lock-token');
    mockRedisService.releaseLock.mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      providers: [
        PublicationSchedulerService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SocialPostingService, useValue: mockSocialPostingService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<PublicationSchedulerService>(PublicationSchedulerService);
    prisma = module.get(PrismaService);
    socialPostingService = module.get(SocialPostingService);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
  });

  it('should mark publication as EXPIRED if scheduledAt is too old and no posts', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 20 * 60000);

    mockPrismaService.publication.findMany
      .mockResolvedValueOnce([
        { id: 'pub1', status: PublicationStatus.SCHEDULED, scheduledAt: oldDate },
      ])
      .mockResolvedValueOnce([]);

    mockPrismaService.post.findMany.mockResolvedValue([]);
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.runNow();

    expect(prisma.publication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['pub1'] } },
      data: { status: PublicationStatus.EXPIRED },
    });
    expect(socialPostingService.publishPublication).not.toHaveBeenCalled();
  });

  it('should publish publication if scheduledAt is within window', async () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60000);

    mockPrismaService.publication.findMany.mockResolvedValue([
      { id: 'pub1', status: PublicationStatus.SCHEDULED, scheduledAt: recentDate },
    ]);

    mockPrismaService.post.findMany.mockResolvedValue([]);
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.runNow();

    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub1', {
      skipLock: true,
    });
  });

  it('should mark old posts as EXPIRED and publish valid posts', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 20 * 60000);
    const validDate = new Date(now.getTime() - 1 * 60000);

    mockPrismaService.publication.findMany.mockResolvedValue([
      { id: 'pub1', status: PublicationStatus.SCHEDULED, scheduledAt: oldDate },
      { id: 'pub2', status: PublicationStatus.SCHEDULED, scheduledAt: validDate },
    ]);

    mockPrismaService.post.findMany.mockResolvedValue([
      { id: 'post1', scheduledAt: oldDate, status: PostStatus.PENDING },
    ]);

    mockPrismaService.post.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.runNow();

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['post1'] } },
      data: { status: PostStatus.FAILED, errorMessage: 'EXPIRED' },
    });

    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub2', {
      skipLock: true,
    });
  });

  it('should default to Publication.scheduledAt if Post.scheduledAt is missing', async () => {
    const now = new Date();
    const validDate = new Date(now.getTime() - 1 * 60000);

    mockPrismaService.publication.findMany.mockResolvedValue([
      { id: 'pub1', status: PublicationStatus.SCHEDULED, scheduledAt: validDate },
    ]);

    mockPrismaService.post.findMany.mockResolvedValue([]);
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.runNow();

    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub1', {
      skipLock: true,
    });
  });
});
