import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { MediaModule } from '../media/media.module.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotUpdate } from './telegram-bot.update.js';
import { SttModule } from '../stt/stt.module.js';

@Module({
  imports: [UsersModule, ContentLibraryModule, MediaModule, SttModule],
  providers: [TelegramBotService, TelegramBotUpdate],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
