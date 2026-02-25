import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TELEGRAM_MESSAGES_QUEUE } from './telegram-bot.queue.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';
import type { Message } from 'grammy/types';

export interface TelegramProcessMessageJobData {
  telegramUserId: number;
  chatId: number;
  message: Message;
}

@Processor(TELEGRAM_MESSAGES_QUEUE, {
  concurrency: process.env.BULL_CONCURRENCY ? parseInt(process.env.BULL_CONCURRENCY, 10) : 5,
  stalledInterval: process.env.BULL_STALLED_CHECK_INTERVAL
    ? parseInt(process.env.BULL_STALLED_CHECK_INTERVAL, 10)
    : 30000,
  lockDuration: process.env.BULL_LOCK_DURATION
    ? parseInt(process.env.BULL_LOCK_DURATION, 10)
    : 30000,
  maxStalledCount: process.env.BULL_MAX_STALLED_COUNT
    ? parseInt(process.env.BULL_MAX_STALLED_COUNT, 10)
    : 1,
})
export class TelegramMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramMessageProcessor.name);

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly telegramBotUpdate: TelegramBotUpdate,
  ) {
    super();
  }

  public async process(job: Job<TelegramProcessMessageJobData>): Promise<void> {
    if (this.telegramBotService.isShuttingDown) {
      this.logger.warn(`Worker is shutting down. Delaying job ${String(job.id)}`);
      await job.moveToDelayed(Date.now() + 5000, job.token);
      return;
    }

    const { telegramUserId, chatId, message } = job.data;

    const bot = this.telegramBotService.getBot();
    if (!bot) {
      this.logger.warn(
        `Telegram bot is not initialized. Skipping message processing job ${String(job.id)}`,
      );
      return;
    }

    const lockKey = `telegram:lock:user:${telegramUserId}`;

    await job.log(
      `Processing telegram message ${message.message_id} for user ${telegramUserId} in chat ${chatId}`,
    );

    await this.telegramBotUpdate.handleQueuedMessage({
      botApi: bot.api,
      lockKey,
      telegramUserId,
      chatId,
      message,
    });
  }
}
