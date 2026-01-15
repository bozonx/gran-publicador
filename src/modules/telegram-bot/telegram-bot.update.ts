import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'grammy';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  public async onStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    this.logger.debug(`Received /start from ${from.id} (${from.username})`);

    const existingUser = await this.usersService.findByTelegramId(BigInt(from.id));
    const isNew = !existingUser;

    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    const lang = from.language_code;
    const messageKey = isNew ? 'telegram.welcome_new' : 'telegram.welcome_existing';

    const message = this.i18n.t(messageKey, {
      lang,
      args: { name: user.fullName || 'friend' },
    });

    await ctx.reply(String(message));
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

    const lang = from.language_code;

    if (message?.forward_origin) {
      this.logger.debug(`Message is a forward from: ${JSON.stringify(message.forward_origin)}`);
      const text = this.i18n.t('telegram.repost_received', { lang });
      await ctx.reply(String(text));
    } else {
      const text = this.i18n.t('telegram.send_repost', { lang });
      await ctx.reply(String(text));
    }
  }
}
