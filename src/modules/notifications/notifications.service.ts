import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { CreateNotificationDto, NotificationFilterDto } from './dto/index.js';
import { NotificationType, Prisma } from '../../generated/prisma/index.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  /**
   * Create a new notification and send it via WebSocket if user is online.
   */
  async create(data: CreateNotificationDto) {
    if (!data.userId || !data.type || !data.message) {
      throw new Error('Missing required notification fields');
    }

    const notification = await this.prisma.notification.create({
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
}
