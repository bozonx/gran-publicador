import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { UserDto } from '../users/dto/user.dto.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponseDto, TelegramWidgetLoginDto } from './dto/index.js';
import { TelegramMiniAppAuthProvider, TelegramWidgetAuthProvider } from './providers/index.js';
import { SessionsService } from './sessions.service.js';

/**
 * Service responsible for authentication logic.
 * Handles Telegram login, token generation, and user profile retrieval.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private telegramMiniAppAuthProvider: TelegramMiniAppAuthProvider,
    private telegramWidgetAuthProvider: TelegramWidgetAuthProvider,
    private sessionsService: SessionsService,
  ) {}

  /**
   * Authenticate a user via Telegram Mini App init data.
   * Validates the data signature and creates/updates the user.
   *
   * @param initData - The raw query string received from the Telegram Mini App.
   * @returns An object containing the JWT access token and user details.
   * @throws UnauthorizedException if data validation fails or user is missing.
   */
  public async loginWithTelegram(initData: string): Promise<AuthResponseDto> {
    let profile;
    try {
      profile = this.telegramMiniAppAuthProvider.validateInitData(initData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UnauthorizedException(message);
    }

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: profile.telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      languageCode: profile.languageCode,
    });

    if (user.isBanned) {
      throw new ForbiddenException(`User is banned: ${user.banReason || 'Access denied'}`);
    }

    if (user.deletedAt) {
      throw new ForbiddenException('User account has been deleted');
    }

    const tokens = await this.sessionsService.createSessionAndIssueTokens({
      userId: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    });

    return plainToInstance(
      AuthResponseDto,
      {
        ...tokens,
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
    let profile;
    try {
      profile = this.telegramWidgetAuthProvider.validateWidgetData(widgetData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UnauthorizedException(message);
    }

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: profile.telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    });

    if (user.isBanned) {
      throw new ForbiddenException(`User is banned: ${user.banReason || 'Access denied'}`);
    }

    if (user.deletedAt) {
      throw new ForbiddenException('User account has been deleted');
    }

    const tokens = await this.sessionsService.createSessionAndIssueTokens({
      userId: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    });

    return plainToInstance(
      AuthResponseDto,
      {
        ...tokens,
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async getProfile(userId: string): Promise<UserDto> {
    const user = await this.usersService.findById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or account deleted');
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

    if (user.deletedAt) {
      throw new ForbiddenException('User account has been deleted');
    }

    const tokens = await this.sessionsService.createSessionAndIssueTokens({
      userId: user.id,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
    });

    return plainToInstance(
      AuthResponseDto,
      {
        ...tokens,
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    const { user, tokens } = await this.sessionsService.refreshSession(refreshToken);
    return plainToInstance(
      AuthResponseDto,
      {
        ...tokens,
        user: user,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async logout(userId: string, refreshToken: string): Promise<void> {
    await this.sessionsService.logout(userId, refreshToken);
  }
}
