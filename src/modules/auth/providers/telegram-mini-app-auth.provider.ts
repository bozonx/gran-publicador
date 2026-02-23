import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthProviderResult } from './auth-provider-result.interface.js';

interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

@Injectable()
export class TelegramMiniAppAuthProvider {
  private readonly logger = new Logger(TelegramMiniAppAuthProvider.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('app.telegramBotToken');
    if (!token) {
      throw new Error('Telegram Bot Token is not defined in config (app.telegramBotToken)');
    }
    this.botToken = token;
  }

  public validateInitData(initData: string): AuthProviderResult {
    const isValid = this.validateTelegramInitData(initData);
    if (!isValid) {
      this.logger.warn('Invalid Telegram init data');
      throw new Error('Invalid Telegram init data');
    }

    const searchParams = new URLSearchParams(initData);
    const userStr = searchParams.get('user');
    if (!userStr) {
      throw new Error('User data missing in Telegram init data');
    }

    let tgUser: TelegramInitDataUser;
    try {
      tgUser = JSON.parse(userStr) as TelegramInitDataUser;
    } catch (error) {
      this.logger.error('Failed to parse Telegram user data', error as any);
      throw new Error('Invalid user data format');
    }

    return {
      telegramId: BigInt(tgUser.id),
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      avatarUrl: tgUser.photo_url,
      languageCode: tgUser.language_code,
    };
  }

  private validateTelegramInitData(initData: string): boolean {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    const authDate = urlParams.get('auth_date');

    if (!hash) {
      this.logger.warn('Telegram init data missing hash');
      return false;
    }

    if (!authDate) {
      this.logger.warn('Telegram init data missing auth_date');
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const authDateNum = Number(authDate);

    if (isNaN(authDateNum) || authDateNum < 0) {
      this.logger.warn('Invalid auth_date value');
      return false;
    }

    if (authDateNum > now + 300) {
      this.logger.warn('auth_date is in the future');
      return false;
    }

    if (now - authDateNum > 86400) {
      this.logger.warn('Telegram init data expired');
      return false;
    }

    urlParams.delete('hash');

    const params = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(this.botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(params).digest('hex');

    return calculatedHash === hash;
  }
}
