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
  };

  const mockJwtService = {
    sign: jest.fn() as any,
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
      mockJwtService.sign.mockReturnValue('mock.jwt.token');

      const result = await service.loginWithTelegram(initData);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(mockUsersService.findOrCreateTelegramUser).toHaveBeenCalledWith({
        telegramId: 123456789n,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/photo.jpg',
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        telegramId: '123456789',
        telegramUsername: mockUser.telegramUsername,
      });
    });

    it('should throw UnauthorizedException if hash is invalid', async () => {
      const initData = 'user=%7B%22id%22%3A123%7D&hash=invalid_hash&auth_date=1234567890';

      await expect(service.loginWithTelegram(initData)).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.findOrCreateTelegramUser).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user data is missing', async () => {
      // Generate hash for data without user field
      const _params = { auth_date: '1234567890' };
      const dataCheckString = 'auth_date=1234567890';
      const secretKey = createHmac('sha256', 'WebAppData').update(mockBotToken).digest();
      const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      const initData = `auth_date=1234567890&hash=${hash}`;

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
});
