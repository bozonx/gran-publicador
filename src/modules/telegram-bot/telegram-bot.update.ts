import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'grammy';

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);

  public async onMessage(ctx: Context): Promise<void> {
    const from = ctx.from;
    const message = ctx.message;

    this.logger.debug(
      `Received message from ${from?.id} (${from?.username}): ${message?.text ?? '[no text]'}`,
    );

    if (message?.forward_origin) {
      this.logger.debug(`Message is a forward from: ${JSON.stringify(message.forward_origin)}`);
      await ctx.reply('Я получил ваш репост! Скоро я научусь его сохранять.');
    } else {
      await ctx.reply('Привет! Пришли мне репост из канала, и я помогу его сохранить.');
    }
  }
}
