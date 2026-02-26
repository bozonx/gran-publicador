import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PublicationSchedulerService } from '../social-posting/publication-scheduler.service.js';
import { NewsNotificationsScheduler } from '../news-queries/news-notifications.scheduler.js';
import { NotificationsScheduler } from '../notifications/notifications.scheduler.js';
import { TagsService } from '../tags/tags.service.js';
import { SystemOrAdminGuard } from './system-or-admin.guard.js';

@Controller('system/schedulers')
@UseGuards(SystemOrAdminGuard)
export class SystemController {
  constructor(
    private readonly publicationScheduler: PublicationSchedulerService,
    private readonly newsScheduler: NewsNotificationsScheduler,
    private readonly notificationsScheduler: NotificationsScheduler,
    private readonly tagsService: TagsService,
  ) {}

  @Post('publications/run')
  @HttpCode(HttpStatus.OK)
  public async triggerPublications() {
    const result = await this.publicationScheduler.runNow();
    return {
      status: 'completed',
      scheduler: 'publications',
      result,
    };
  }

  @Post('news/run')
  @HttpCode(HttpStatus.OK)
  public async triggerNews() {
    const result = await this.newsScheduler.runNow();
    return {
      status: 'completed',
      scheduler: 'news',
      result,
    };
  }

  @Post('maintenance/run')
  @HttpCode(HttpStatus.OK)
  public async runMaintenance() {
    const notificationsCleanup = await this.notificationsScheduler.runCleanupNow();
    const tagsCleanup = await this.tagsService.cleanupOrphanedTags();

    return {
      status: 'completed',
      scheduler: 'maintenance',
      result: {
        notificationsCleanup,
        tagsCleanup: {
          deletedCount: tagsCleanup.count,
        },
      },
    };
  }
}
