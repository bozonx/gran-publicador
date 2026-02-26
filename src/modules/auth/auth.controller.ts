import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import '@fastify/cookie';

import { JWT_STRATEGY } from '../../common/constants/auth.constants.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import type { AppConfig } from '../../config/app.config.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenDto, TelegramLoginDto, TelegramWidgetLoginDto } from './dto/index.js';

/**
 * Controller handling authentication endpoints.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  private getCookieOptions(appConfig: AppConfig) {
    const isProd = appConfig.nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'lax' | 'none',
      path: '/',
    };
  }

  private setAuthCookies(
    reply: FastifyReply,
    appConfig: AppConfig,
    tokens: { accessToken: string; refreshToken?: string },
  ) {
    const baseOptions = this.getCookieOptions(appConfig);

    reply.setCookie('access_token', tokens.accessToken, {
      ...baseOptions,
      maxAge: 15 * 60,
    });

    if (tokens.refreshToken) {
      reply.setCookie('refresh_token', tokens.refreshToken, {
        ...baseOptions,
        maxAge: 7 * 24 * 60 * 60,
      });
    }
  }

  private clearAuthCookies(reply: FastifyReply, appConfig: AppConfig) {
    const baseOptions = this.getCookieOptions(appConfig);
    reply.clearCookie('access_token', baseOptions);
    reply.clearCookie('refresh_token', baseOptions);
  }

  /**
   * Log in using Telegram Mini App init data.
   * Returns a JWT token upon successful validation.
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: TelegramLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.loginWithTelegram(loginDto.initData);
    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig) {
      this.setAuthCookies(reply, appConfig, result);
    }
    return result;
  }

  /**
   * Log in using Telegram Login Widget data.
   * Returns a JWT token upon successful validation.
   */
  @Post('telegram-widget')
  @HttpCode(HttpStatus.OK)
  public async loginWidget(
    @Body() loginDto: TelegramWidgetLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.loginWithTelegramWidget(loginDto);
    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig) {
      this.setAuthCookies(reply, appConfig, result);
    }
    return result;
  }

  /**
   * Refresh authentication tokens.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = dto.refreshToken ?? req?.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const result = await this.authService.refreshTokens(refreshToken);
    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig) {
      this.setAuthCookies(reply, appConfig, result);
    }
    return result;
  }

  /**
   * Logout user by removing refresh token.
   */
  @Post('logout')
  @UseGuards(AuthGuard(JWT_STRATEGY))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @Req() req: AuthenticatedRequest & any,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = dto.refreshToken ?? req?.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(req.user.sub, refreshToken);
    }

    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig) {
      this.clearAuthCookies(reply, appConfig);
    }
  }

  /**
   * Get the authenticated user's profile.
   * Requires a valid JWT token.
   */
  @UseGuards(AuthGuard(JWT_STRATEGY))
  @Get('me')
  public async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  /**
   * Dev login endpoint.
   */
  @Post('dev')
  @HttpCode(HttpStatus.OK)
  public async loginDev(
    @Body() body: { telegramId: number },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Dev login not allowed in production');
    }

    const result = await this.authService.loginDev(body.telegramId);
    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig) {
      this.setAuthCookies(reply, appConfig, result);
    }
    return result;
  }
}
