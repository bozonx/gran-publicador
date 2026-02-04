import { Test, type TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { jest } from '@jest/globals';

describe('AuthService (unit)', () => {
  let service: AuthService;
  let moduleRef: TestingModule;

  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  const mockUsersService = {
    findOrCreateTelegramUser: jest.fn() as any,
    findById: jest.fn() as any,
    updateHashedRefreshToken: jest.fn() as any,
  };

  const mockJwtService = {
    sign: jest.fn() as any,
    signAsync: jest.fn() as any,
    verifyAsync: jest.fn() as any,
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (
        key === 'AUTH_TELEGRAM_BOT_TOKEN' ||
        key === 'TELEGRAM_BOT_TOKEN' ||
        key === 'app.telegramBotToken'
      ) {
        return mockBotToken;
      }
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
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
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

  // Helper to generate valid Telegram Init Data
  function generateValidInitData(user: object) {
    const userStr = JSON.stringify(user);
    const params = {
      auth_date: Math.floor(Date.now() / 1000).toString(),
      user: userStr,
    };

    const dataCheckString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(mockBotToken).digest();
    const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return new URLSearchParams({ ...params, hash }).toString();
  }

  describe('loginWithTelegram', () => {
    const telegramUser = {
      id: 123456789,
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      photo_url: 'http://example.com/photo.jpg',
    };

    it('should successfully authenticate with valid initData', async () => {
      const initData = generateValidInitData(telegramUser);
      const mockUser = {
        id: 'user-uuid',
        firstName: 'John',
        lastName: 'Doe',
        telegramId: 123456789n,
        telegramUsername: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUsersService.findOrCreateTelegramUser.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock.access.token')
        .mockResolvedValueOnce('mock.refresh.token');
      mockUsersService.updateHashedRefreshToken.mockResolvedValue(undefined);

      const result = await service.loginWithTelegram(initData);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock.refresh.token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(mockUsersService.findOrCreateTelegramUser).toHaveBeenCalledWith({
        telegramId: 123456789n,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/photo.jpg',
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(mockUsersService.updateHashedRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if hash is invalid', async () => {
      const authDate = Math.floor(Date.now() / 1000);
      const initData = `user=%7B%22id%22%3A123%7D&hash=invalid_hash&auth_date=${authDate}`;

      await expect(service.loginWithTelegram(initData)).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.findOrCreateTelegramUser).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if auth_date is expired', async () => {
      // Date older than 24h
      const expiredDate = Math.floor(Date.now() / 1000) - 100000;
      const params = {
        auth_date: expiredDate.toString(),
        user: JSON.stringify(telegramUser),
      };

      const dataCheckString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n');

      const secretKey = createHmac('sha256', 'WebAppData').update(mockBotToken).digest();
      const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      const initData = new URLSearchParams({ ...params, hash }).toString();

      await expect(service.loginWithTelegram(initData)).rejects.toThrow(
        'Invalid Telegram init data',
      );
    });

    it('should throw UnauthorizedException if user data is missing', async () => {
      // Generate hash for data without user field but with fresh date
      const authDate = Math.floor(Date.now() / 1000).toString();
      const _params = { auth_date: authDate };
      const dataCheckString = `auth_date=${authDate}`;
      const secretKey = createHmac('sha256', 'WebAppData').update(mockBotToken).digest();
      const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      const initData = `auth_date=${authDate}&hash=${hash}`;

      await expect(service.loginWithTelegram(initData)).rejects.toThrow('User data missing');
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
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        telegramId: 1n,
        telegramUsername: 'u',
        hashedRefreshToken: 'hashed',
        deletedAt: null,
      });

      const { createHash } = await import('node:crypto');
      const hashed = createHash('sha256').update('refresh.token').digest('hex');
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        telegramId: 1n,
        telegramUsername: 'u',
        hashedRefreshToken: hashed,
        deletedAt: null,
      });

      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access')
        .mockResolvedValueOnce('new.refresh');
      mockUsersService.updateHashedRefreshToken.mockResolvedValue(undefined);

      const result = await service.refreshTokens('refresh.token');

      expect(result.accessToken).toBe('new.access');
      expect(result.refreshToken).toBe('new.refresh');
      expect(mockJwtService.verifyAsync).toHaveBeenCalled();
      expect(mockUsersService.updateHashedRefreshToken).toHaveBeenCalled();
    });

    it('should throw if refresh token is invalid', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refreshTokens('bad.token')).rejects.toThrow('Access Denied');
    });
  });
});
