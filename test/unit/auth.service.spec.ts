import { Test, type TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { TelegramMiniAppAuthProvider } from '../../src/modules/auth/providers/telegram-mini-app-auth.provider.js';
import { TelegramWidgetAuthProvider } from '../../src/modules/auth/providers/telegram-widget-auth.provider.js';

describe('AuthService (unit)', () => {
  let service: AuthService;
  let moduleRef: TestingModule;

  const mockUsersService = {
    findOrCreateTelegramUser: jest.fn() as any,
    findById: jest.fn() as any,
  };

  const mockPrismaService = {
    userSession: {
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
  };

  const mockJwtService = {
    sign: jest.fn() as any,
    signAsync: jest.fn() as any,
    verifyAsync: jest.fn() as any,
  };

  const mockTelegramMiniAppAuthProvider = {
    validateInitData: jest.fn() as any,
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'app.jwtSecret') {
        return 'test_jwt_secret_test_jwt_secret_test_jwt_secret';
      }
      return null;
    }),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TelegramMiniAppAuthProvider, useValue: mockTelegramMiniAppAuthProvider },
        { provide: TelegramWidgetAuthProvider, useValue: { validateWidgetData: jest.fn() as any } },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginWithTelegram', () => {
    it('should successfully authenticate with valid initData', async () => {
      const initData = 'initData';
      const mockUser = {
        id: 'user-uuid',
        firstName: 'John',
        lastName: 'Doe',
        telegramId: 123456789n,
        telegramUsername: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTelegramMiniAppAuthProvider.validateInitData.mockReturnValue({
        telegramId: 123456789n,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/photo.jpg',
        languageCode: 'en',
      });
      mockUsersService.findOrCreateTelegramUser.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock.access.token')
        .mockResolvedValueOnce('mock.refresh.token');
      mockPrismaService.userSession.create.mockResolvedValue(undefined);

      const result = await service.loginWithTelegram(initData);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock.refresh.token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(mockTelegramMiniAppAuthProvider.validateInitData).toHaveBeenCalledWith(initData);
      expect(mockUsersService.findOrCreateTelegramUser).toHaveBeenCalledWith({
        telegramId: 123456789n,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/photo.jpg',
        languageCode: 'en',
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.userSession.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if hash is invalid', async () => {
      mockTelegramMiniAppAuthProvider.validateInitData.mockImplementation(() => {
        throw new Error('Invalid Telegram init data');
      });

      await expect(service.loginWithTelegram('bad-init-data')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUsersService.findOrCreateTelegramUser).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user profile if user exists', async () => {
      const userId = 'user-1';
      const mockUser = {
        id: userId,
        telegramUsername: 'test',
        telegramId: 12345n,
      };
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.telegramUsername).toBe('test');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const userId = 'non-existent';
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.getProfile(userId)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should issue new tokens when refresh token is valid and matches stored hash', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      const { createHash } = await import('node:crypto');
      const hashed = createHash('sha256').update('refresh.token').digest('hex');

      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        hashedRefreshToken: hashed,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: {
          id: 'user-1',
          telegramId: 1n,
          telegramUsername: 'u',
          deletedAt: null,
        },
      });

      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access')
        .mockResolvedValueOnce('new.refresh');
      mockPrismaService.userSession.update.mockResolvedValue(undefined);

      const result = await service.refreshTokens('refresh.token');

      expect(result.accessToken).toBe('new.access');
      expect(result.refreshToken).toBe('new.refresh');
      expect(mockJwtService.verifyAsync).toHaveBeenCalled();
      expect(mockPrismaService.userSession.update).toHaveBeenCalled();
    });

    it('should throw if refresh token is invalid', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refreshTokens('bad.token')).rejects.toThrow('Access Denied');
    });
  });
});
