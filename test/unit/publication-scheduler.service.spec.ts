
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicationSchedulerService } from '../../src/modules/social-posting/publication-scheduler.service.js';
import { SocialPostingService } from '../../src/modules/social-posting/social-posting.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PostStatus, PublicationStatus } from '../../src/generated/prisma/client.js';

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key) => {
    if (key === 'app') {
      return {
        schedulerIntervalSeconds: 60,
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
    updateMany: jest.fn() as any,
  },
  post: {
    update: jest.fn() as any,
  },
};

// Mock SocialPostingService
const mockSocialPostingService = {
  publishPublication: jest.fn(),
};

describe('PublicationSchedulerService', () => {
  let service: PublicationSchedulerService;
  let prisma: typeof mockPrismaService;
  let socialPostingService: typeof mockSocialPostingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicationSchedulerService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SocialPostingService, useValue: mockSocialPostingService },
      ],
    }).compile();

    service = module.get<PublicationSchedulerService>(PublicationSchedulerService);
    prisma = module.get(PrismaService);
    socialPostingService = module.get(SocialPostingService);

    jest.clearAllMocks();
  });

  it('should mark publication as EXPIRED if scheduledAt is too old and no posts', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 20 * 60000); // 20 mins ago

    mockPrismaService.publication.findMany.mockResolvedValue([
      { id: 'pub1', status: PublicationStatus.SCHEDULED, scheduledAt: oldDate, posts: [] },
    ]);

    await service.handleCron();

    expect(prisma.publication.update).toHaveBeenCalledWith({
      where: { id: 'pub1' },
      data: { status: PublicationStatus.EXPIRED },
    });
    expect(socialPostingService.publishPublication).not.toHaveBeenCalled();
  });

  it('should publish publication if scheduledAt is within window', async () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60000); // 1 min ago

    mockPrismaService.publication.findMany.mockResolvedValue([
      { id: 'pub2', status: PublicationStatus.SCHEDULED, scheduledAt: recentDate, posts: [] },
    ]);
    
    // updateMany returns { count: 1 } to simulate successful lock
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.handleCron();

    expect(prisma.publication.updateMany).toHaveBeenCalled();
    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub2');
  });

  it('should mark old posts as EXPIRED and publish valid posts', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 20 * 60000); // 20 mins ago (Expired)
    const validDate = new Date(now.getTime() - 1 * 60000); // 1 min ago (Ready)

    const pub = {
      id: 'pub3',
      status: PublicationStatus.SCHEDULED,
      posts: [
        { id: 'post1', scheduledAt: oldDate, status: PostStatus.PENDING },
        { id: 'post2', scheduledAt: validDate, status: PostStatus.PENDING },
      ],
    };

    mockPrismaService.publication.findMany.mockResolvedValue([pub]);
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.handleCron();

    // Check post1 expired
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post1' },
      data: { status: PostStatus.FAILED, errorMessage: 'EXPIRED' },
    });

    // Check publication triggered because post2 is valid
    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub3');
  });

  it('should default to Publication.scheduledAt if Post.scheduledAt is missing', async () => {
    const now = new Date();
    const validDate = new Date(now.getTime() - 1 * 60000); 

    const pub = {
      id: 'pub4',
      status: PublicationStatus.SCHEDULED,
      scheduledAt: validDate, // Publication has valid date
      posts: [
        { id: 'post3', scheduledAt: null, status: PostStatus.PENDING }, // Post inherits date
      ],
    };

    mockPrismaService.publication.findMany.mockResolvedValue([pub]);
    mockPrismaService.publication.updateMany.mockResolvedValue({ count: 1 });

    await service.handleCron();

    expect(prisma.post.update).not.toHaveBeenCalled(); // No post expiries
    expect(socialPostingService.publishPublication).toHaveBeenCalledWith('pub4');
  });
});
