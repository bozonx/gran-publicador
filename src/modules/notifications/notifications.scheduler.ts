import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.debug('Starting notifications cleanup job');

    // Get cleanup days from config, default to 30
    const cleanupDays = this.configService.get<number>('NOTIFICATIONS_CLEANUP_DAYS', 30);

    await this.notificationsService.cleanupOldNotifications(cleanupDays);
  }
}
