import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { UsersService } from '../../src/modules/users/users.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { UserSortBy } from '../../src/modules/users/dto/user.dto.js';
import { SortOrder } from '../../src/common/dto/pagination-query.dto.js';

describe('UsersService (unit)', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn() as any,
      findUniqueOrThrow: jest.fn() as any,
      findMany: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
      upsert: jest.fn() as any,
      count: jest.fn() as any,
      delete: jest.fn() as any,
    },
    userSession: {
      deleteMany: jest.fn() as any,
    },
    apiToken: {
      deleteMany: jest.fn() as any,
    },
    project: {
      findMany: jest.fn() as any,
    },
    $transaction: jest.fn((args: any) => (Array.isArray(args) ? Promise.all(args) : args)) as any,
  };

  const mockConfigService = {
    get: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('findByTelegramId', () => {
    it('should return user with isSuperAdmin flag', async () => {
      const telegramId = BigInt(123456789);
      const mockUser = { id: 'u1', telegramId };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue({ adminTelegramId: '123456789' });

      const result = await service.findByTelegramId(telegramId);

      expect(result).toEqual({ ...mockUser, isSuperAdmin: true });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { telegramId } });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const result = await service.findByTelegramId(BigInt(999));
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return user with stats', async () => {
      const mockUser = {
        id: 'u1',
        fullName: 'Ivan',
        _count: { ownedProjects: 2, publications: 10 },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findOne('u1');
      expect(result?.projectsCount).toBe(2);
      expect(result?.publicationsCount).toBe(10);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
      const result = await service.findById('u1');
      expect(result?.id).toBe('u1');
    });
  });

  describe('deletePermanently', () => {
    it('should call prisma delete', async () => {
      await service.deletePermanently('u1');
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });

  describe('logoutUser', () => {
    it('should delete user sessions', async () => {
      await service.logoutUser('u1');
      expect(mockPrismaService.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('findOrCreateTelegramUser', () => {
    it('should upsert user and return with flags', async () => {
      const userData = {
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = {
        id: 'u1',
        telegramId: userData.telegramId,
        telegramUsername: 'testuser',
        fullName: 'Test User',
      };

      mockPrismaService.user.upsert.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue({ adminTelegramId: '123456789' });

      const result = await service.findOrCreateTelegramUser(userData);

      expect(result).toEqual({ ...mockUser, isSuperAdmin: true });
      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: userData.telegramId },
          create: expect.objectContaining({
            isAdmin: true,
            fullName: 'Test User',
          }),
        }),
      );
    });

    it('should use username if firstName and lastName are missing', async () => {
      const userData = {
        telegramId: BigInt(123),
        username: 'onlyusername',
      };

      mockPrismaService.user.upsert.mockResolvedValue({ id: 'u1' });

      await service.findOrCreateTelegramUser(userData);

      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            fullName: 'onlyusername',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users with counts', async () => {
      const query = {
        limit: 10,
        offset: 0,
        sortBy: UserSortBy.CREATED_AT,
        sortOrder: SortOrder.DESC,
      };

      const mockUsers = [
        { id: '1', _count: { ownedProjects: 1, publications: 5 } },
        { id: '2', _count: { ownedProjects: 0, publications: 2 } },
      ];

      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockConfigService.get.mockReturnValue({});

      const result = await service.findAll(query);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: '1',
          projectsCount: 1,
          publicationsCount: 5,
        }),
      );
    });

    it('should filter by search and isAdmin', async () => {
      const query = {
        search: 'ivan',
        isAdmin: true,
      };

      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(query as any);

      expect(mockPrismaService.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isAdmin: true,
            OR: [
              { fullName: { contains: 'ivan', mode: 'insensitive' } },
              { telegramUsername: { contains: 'ivan', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('updateProfile', () => {
    it('should merge preferences and update user', async () => {
      const userId = 'u1';
      const existingUser = {
        id: userId,
        preferences: { old: 'val', newsQueryOrder: ['q1'] },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({ ...existingUser, fullName: 'New Name' });

      const result = await service.updateProfile(userId, {
        fullName: 'New Name',
        newsQueryOrder: ['q1', 'q2'],
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({
            fullName: 'New Name',
            preferences: expect.objectContaining({
              old: 'val',
              newsQueryOrder: ['q1', 'q2'],
            }),
          }),
        }),
      );
    });

    it('should handle optimistic locking and throw ConflictException on version mismatch', async () => {
      const userId = 'u1';
      mockPrismaService.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateProfile(userId, { fullName: 'Name', version: 1 } as any),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId, version: 1 },
        }),
      );
    });
  });

  describe('ban/unban', () => {
    it('should ban user', async () => {
      mockPrismaService.user.update.mockResolvedValue({ id: 'u1', isBanned: true });
      const result = await service.banUser('u1', 'spam');
      expect(result?.isBanned).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isBanned: true, banReason: 'spam' } }),
      );
    });

    it('should unban user', async () => {
      mockPrismaService.user.update.mockResolvedValue({ id: 'u1', isBanned: false });
      const result = await service.unbanUser('u1');
      expect(result?.isBanned).toBe(false);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isBanned: false, banReason: null } }),
      );
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return preferences from notificationPreferences field', async () => {
      const userId = 'u1';
      const prefs = { telegramEnabled: true };
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPreferences: prefs,
      });

      const result = await service.getNotificationPreferences(userId);

      expect(result).toEqual(prefs);
    });

    it('should fallback to preferences.notifications (migration shim)', async () => {
      const userId = 'u1';
      const oldPrefs = { telegramEnabled: true };
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPreferences: null,
        preferences: { notifications: oldPrefs },
      });

      const result = await service.getNotificationPreferences(userId);

      expect(result).toEqual(oldPrefs);
    });

    it('should return default preferences if none found', async () => {
      const userId = 'u1';
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPreferences: {},
        preferences: {},
      });

      const result = await service.getNotificationPreferences(userId);

      expect(result).toHaveProperty('PUBLICATION_FAILED');
      expect(result.PUBLICATION_FAILED.telegram).toBe(true);
    });

    it('should update preferences', async () => {
      const userId = 'u1';
      const dto = { PUBLICATION_FAILED: { internal: true, telegram: false } };
      mockPrismaService.user.update.mockResolvedValue({ id: userId });
      
      const result = await service.updateNotificationPreferences(userId, dto as any);
      
      expect(result).toEqual(dto);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });

  describe('language normalization', () => {
    it('should normalize language code on update', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u1', preferences: {} });
      mockPrismaService.user.update.mockResolvedValue({ id: 'u1' });

      await service.updateProfile('u1', { language: 'RU' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ language: 'ru-RU' }), // Assuming normalizeLocale works this way
        }),
      );
    });
  });
});
