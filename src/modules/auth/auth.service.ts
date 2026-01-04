import { createHash, createHmac } from 'node:crypto';

import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';

import { UserDto } from '../users/dto/user.dto.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponseDto, TelegramWidgetLoginDto } from './dto/index.js';

/**
 * Interface representing the structure of a Telegram user object received in initData.
 */
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Service responsible for authentication logic.
 * Handles Telegram login, token generation, and user profile retrieval.
 */
@Injectable()
export class AuthService {
  private readonly botToken: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const token = this.configService.get<string>('app.telegramBotToken');
    if (!token) {
      throw new Error('Telegram Bot Token is not defined in config (app.telegramBotToken)');
    }
    this.botToken = token;
  }

  /**
   * Authenticate a user via Telegram Mini App init data.
   * Validates the data signature and creates/updates the user.
   *
   * @param initData - The raw query string received from the Telegram Mini App.
   * @returns An object containing the JWT access token and user details.
   * @throws UnauthorizedException if data validation fails or user is missing.
   */
  public async loginWithTelegram(initData: string): Promise<AuthResponseDto> {
    const isValid = this.validateTelegramInitData(initData);
    if (!isValid) {
      this.logger.warn('Invalid Telegram init data');
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    const searchParams = new URLSearchParams(initData);
    const userStr = searchParams.get('user');
    if (!userStr) {
      throw new UnauthorizedException('User data missing in Telegram init data');
    }

    let tgUser: TelegramUser;
    try {
      tgUser = JSON.parse(userStr) as TelegramUser;
    } catch (error) {
      this.logger.error('Failed to parse Telegram user data', error);
      throw new UnauthorizedException('Invalid user data format');
    }

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(tgUser.id),
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      avatarUrl: tgUser.photo_url,
    });

    if (user.isBanned) {
      throw new ForbiddenException(`User is banned: ${user.banReason || 'Access denied'}`);
    }

    const payload = {
      sub: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    };

    return plainToInstance(
      AuthResponseDto,
      {
        accessToken: this.jwtService.sign(payload),
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Authenticate a user via Telegram Login Widget data.
   * Validates the data signature and creates/updates the user.
   *
   * @param widgetData - The data object received from the Telegram Login Widget.
   * @returns An object containing the JWT access token and user details.
   * @throws UnauthorizedException if data validation fails.
   */
  public async loginWithTelegramWidget(
    widgetData: TelegramWidgetLoginDto,
  ): Promise<AuthResponseDto> {
    const isValid = this.validateTelegramWidgetData(widgetData);
    if (!isValid) {
      this.logger.warn('Invalid Telegram widget data');
      throw new UnauthorizedException('Invalid Telegram widget data');
    }

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(widgetData.id),
      username: widgetData.username,
      firstName: widgetData.first_name,
      lastName: widgetData.last_name,
      avatarUrl: widgetData.photo_url,
    });

    if (user.isBanned) {
      throw new ForbiddenException(`User is banned: ${user.banReason || 'Access denied'}`);
    }

    const payload = {
      sub: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    };

    return plainToInstance(
      AuthResponseDto,
      {
        accessToken: this.jwtService.sign(payload),
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Validate the integrity of data received from Telegram Login Widget.
   * Implements the HMAC-SHA256 signature verification described in Telegram documentation.
   *
   * @param data - The data object to validate.
   * @returns true if the signature is valid and not expired, false otherwise.
   */
  private validateTelegramWidgetData(data: TelegramWidgetLoginDto): boolean {
    const { hash, ...rest } = data;

    // Check if auth_date is older than 24 hours
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400) {
      this.logger.warn('Telegram widget data expired');
      return false;
    }

    const dataCheckArr = Object.entries(rest)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHash('sha256').update(this.botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckArr).digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Validate the integrity of data received from Telegram.
   * Implements the HMAC-SHA256 signature verification described in Telegram documentation.
   *
   * @param initData - The raw query string to validate.
   * @returns true if the signature is valid, false otherwise.
   */
  private validateTelegramInitData(initData: string): boolean {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const params = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(this.botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(params).digest('hex');

    return calculatedHash === hash;
  }

  public async getProfile(userId: string): Promise<UserDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Development login to bypass Telegram validation.
   * Only works in development environment.
   */
  public async loginDev(telegramId: number): Promise<AuthResponseDto> {
    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(telegramId),
      username: 'dev_user',
      firstName: 'Dev',
      lastName: 'User',
    });

    const payload = {
      sub: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    };

    return plainToInstance(
      AuthResponseDto,
      {
        accessToken: this.jwtService.sign(payload),
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }
}
