import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';

@Module({
  providers: [TelegramBotService, TelegramBotUpdate],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
