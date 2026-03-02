import { Test, type TestingModule } from '@nestjs/testing';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SystemController } from '../../src/modules/system/system.controller.js';
import { PublicationSchedulerService } from '../../src/modules/social-posting/publication-scheduler.service.js';
import { NewsNotificationsScheduler } from '../../src/modules/news-queries/news-notifications.scheduler.js';
import { NotificationsScheduler } from '../../src/modules/notifications/notifications.scheduler.js';
import { TagsService } from '../../src/modules/tags/tags.service.js';
import { SystemOrAdminGuard } from '../../src/modules/system/system-or-admin.guard.js';
import { LocalNetworkGuard } from '../../src/common/guards/local-network.guard.js';
import { SystemAuthGuard } from '../../src/common/guards/system-auth.guard.js';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard.js';
import { UsersService } from '../../src/modules/users/users.service.js';

describe('SystemController (unit)', () => {
  let controller: SystemController;

  const mockPublicationScheduler = { runNow: jest.fn() as any };
  const mockNewsScheduler = { runNow: jest.fn() as any };
  const mockNotificationsScheduler = { runCleanupNow: jest.fn() as any };
  const mockTagsService = { cleanupOrphanedTags: jest.fn() as any };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        { provide: PublicationSchedulerService, useValue: mockPublicationScheduler },
        { provide: NewsNotificationsScheduler, useValue: mockNewsScheduler },
        { provide: NotificationsScheduler, useValue: mockNotificationsScheduler },
        { provide: TagsService, useValue: mockTagsService },
        // Mocking guard dependencies to avoid instantiation issues
        { provide: LocalNetworkGuard, useValue: {} },
        { provide: SystemAuthGuard, useValue: {} },
        { provide: JwtAuthGuard, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<SystemController>(SystemController);

    jest.clearAllMocks();
  });

  describe('triggerPublications', () => {
    it('should call publication scheduler', async () => {
      mockPublicationScheduler.runNow.mockResolvedValue({ processed: 5 });
      const result = await controller.triggerPublications();
      expect(result.scheduler).toBe('publications');
      expect(result.result.processed).toBe(5);
    });
  });

  describe('triggerNews', () => {
    it('should call news scheduler', async () => {
      mockNewsScheduler.runNow.mockResolvedValue({ sent: 10 });
      const result = await controller.triggerNews();
      expect(result.scheduler).toBe('news');
    });
  });

  describe('runMaintenance', () => {
    it('should call cleanup methods', async () => {
      mockNotificationsScheduler.runCleanupNow.mockResolvedValue({ deleted: 100 });
      mockTagsService.cleanupOrphanedTags.mockResolvedValue({ count: 10 });

      const result = await controller.runMaintenance();

      expect(result.scheduler).toBe('maintenance');
      expect(result.result.tagsCleanup.deletedCount).toBe(10);
    });
  });
});
