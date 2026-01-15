import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'grammy';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);

  constructor(private readonly usersService: UsersService) {}

  public async onStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    this.logger.debug(`Received /start from ${from.id} (${from.username})`);

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    await ctx.reply(`Привет, ${user.fullName || 'друг'}! 👋\n\nЯ помогу тебе собирать интересные посты и репосты для твоих проектов.\n\nПросто перешли мне сообщение из любого канала, и я сохраню его как "Source Text" в личном черновике.`);
  }

  public async onMessage(ctx: Context): Promise<void> {
    const from = ctx.from;
    const message = ctx.message;

    if (!from) return;

    this.logger.debug(
      `Received message from ${from.id} (${from.username}): ${message?.text ?? '[no text]'}`,
    );

    // Ensure user exists in DB on every message
    await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    if (message?.forward_origin) {
      this.logger.debug(`Message is a forward from: ${JSON.stringify(message.forward_origin)}`);
      await ctx.reply('Я получил ваш репост! Скоро я научусь его сохранять в базу данных.');
    } else {
      await ctx.reply('Привет! Пришли мне репост из канала, и я помогу его сохранить.');
    }
  }
}
