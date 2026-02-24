import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webhookCallback } from 'grammy';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TelegramBotService } from './telegram-bot.service.js';
import { AppConfig } from '../../config/app.config.js';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly botService: TelegramBotService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  public async handleWebhook(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
    const bot = this.botService.getBot();
    const appConfig = this.configService.get<AppConfig>('app');

    if (!bot || !appConfig) {
      this.logger.error('Telegram Bot or Config is not initialized');
      return res.status(503).send({ error: 'Telegram Bot is not initialized' });
    }

    if (!appConfig.telegramBotUseWebhook) {
      this.logger.warn('Received webhook request but webhook mode is disabled');
      return res.status(404).send({ error: 'Webhook mode is disabled' });
    }

    // grammy's webhookCallback handles the incoming update and sends the response
    const callback = webhookCallback(bot, 'fastify', {
      secretToken: appConfig.telegramBotWebhookSecret,
    });

    try {
      await callback(req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error handling Telegram Webhook: ${message}`);
      if (!res.sent) {
        await res.status(500).send({ error: 'Internal Server Error' });
      }
    }
  }
}
