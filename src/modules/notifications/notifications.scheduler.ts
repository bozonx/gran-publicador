import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  public async runCleanupNow() {
    this.logger.debug('Starting notifications cleanup job');

    // Get cleanup days from config, default to 30
    const cleanupDays = this.configService.get<number>('NOTIFICATIONS_CLEANUP_DAYS', 30);

    const result = await this.notificationsService.cleanupOldNotifications(cleanupDays);
    return {
      cleanupDays,
      deletedCount: result.count,
    };
  }
}
