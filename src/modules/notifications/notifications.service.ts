import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { CreateNotificationDto, NotificationFilterDto } from './dto/index.js';
import { NotificationType, Prisma } from '../../generated/prisma/client.js';

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
    const notification = await (this.prisma as any).notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        meta: (data.meta || {}) as any,
      },
    });

    // Notify user via WebSocket
    this.gateway.sendToUser(data.userId, notification);

    return notification;
  }

  /**
   * Find all notifications for a user with optional filtering.
   */
  async findAll(userId: string, filters: NotificationFilterDto) {
    const where: any = {
      userId,
    };

    if (filters.isRead !== undefined) {
      where.readAt = filters.isRead ? { not: null } : null;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const [items, total] = await Promise.all([
      (this.prisma as any).notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      (this.prisma as any).notification.count({ where }),
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
    return (this.prisma as any).notification.count({
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
    const notification = await (this.prisma as any).notification.findUnique({
      where: { id },
    });

    if (notification?.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return (this.prisma as any).notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark all notifications of a user as read.
   */
  async markAllAsRead(userId: string) {
    return (this.prisma as any).notification.updateMany({
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

    const result = await (this.prisma as any).notification.deleteMany({
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
