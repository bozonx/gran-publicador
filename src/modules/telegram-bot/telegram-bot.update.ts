import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Context } from 'grammy';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from '../users/users.service.js';
import { MediaService } from '../media/media.service.js';
import { extractMessageContent, formatSource } from './telegram-content.helper.js';
import { SttService } from '../stt/stt.service.js';
import { AppConfig } from '../../config/app.config.js';
import { StorageType } from '../../generated/prisma/index.js';
import type { Message } from 'grammy/types';
import { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_MICROSERVICE_TIMEOUT_MS } from '../../common/constants/global.constants.js';
import { TELEGRAM_MESSAGES_QUEUE, TELEGRAM_PROCESS_MESSAGE_JOB } from './telegram-bot.queue.js';
import type { Queue } from 'bullmq';
import type { TelegramProcessMessageJobData } from './telegram-message.processor.js';
import type { Api } from 'grammy';
import { RedisService } from '../../common/redis/redis.service.js';

const MAX_TITLE_LENGTH = 80;

interface TelegramActionContext {
  from: Message['from'];
  reply: (text: string, extra?: any) => Promise<any>;
  api: Api;
}

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);
  private readonly miniAppBaseUrl?: string;

  constructor(
    @InjectQueue(TELEGRAM_MESSAGES_QUEUE)
    private readonly telegramMessagesQueue: Queue,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly sttService: SttService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.miniAppBaseUrl = appConfig.telegramMiniAppUrl;
    if (!appConfig.telegramBotToken) {
      this.logger.warn('Telegram bot token is not configured (TELEGRAM_BOT_TOKEN).');
    }
  }

  private buildMiniAppQuickPublicationUrl(contentItemId: string): string | null {
    if (!this.miniAppBaseUrl) return null;
    try {
      const url = new URL(this.miniAppBaseUrl);
      const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
      url.pathname = `${basePath}/publications/quick-create`;
      url.searchParams.set('contentItemId', contentItemId);
      return url.toString();
    } catch {
      return null;
    }
  }

  private async replyContentItemCreated(
    ctx: TelegramActionContext,
    lang: string,
    contentItemId: string,
  ): Promise<void> {
    const miniAppUrl = this.buildMiniAppQuickPublicationUrl(contentItemId);
    if (!miniAppUrl) {
      await ctx.reply(String(this.i18n.t('telegram.content_item_created', { lang })));
      return;
    }

    await ctx.reply(String(this.i18n.t('telegram.content_item_created', { lang })), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: String(this.i18n.t('telegram.button_create_publication', { lang })),
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    });
  }

  /**
   * Handle /start command
   */
  public async onStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    const fallbackLang = from.language_code;

    // Check if private chat
    if (ctx.chat?.type !== 'private') {
      await ctx.reply(String(this.i18n.t('telegram.error_private_only', { lang: fallbackLang })));
      return;
    }

    this.logger.debug(`Received /start from ${from.id} (${from.username})`);

    // Create or update user
    const user = await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });

    const lang = user.uiLanguage ?? fallbackLang;
    await ctx.reply(String(this.i18n.t('telegram.welcome', { lang })), { parse_mode: 'Markdown' });
    await ctx.reply(String(this.i18n.t('telegram.start_message', { lang })));
  }

  /**
   * Handle /help command
   */
  public async onHelp(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    const user = await this.usersService.findByTelegramId(BigInt(from.id)).catch(() => null);
    const lang = user?.uiLanguage ?? from.language_code;

    await ctx.reply(String(this.i18n.t('telegram.help', { lang })), {
      parse_mode: 'Markdown',
    });
  }

  /**
   * Handle regular messages
   */
  public async onMessage(ctx: Context): Promise<void> {
    const from = ctx.from;
    const message = ctx.message;

    if (!from || !message) return;

    // Check if private chat
    if (ctx.chat?.type !== 'private') {
      return;
    }

    const fallbackLang = from.language_code;

    // Handle commands
    if ('text' in message && message.text?.startsWith('/')) {
      const command = message.text.split(' ')[0];
      if (command === '/start') return; // Ignore, handled by onStart
      if (command === '/help') {
        await this.onHelp(ctx);
        return;
      }

      const user = await this.usersService.findByTelegramId(BigInt(from.id)).catch(() => null);
      const lang = user?.uiLanguage ?? fallbackLang;

      await ctx.reply(
        String(this.i18n.t('telegram.command_not_found', { lang, args: { command } })),
      );
      return;
    }

    await this.telegramMessagesQueue.add(
      TELEGRAM_PROCESS_MESSAGE_JOB,
      {
        telegramUserId: from.id,
        chatId: message.chat.id,
        message: message as Message,
      } satisfies TelegramProcessMessageJobData,
      {
        jobId: `telegram-${from.id}-${message.chat.id}-${message.message_id}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    );
  }

  public async handleQueuedMessage(options: {
    botApi: Api;
    lockKey: string;
    telegramUserId: number;
    chatId: number;
    message: Message;
  }): Promise<void> {
    const { botApi, lockKey, telegramUserId, chatId, message } = options;

    const lockToken = await this.redisService.acquireLock(lockKey, 2 * 60 * 1000);
    if (!lockToken) {
      throw new Error('Telegram user lock not acquired');
    }

    try {
      const ctxLike: TelegramActionContext = {
        from: message.from ?? {
          id: telegramUserId,
          is_bot: false,
          first_name: 'Unknown',
          language_code: 'en-US',
        },
        api: botApi,
        reply: (text: string, extra?: any) => botApi.sendMessage(chatId, text, extra),
      };

      await this.processMessage(ctxLike, message);
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }

  private async processMessage(ctx: TelegramActionContext, message: Message): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    const fallbackLang = from.language_code;

    try {
      const alreadyProcessed = await this.isMessageAlreadyProcessed({
        telegramUserId: from.id,
        chatId: message.chat.id,
        messageId: message.message_id,
      });
      if (alreadyProcessed) {
        return;
      }

      const user = await this.usersService.findByTelegramId(BigInt(from.id));
      if (!user) {
        await ctx.reply(String(this.i18n.t('telegram.user_not_found', { lang: fallbackLang })));
        return;
      }

      const lang = user.uiLanguage ?? fallbackLang;

      if (user.isBanned) {
        await ctx.reply(
          String(
            this.i18n.t('telegram.user_banned', {
              lang,
              args: { reason: user.banReason || 'No reason provided' },
            }),
          ),
        );
        return;
      }

      const extracted = extractMessageContent(message);
      const supportedText = (extracted.text ?? '').trim();
      const supportedMedia = extracted.media.filter(m => !m.isVoice);
      const voiceMedia = extracted.media.filter(m => m.isVoice);

      const hasAnySupported =
        supportedText.length > 0 || supportedMedia.length > 0 || voiceMedia.length > 0;

      if (!hasAnySupported) {
        await ctx.reply(String(this.i18n.t('telegram.unsupported_message_type', { lang })));
        return;
      }

      // Show typing/uploading indicator
      if (voiceMedia.length > 0) {
        await ctx.api.sendChatAction(message.chat.id, 'record_voice').catch(() => {});
      } else if (supportedMedia.length > 0) {
        await ctx.api.sendChatAction(message.chat.id, 'upload_photo').catch(() => {});
      } else {
        await ctx.api.sendChatAction(message.chat.id, 'typing').catch(() => {});
      }

      const mgid = message.media_group_id;
      if (mgid) {
        const created = await this.addMediaGroupMessageToContentItem({
          ctx,
          userId: user.id,
          telegramUserId: from.id,
          message,
          extractedText: supportedText,
          supportedMedia,
          voiceMedia,
          mediaGroupId: mgid,
          language: user.language,
        });

        if (created.reportCreated && created.contentItemId) {
          await this.replyContentItemCreated(ctx, lang, created.contentItemId);
        }

        return;
      }

      const contentItem = await this.createContentItemFromMessage({
        ctx,
        userId: user.id,
        telegramUserId: from.id,
        message,
        extractedText: supportedText,
        supportedMedia,
        voiceMedia,
        language: user.language,
      });

      if (contentItem) {
        await this.replyContentItemCreated(ctx, lang, contentItem.id);
      }
    } catch (error) {
      this.logger.error(
        `Unhandled error while processing message ${message.message_id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      await ctx
        .reply(String(this.i18n.t('telegram.error_internal', { lang: fallbackLang })))
        .catch(() => undefined);
      throw error;
    }
  }

  private async isMessageAlreadyProcessed(options: {
    telegramUserId: number;
    chatId: number;
    messageId: number;
  }): Promise<boolean> {
    const { telegramUserId, chatId, messageId } = options;

    const user = await this.usersService.findByTelegramId(BigInt(telegramUserId));
    if (!user) return false;

    const existing = await this.prisma.contentItem.findFirst({
      where: {
        userId: user.id,
        projectId: null,
        AND: [
          {
            meta: {
              path: ['telegram', 'chatId'],
              equals: chatId,
            },
          },
          {
            meta: {
              path: ['telegram', 'messageId'],
              equals: messageId,
            },
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(existing);
  }

  private getTitleForMessage(message: Message, extractedText: string): string | null {
    if (message.forward_origin?.type === 'channel') {
      const username = message.forward_origin.chat.username;
      if (username) return `Forward from @${username}`;
      const title = message.forward_origin.chat.title;
      if (title) return `Forward from ${title}`;
      return 'Forward from channel';
    }

    const t = (extractedText ?? '').trim();
    if (!t) return null;
    return t.length > MAX_TITLE_LENGTH ? t.slice(0, MAX_TITLE_LENGTH) : t;
  }

  private async createContentItemFromMessage(options: {
    ctx: TelegramActionContext;
    userId: string;
    telegramUserId: number;
    message: Message;
    extractedText: string;
    supportedMedia: Array<ReturnType<typeof extractMessageContent>['media'][number]>;
    voiceMedia: Array<ReturnType<typeof extractMessageContent>['media'][number]>;
    language?: string;
  }) {
    const {
      ctx,
      userId,
      telegramUserId,
      message,
      extractedText,
      supportedMedia,
      voiceMedia,
      language,
    } = options;

    const meta = {
      telegram: {
        telegramUserId,
        chatId: message.chat.id,
        messageId: message.message_id,
        mediaGroupId: message.media_group_id ?? null,
        forwardOrigin: (message as any).forward_origin ?? null,
        repostInfo: extractMessageContent(message).repostInfo ?? null,
        source: formatSource(message),
      },
    };

    let finalText = extractedText;
    if (voiceMedia.length > 0) {
      const transcribed = await this.transcribeVoice(ctx, voiceMedia[0].fileId, language);
      if (transcribed) {
        finalText = finalText ? `${finalText}\n\n${transcribed}` : transcribed;
      }
    }

    const title = this.getTitleForMessage(message, finalText);

    // Combine supported media with voice media for saving
    const allMediaToSave = [...supportedMedia, ...voiceMedia];

    return this.prisma.$transaction(async tx => {
      const item = await tx.contentItem.create({
        data: {
          userId,
          projectId: null,
          title,
          note: null,
          text: finalText || null,
          meta: meta as any,
        },
      });

      let order = 0;
      for (const m of allMediaToSave) {
        const createdMedia = await this.mediaService.create({
          type: m.type,
          storageType: StorageType.TELEGRAM,
          storagePath: m.fileId,
          filename: m.fileName,
          mimeType: m.mimeType,
          sizeBytes: m.fileSize !== undefined ? BigInt(m.fileSize) : undefined,
          meta: {
            telegram: {
              thumbnailFileId: m.thumbnailFileId,
              hasSpoiler: m.hasSpoiler || false,
              repost: extractMessageContent(message).repostInfo,
              isVoice: m.isVoice || false,
            },
          },
        });

        await tx.contentItemMedia.create({
          data: {
            contentItemId: item.id,
            mediaId: createdMedia.id,
            order,
            hasSpoiler: !!m.hasSpoiler,
          },
        });

        order++;
      }

      return item;
    });
  }

  private async addMediaGroupMessageToContentItem(options: {
    ctx: TelegramActionContext;
    userId: string;
    telegramUserId: number;
    message: Message;
    extractedText: string;
    supportedMedia: Array<ReturnType<typeof extractMessageContent>['media'][number]>;
    voiceMedia: Array<ReturnType<typeof extractMessageContent>['media'][number]>;
    mediaGroupId: string;
    language?: string;
  }): Promise<{ reportCreated: boolean; contentItemId?: string }> {
    const {
      ctx,
      userId,
      telegramUserId,
      message,
      extractedText,
      supportedMedia,
      voiceMedia,
      mediaGroupId,
      language,
    } = options;

    const existingItem = await this.prisma.contentItem.findFirst({
      where: {
        userId,
        projectId: null,
        meta: {
          path: ['telegram', 'mediaGroupId'],
          equals: mediaGroupId,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!existingItem) {
      const created = await this.createContentItemFromMessage({
        ctx,
        userId,
        telegramUserId,
        message,
        extractedText,
        supportedMedia,
        voiceMedia,
        language,
      });

      return { reportCreated: true, contentItemId: created?.id };
    }

    if (voiceMedia.length > 0) {
      const transcribed = await this.transcribeVoice(ctx, voiceMedia[0].fileId, language);
      if (transcribed) {
        const current = await this.prisma.contentItem.findUnique({
          where: { id: existingItem.id },
          select: { text: true },
        });
        const nextText = current?.text ? `${current.text}\n\n${transcribed}` : transcribed;
        await this.prisma.contentItem.update({
          where: { id: existingItem.id },
          data: { text: nextText },
        });
      }
    }

    // Combine supported media with voice media for saving
    const allMediaToSave = [...supportedMedia, ...voiceMedia];

    if (allMediaToSave.length === 0) {
      return { reportCreated: false, contentItemId: existingItem.id };
    }

    const maxOrderAgg = await this.prisma.contentItemMedia.aggregate({
      where: { contentItemId: existingItem.id },
      _max: { order: true },
    });
    let nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

    for (const m of allMediaToSave) {
      const alreadyAttached = await this.prisma.contentItemMedia.findFirst({
        where: {
          contentItemId: existingItem.id,
          media: {
            storageType: StorageType.TELEGRAM,
            storagePath: m.fileId,
          },
        },
        select: { id: true },
      });

      if (alreadyAttached) {
        continue;
      }

      const createdMedia = await this.mediaService.create({
        type: m.type,
        storageType: StorageType.TELEGRAM,
        storagePath: m.fileId,
        filename: m.fileName,
        mimeType: m.mimeType,
        sizeBytes: m.fileSize !== undefined ? BigInt(m.fileSize) : undefined,
        meta: {
          telegram: {
            thumbnailFileId: m.thumbnailFileId,
            hasSpoiler: m.hasSpoiler || false,
            repost: extractMessageContent(message).repostInfo,
            isVoice: m.isVoice || false,
          },
        },
      });

      await this.prisma.contentItemMedia.create({
        data: {
          contentItemId: existingItem.id,
          mediaId: createdMedia.id,
          order: nextOrder,
          hasSpoiler: !!m.hasSpoiler,
        },
      });
      nextOrder++;
    }

    return { reportCreated: false, contentItemId: existingItem.id };
  }

  /**
   * Transcribe voice message using STT service
   */
  private async transcribeVoice(
    ctx: TelegramActionContext,
    fileId: string,
    language?: string,
  ): Promise<string> {
    try {
      const lang = ctx.from?.language_code;
      await ctx.api.sendChatAction(ctx.from?.id ?? 0, 'typing').catch(() => {});
      await ctx.reply(String(this.i18n.t('telegram.stt_processing', { lang })), {
        parse_mode: 'Markdown',
      });

      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        throw new Error('Could not get file path from Telegram');
      }

      const appConfig = this.configService.get<AppConfig>('app')!;
      const fileUrl = `https://api.telegram.org/file/bot${appConfig.telegramBotToken}/${file.file_path}`;

      const { request: undiciRequest } = await import('undici');
      const response = await undiciRequest(fileUrl, {
        headersTimeout: DEFAULT_MICROSERVICE_TIMEOUT_MS,
        bodyTimeout: DEFAULT_MICROSERVICE_TIMEOUT_MS,
      });

      if (response.statusCode !== 200) {
        throw new Error(`Failed to download file: ${response.statusCode}`);
      }

      const transcription = await this.sttService.transcribeAudioStream({
        file: response.body as Readable,
        filename: 'voice.ogg',
        mimetype: 'audio/ogg',
        language,
      });

      return transcription.text;
    } catch (error) {
      this.logger.error(`Error transcribing voice: ${error}`);
      const lang = ctx.from?.language_code;
      await ctx.reply(String(this.i18n.t('telegram.error_stt_failed', { lang }))).catch(() => {});
      return '';
    }
  }
}
