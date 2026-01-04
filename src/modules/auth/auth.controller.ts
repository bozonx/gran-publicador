import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JWT_STRATEGY } from '../../common/constants/auth.constants.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import { AuthService } from './auth.service.js';
import { TelegramLoginDto, TelegramWidgetLoginDto } from './dto/index.js';

/**
 * Controller handling authentication endpoints.
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Log in using Telegram Mini App init data.
   * Returns a JWT token upon successful validation.
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  public async login(@Body() loginDto: TelegramLoginDto) {
    return this.authService.loginWithTelegram(loginDto.initData);
  }

  /**
   * Log in using Telegram Login Widget data.
   * Returns a JWT token upon successful validation.
   */
  @Post('telegram-widget')
  @HttpCode(HttpStatus.OK)
  public async loginWidget(@Body() loginDto: TelegramWidgetLoginDto) {
    return this.authService.loginWithTelegramWidget(loginDto);
  }

  /**
   * Get the authenticated user's profile.
   * Requires a valid JWT token.
   */
  @UseGuards(AuthGuard(JWT_STRATEGY))
  @Get('me')
  public async getProfile(@Request() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  /**
   * Dev login endpoint.
   */
  @Post('dev')
  @HttpCode(HttpStatus.OK)
  public async loginDev(@Body() body: { telegramId: number }) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Dev login not allowed in production');
    }
    return this.authService.loginDev(body.telegramId);
  }
}
