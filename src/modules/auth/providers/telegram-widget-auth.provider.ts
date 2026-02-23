import { createHash, createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { TelegramWidgetLoginDto } from '../dto/index.js';
import type { AuthProviderResult } from './auth-provider-result.interface.js';

@Injectable()
export class TelegramWidgetAuthProvider {
  private readonly logger = new Logger(TelegramWidgetAuthProvider.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('app.telegramBotToken');
    if (!token) {
      throw new Error('Telegram Bot Token is not defined in config (app.telegramBotToken)');
    }
    this.botToken = token;
  }

  public validateWidgetData(data: TelegramWidgetLoginDto): AuthProviderResult {
    const isValid = this.validateTelegramWidgetData(data);
    if (!isValid) {
      this.logger.warn('Invalid Telegram widget data');
      throw new Error('Invalid Telegram widget data');
    }

    return {
      telegramId: BigInt(data.id),
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      avatarUrl: data.photo_url,
    };
  }

  private validateTelegramWidgetData(data: TelegramWidgetLoginDto): boolean {
    const { hash, ...rest } = data;

    const now = Math.floor(Date.now() / 1000);

    if (typeof data.auth_date !== 'number' || data.auth_date < 0) {
      this.logger.warn('Invalid auth_date value');
      return false;
    }

    if (data.auth_date > now + 300) {
      this.logger.warn('auth_date is in the future');
      return false;
    }

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
}
