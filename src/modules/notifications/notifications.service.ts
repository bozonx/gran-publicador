import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { CreateNotificationDto, NotificationFilterDto } from './dto/index.js';
import { NotificationType, Prisma } from '../../generated/prisma/index.js';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    private telegramBotService: TelegramBotService,
    private usersService: UsersService,
  ) {}

  async create(data: CreateNotificationDto, tx?: Prisma.TransactionClient) {
    if (!data.userId || !data.type || !data.message) {
      throw new Error('Missing required notification fields');
    }

    const client = tx || this.prisma;
    const notification = await client.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        meta: (data.meta || {}) as any,
      },
    });

    // Notify user via WebSocket safely
    try {
      this.gateway.sendToUser(data.userId, notification);
    } catch (error: any) {
      this.logger.error(`Failed to send notification via WebSocket: ${error.message}`);
    }

    // Send to Telegram if enabled in user preferences
    await this.sendTelegramNotification(data.userId, data.type, data.title, data.message);

    return notification;
  }

  /**
   * Find all notifications for a user with optional filtering.
   */
  async findAll(userId: string, filters: NotificationFilterDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (filters.isRead !== undefined) {
      where.readAt = filters.isRead ? { not: null } : null;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  /**
   * Get unread count for a user.
   */
  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark all notifications of a user as read.
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Cleanup old read notifications.
   * @param olderThanDays - Number of days since readAt after which the notification is deleted.
   */
  async cleanupOldNotifications(olderThanDays: number) {
    const date = new Date();
    date.setDate(date.getDate() - olderThanDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        readAt: {
          lt: date,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old notifications`);
    }

    return result;
  }

  /**
   * Send notification to Telegram if user has enabled it for this notification type.
   */
  private async sendTelegramNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      // Get user notification preferences
      const preferences = await this.usersService.getNotificationPreferences(userId);

      // Check if Telegram notifications are enabled for this type
      if (!preferences[type]?.telegram) {
        this.logger.debug(`Telegram notifications disabled for user ${userId}, type ${type}`);
        return;
      }

      // Get user's Telegram ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });

      if (!user?.telegramId) {
        this.logger.debug(`User ${userId} does not have a Telegram ID`);
        return;
      }

      // Get bot instance
      const bot = this.telegramBotService.getBot();
      if (!bot) {
        this.logger.warn('Telegram bot is not initialized, cannot send notification');
        return;
      }

      // Format and send message
      const formattedMessage = `*${this.escapeMarkdown(title)}*\n\n${this.escapeMarkdown(message)}`;

      await bot.api.sendMessage(user.telegramId.toString(), formattedMessage, {
        parse_mode: 'MarkdownV2',
      });

      this.logger.debug(`Sent Telegram notification to user ${userId} (${user.telegramId})`);
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram notification: ${error.message}`, error.stack);
      // Don't throw - notification was already created in DB
    }
  }

  /**
   * Escape special characters for Telegram MarkdownV2.
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
