import { Test, type TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway.js';
import { jest } from '@jest/globals';
import { NotificationType } from '../../src/generated/prisma/index.js';

describe('NotificationsService (unit)', () => {
  let service: NotificationsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    notification: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
      deleteMany: jest.fn() as any,
      count: jest.fn() as any,
    },
  };

  const mockGateway = {
    sendToUser: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = moduleRef.get<NotificationsService>(NotificationsService);

    // Silence logger for tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification and notify user via gateway', async () => {
      const dto = {
        userId: 'user-1',
        type: NotificationType.SYSTEM,
        title: 'Title',
        message: 'Message',
        meta: { foo: 'bar' },
      };

      const mockNotification = { id: 'notif-1', ...dto, createdAt: new Date(), readAt: null };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create(dto);

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: dto.userId,
          type: dto.type,
          title: dto.title,
          message: dto.message,
          meta: dto.meta,
        },
      });
      expect(mockGateway.sendToUser).toHaveBeenCalledWith(dto.userId, mockNotification);
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications for a user', async () => {
      const userId = 'user-1';
      const filters = { limit: 10, offset: 0 };
      const mockItems = [{ id: '1' }, { id: '2' }];
      const mockTotal = 2;

      mockPrismaService.notification.findMany.mockResolvedValue(mockItems);
      mockPrismaService.notification.count.mockResolvedValue(mockTotal);

      const result = await service.findAll(userId, filters);

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(mockTotal);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      });
    });

    it('should filter by isRead status', async () => {
      const userId = 'user-1';
      const filters = { isRead: false };

      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll(userId, filters);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, readAt: null },
        }),
      );
    });

    it('should filter by type', async () => {
      const userId = 'user-1';
      const filters = { type: NotificationType.PUBLICATION_FAILED };

      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll(userId, filters);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, type: NotificationType.PUBLICATION_FAILED },
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const userId = 'user-1';
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId, readAt: null },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const id = 'notif-1';
      const userId = 'user-1';
      const mockNotification = { id, userId, readAt: null };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        readAt: new Date(),
      });

      await service.markAsRead(id, userId);

      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if notification belongs to another user', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue({ id: '1', userId: 'user-2' });

      await expect(service.markAsRead('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const userId = 'user-1';
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead(userId);

      expect(result.count).toBe(3);
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old read notifications', async () => {
      const olderThanDays = 30;
      mockPrismaService.notification.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupOldNotifications(olderThanDays);

      expect(mockPrismaService.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          readAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
