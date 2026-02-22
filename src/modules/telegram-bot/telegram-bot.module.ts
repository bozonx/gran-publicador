import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from '../users/users.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { MediaModule } from '../media/media.module.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';
import { SttModule } from '../stt/stt.module.js';
import { TELEGRAM_MESSAGES_QUEUE } from './telegram-bot.queue.js';
import { TelegramMessageProcessor } from './telegram-message.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: TELEGRAM_MESSAGES_QUEUE,
    }),
    UsersModule,
    ContentLibraryModule,
    MediaModule,
    SttModule,
  ],
  providers: [TelegramBotService, TelegramBotUpdate, TelegramMessageProcessor],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
