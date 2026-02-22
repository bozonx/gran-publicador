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
  concurrency: 5,
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
