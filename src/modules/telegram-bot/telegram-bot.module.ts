import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { MediaModule } from '../media/media.module.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';
import { TelegramSessionService } from './telegram-session.service.js';
import { SttModule } from '../stt/stt.module.js';

@Module({
  imports: [UsersModule, PublicationsModule, MediaModule, SttModule],
  providers: [TelegramBotService, TelegramBotUpdate, TelegramSessionService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
