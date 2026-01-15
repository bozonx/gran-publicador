import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';

@Module({
  imports: [UsersModule],
  providers: [TelegramBotService, TelegramBotUpdate],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
