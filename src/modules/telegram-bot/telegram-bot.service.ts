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
  private isStarted = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramBotUpdate: TelegramBotUpdate,
  ) {}

  public async onModuleInit(): Promise<void> {
    const appConfig = this.configService.get<AppConfig>('app');

    if (!appConfig) {
      this.logger.error('Application configuration is missing');
      return;
    }

    if (!appConfig.telegramBotToken) {
      if (appConfig.telegramBotEnabled) {
        this.logger.error('TELEGRAM_BOT_TOKEN is not defined but TELEGRAM_BOT_ENABLED is true.');
      } else {
        this.logger.log('Telegram Bot is disabled and token is not configured.');
      }
      return;
    }

    this.bot = new Bot(appConfig.telegramBotToken);

    if (!appConfig.telegramBotEnabled) {
      this.logger.log('Telegram Bot is disabled via config.');
      return;
    }

    // Register common handlers
    this.registerHandlers();

    if (appConfig.telegramBotUseWebhook) {
      await this.setupWebhook(appConfig);
    } else {
      this.startPolling();
    }
  }

  private registerHandlers(): void {
    if (!this.bot) return;

    this.bot.command('start', ctx => this.telegramBotUpdate.onStart(ctx));
    this.bot.on('message', ctx => this.telegramBotUpdate.onMessage(ctx));

    // Global error handler
    this.bot.catch(err => {
      if (this.isDestroying) return;

      const ctx = err.ctx;
      this.logger.error(`Error in bot middleware for update ${String(ctx.update.update_id)}:`);
      const e = err.error;
      if (e instanceof Error) {
        this.logger.error(e.message, e.stack);
      } else {
        this.logger.error(`Unknown error: ${String(e)}`);
      }
    });
  }

  private async setupWebhook(appConfig: AppConfig): Promise<void> {
    if (!this.bot) return;

    if (!appConfig.telegramBotWebhookUrl) {
      this.logger.error(
        'TELEGRAM_BOT_WEB_URL is not defined but TELEGRAM_BOT_USE_WEBHOOK is true.',
      );
      return;
    }

    const webhookPath = `${appConfig.basePath ? `/${appConfig.basePath}` : ''}/api/v1/telegram/webhook`;
    const webhookUrl = `${appConfig.telegramBotWebhookUrl}${webhookPath}`;

    this.logger.log(`Setting up Telegram Webhook to ${webhookUrl}`);
    try {
      await this.bot.api.setWebhook(webhookUrl, {
        secret_token: appConfig.telegramBotWebhookSecret,
        allowed_updates: ['message', 'callback_query'],
      });
      this.logger.log('Telegram Webhook set successfully.');
      this.isStarted = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error setting Telegram Webhook: ${message}`);
    }
  }

  private startPolling(): void {
    if (!this.bot) return;

    this.logger.log('Starting Telegram Bot in Long Polling mode...');
    this.bot
      .start({
        onStart: botInfo => {
          this.logger.log(`Telegram Bot @${botInfo.username} started`);
          this.isStarted = true;
        },
      })
      .catch((err: unknown) => {
        if (this.isDestroying) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.debug(`Telegram Bot stopped: ${message}`);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Error starting Telegram Bot: ${message}`, stack);
      });
  }

  public async onModuleDestroy(): Promise<void> {
    this.isDestroying = true;
    const appConfig = this.configService.get<AppConfig>('app');

    if (this.bot && this.isStarted && appConfig) {
      if (appConfig.telegramBotUseWebhook) {
        this.logger.log('Stopping Telegram Bot (Webhook mode)...');
        // No need to explicitly stop anything for webhook besides potentially clearing it
        // but usually we keep it. We just flag as not started.
        this.isStarted = false;
      } else {
        this.logger.log('Stopping Telegram Bot (Polling mode)...');
        try {
          await this.bot.stop();
          this.logger.log('Telegram Bot stopped.');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Error stopping Telegram Bot: ${message}`);
        }
      }
    }
  }

  public get isShuttingDown(): boolean {
    return this.isDestroying;
  }

  /**
   * Get the bot instance for sending messages.
   * Returns null if bot is not initialized.
   */
  public getBot(): Bot | null {
    return this.bot;
  }
}
