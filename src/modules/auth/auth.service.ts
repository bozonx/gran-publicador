import { createHash } from 'node:crypto';

import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';

import { UserDto } from '../users/dto/user.dto.js';
import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthResponseDto, TelegramWidgetLoginDto } from './dto/index.js';
import { TelegramMiniAppAuthProvider, TelegramWidgetAuthProvider } from './providers/index.js';

/**
 * Service responsible for authentication logic.
 * Handles Telegram login, token generation, and user profile retrieval.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private prisma: PrismaService,
    private telegramMiniAppAuthProvider: TelegramMiniAppAuthProvider,
    private telegramWidgetAuthProvider: TelegramWidgetAuthProvider,
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

    const tokens = await this.getTokens(
      user.id,
      user.telegramId?.toString(),
      user.telegramUsername,
    );
    await this.createSession(user.id, tokens.refreshToken);

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

    const tokens = await this.getTokens(
      user.id,
      user.telegramId?.toString(),
      user.telegramUsername,
    );
    await this.createSession(user.id, tokens.refreshToken);

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

    const tokens = await this.getTokens(
      user.id,
      user.telegramId?.toString(),
      user.telegramUsername,
    );
    await this.createSession(user.id, tokens.refreshToken);

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
    const secret = this.configService.get<string>('app.jwtSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret,
      });

      if (!payload?.sub || typeof payload.sub !== 'string') {
        throw new ForbiddenException('Access Denied (Invalid refresh token payload)');
      }

      userId = payload.sub;
    } catch {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { hashedRefreshToken: refreshTokenHash },
      include: { user: true },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new ForbiddenException('Access Denied (Refresh token expired)');
    }

    if (session.user.deletedAt) {
      throw new ForbiddenException('Access Denied (Invalid user or account deleted)');
    }

    const tokens = await this.getTokens(
      session.user.id,
      session.user.telegramId?.toString(),
      session.user.telegramUsername,
    );

    await this.rotateSession(session.id, tokens.refreshToken);

    return plainToInstance(
      AuthResponseDto,
      {
        ...tokens,
        user: session.user,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async logout(userId: string, refreshToken: string): Promise<void> {
    const secret = this.configService.get<string>('app.jwtSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let tokenUserId: string;
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret,
      });

      if (!payload?.sub || typeof payload.sub !== 'string') {
        throw new ForbiddenException('Access Denied (Invalid refresh token payload)');
      }

      tokenUserId = payload.sub;
    } catch {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    if (tokenUserId !== userId) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        hashedRefreshToken: refreshTokenHash,
      },
    });
  }

  private async getTokens(userId: string, telegramId?: string, username?: string | null) {
    const payload = {
      sub: userId,
      telegramId,
      telegramUsername: username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('app.jwtSecret'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('app.jwtSecret'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRefreshTokenExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }

  private async createSession(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        userId,
        hashedRefreshToken: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
      },
    });
  }

  private async rotateSession(sessionId: string, refreshToken: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        hashedRefreshToken: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
      },
    });
  }
}
