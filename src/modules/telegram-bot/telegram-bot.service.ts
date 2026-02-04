import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { AppConfig } from '../../config/app.config.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private isDestroying = false;

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

    // Global error handler
    this.bot.catch(err => {
      if (this.isDestroying) return;

      const ctx = err.ctx;
      this.logger.error(`Error in bot middleware for update ${ctx.update.update_id}:`);
      const e = err.error;
      if (e instanceof Error) {
        this.logger.error(e.message, e.stack);
      } else {
        this.logger.error(`Unknown error: ${e}`);
      }
    });

    // Start bot
    this.bot
      .start({
        onStart: botInfo => {
          this.logger.log(`Telegram Bot @${botInfo.username ?? 'unknown'} started`);
        },
      })
      .catch(err => {
        if (this.isDestroying) {
          // It is normal to have an error when stopping the bot
          this.logger.debug(`Telegram Bot stopped: ${err.message}`);
          return;
        }
        this.logger.error(`Error starting Telegram Bot: ${err.message}`, err.stack);
      });
  }

  public async onModuleDestroy(): Promise<void> {
    this.isDestroying = true;
    if (this.bot) {
      this.logger.log('Stopping Telegram Bot...');
      try {
        await this.bot.stop();
        this.logger.log('Telegram Bot stopped.');
      } catch (err) {
        // Warning level because we are shutting down anyway
        this.logger.warn(
          `Error stopping Telegram Bot: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Get the bot instance for sending messages.
   * Returns null if bot is not initialized.
   */
  public getBot(): Bot | null {
    return this.bot;
  }
}
