import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { AppConfig } from '../../config/app.config.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramBotUpdate: TelegramBotUpdate,
  ) {}

  public async onModuleInit(): Promise<void> {
    const appConfig = this.configService.get<AppConfig>('app')!;

    if (!appConfig.telegramBotEnabled) {
      this.logger.log('Telegram Bot is disabled via config.');
      return;
    }

    if (!appConfig.telegramBotToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined but TELEGRAM_BOT_ENABLED is true.');
      return;
    }

    this.bot = new Bot(appConfig.telegramBotToken);

    // Register handlers
    this.bot.command('start', ctx => this.telegramBotUpdate.onStart(ctx));
    this.bot.on('message', ctx => this.telegramBotUpdate.onMessage(ctx));
    this.bot.on('callback_query:data', ctx => this.telegramBotUpdate.onCallbackQuery(ctx));

    // Start bot
    this.bot
      .start({
        onStart: botInfo => {
          this.logger.log(`Telegram Bot @${botInfo.username ?? 'unknown'} started`);
        },
      })
      .catch(err => {
        this.logger.error(`Error starting Telegram Bot: ${err.message}`, err.stack);
      });
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      this.logger.log('Stopping Telegram Bot...');
      await this.bot.stop();
      this.logger.log('Telegram Bot stopped.');
    }
  }
}
