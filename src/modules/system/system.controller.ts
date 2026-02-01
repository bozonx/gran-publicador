import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PublicationSchedulerService } from '../social-posting/publication-scheduler.service.js';
import { NewsNotificationsScheduler } from '../news-queries/news-notifications.scheduler.js';
import { LocalNetworkGuard } from '../../common/guards/local-network.guard.js';
import { SystemAuthGuard } from '../../common/guards/system-auth.guard.js';

@Controller('system/schedulers')
@UseGuards(LocalNetworkGuard, SystemAuthGuard)
export class SystemController {
  constructor(
    private readonly publicationScheduler: PublicationSchedulerService,
    private readonly newsScheduler: NewsNotificationsScheduler,
  ) {}

  @Post('publications/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  public async triggerPublications() {
    // Trigger asynchronously to avoid timeouts if the run takes too long
    void this.publicationScheduler.handleCron();
    return { status: 'triggered', scheduler: 'publications' };
  }

  @Post('news/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  public async triggerNews() {
    // Trigger asynchronously to avoid timeouts
    void this.newsScheduler.handleNewsNotifications();
    return { status: 'triggered', scheduler: 'news' };
  }
}
