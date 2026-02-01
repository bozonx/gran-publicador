import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from '../users/users.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { MediaService } from '../media/media.service.js';
import { TelegramSessionService } from './telegram-session.service.js';
import { extractMessageContent, formatSource } from './telegram-content.helper.js';
import { SttService } from '../stt/stt.service.js';
import { AppConfig } from '../../config/app.config.js';
import PQueue from 'p-queue';
import { PublicationStatus, StorageType } from '../../generated/prisma/index.js';
import type { Message } from 'grammy/types';
import type { Readable } from 'stream';

const MEDIA_GROUP_TIMEOUT = 500;

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);
  private readonly frontendUrl: string;
  private readonly telegramMiniAppUrl: string;
  private readonly userQueues = new Map<number, PQueue>();
  private readonly mediaGroupBuffers = new Map<string, { messages: Message[]; timer: NodeJS.Timeout }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly publicationsService: PublicationsService,
    private readonly mediaService: MediaService,
    private readonly sttService: SttService,
    private readonly sessionService: TelegramSessionService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.frontendUrl = appConfig.frontendUrl;
    this.telegramMiniAppUrl = appConfig.telegramMiniAppUrl.replace(/\/+$/, '');
  }

  /**
   * Handle /start command
   */
  public async onStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    // Check if private chat
    if (ctx.chat?.type !== 'private') {
      const lang = from.language_code;
      await ctx.reply(String(this.i18n.t('telegram.error_private_only', { lang })));
      return;
    }

    this.logger.debug(`Received /start from ${from.id} (${from.username})`);

    // Create or update user
    await this.usersService.findOrCreateTelegramUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });

    // Delete previous menu message if exists
    await this.deletePreviousMenu(ctx, from.id);

    // Go to home screen
    await this.handleGoToHome(ctx, from.id, from.language_code);
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

    // Handle commands
    if ('text' in message && message.text?.startsWith('/')) {
      const command = message.text.split(' ')[0];
      if (command === '/start') return; // Ignore, handled by onStart

      const lang = from.language_code;
      await ctx.reply(String(this.i18n.t('telegram.command_not_found', { lang, args: { command } })));
      return;
    }

    const mgid = message.media_group_id;
    if (mgid) {
      this.handleMediaGroupMessage(ctx, from.id, mgid);
    } else {
      const queue = this.getQueueForUser(from.id);
      queue.add(() => this.processMessages(ctx, [message]));
    }
  }

  /**
   * Get or create a queue for a user
   */
  private getQueueForUser(userId: number): PQueue {
    if (!this.userQueues.has(userId)) {
      this.userQueues.set(userId, new PQueue({ concurrency: 1 }));
    }
    return this.userQueues.get(userId)!;
  }

  /**
   * Handle messages that are part of a media group (album)
   */
  private handleMediaGroupMessage(ctx: Context, userId: number, mgid: string): void {
    let buffer = this.mediaGroupBuffers.get(mgid);

    if (!buffer) {
      buffer = {
        messages: [],
        timer: null as any,
      };
      this.mediaGroupBuffers.set(mgid, buffer);
    } else {
      clearTimeout(buffer.timer);
    }

    buffer.messages.push(ctx.message!);

    buffer.timer = setTimeout(() => {
      const messages = buffer!.messages;
      this.mediaGroupBuffers.delete(mgid);

      const queue = this.getQueueForUser(userId);
      queue.add(() => this.processMessages(ctx, messages));
    }, MEDIA_GROUP_TIMEOUT);
  }

  /**
   * Process one or more messages (from a media group or single)
   */
  private async processMessages(ctx: Context, messages: Message[]): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    const lang = from.language_code;

    this.logger.debug(
      `Processing ${messages.length} messages from ${from.id} (${from.username})`,
    );

    // Delete previous menu message if exists (only for the first batch of a session or update)
    await this.deletePreviousMenu(ctx, from.id);

    // Validate user
    const validationResult = await this.validateUser(from.id, lang, ctx);
    if (!validationResult.valid) return;

    const user = validationResult.user!;

    // Check if there's an active session
    const session = await this.sessionService.getSession(String(from.id));

    if (!session || session.menu === 'home') {
      // No session or home session - enter HOME menu (create draft)
      await this.handleHomeMenu(ctx, user.id, from.id, lang, messages, user.language);
    } else {
      // Active session - handle COLLECT menu
      await this.handleCollectMenu(ctx, user.id, from.id, lang, messages, session, user.language);
    }
  }

  /**
   * Handle callback queries (button clicks)
   */
  public async onCallbackQuery(ctx: Context): Promise<void> {
    const from = ctx.from;
    const callbackQuery = ctx.callbackQuery;

    if (!from || !callbackQuery || !('data' in callbackQuery)) return;

    const data = callbackQuery.data;
    const lang = from.language_code;

    this.logger.debug(`Received callback from ${from.id}: ${data}`);

    try {
      // Validate user
      const validationResult = await this.validateUser(from.id, lang, ctx);
      if (!validationResult.valid) {
        await ctx.answerCallbackQuery().catch(() => {});
        return;
      }

      const user = validationResult.user!;
      const session = await this.sessionService.getSession(String(from.id));

      if (data === 'cancel' && (!session || session.menu === 'home')) {
        await this.handleGoToHome(ctx, from.id, lang);
        await ctx.answerCallbackQuery().catch(() => {});
        return;
      }

      if (!session) {
        await ctx.answerCallbackQuery().catch(() => {});
        return;
      }

      if (data === 'done') {
        await this.handleDone(ctx, user.id, from.id, lang, session);
      } else if (data === 'cancel') {
        await this.handleCancel(ctx, user.id, from.id, lang, session);
      }

      await ctx.answerCallbackQuery().catch(() => {});
    } catch (error) {
      this.logger.error(`Error in onCallbackQuery: ${error}`);
      await ctx.answerCallbackQuery().catch(() => {});
    }
  }

  /**
   * Validate user exists and is not banned
   */
  private async validateUser(
    telegramId: number,
    lang: string | undefined,
    ctx: Context,
  ): Promise<{ valid: boolean; user?: any }> {
    const user = await this.usersService.findByTelegramId(BigInt(telegramId));

    if (!user) {
      const message = this.i18n.t('telegram.user_not_found', { lang });
      const msg = await ctx.reply(String(message));
      await this.sessionService.setLastMenuMessageId(String(telegramId), msg.message_id);
      return { valid: false };
    }

    if (user.isBanned) {
      const message = this.i18n.t('telegram.user_banned', {
        lang,
        args: { reason: user.banReason || 'No reason provided' },
      });
      const msg = await ctx.reply(String(message));
      await this.sessionService.setLastMenuMessageId(String(telegramId), msg.message_id);
      return { valid: false };
    }

    return { valid: true, user };
  }

  /**
   * HOME menu - create new draft
   */
  private async handleHomeMenu(
    ctx: Context,
    userId: string,
    telegramId: number,
    lang: string | undefined,
    messages: Message[],
    contentLanguage: string,
  ): Promise<void> {
    try {
      // Re-check session to prevent race conditions
      const freshSession = await this.sessionService.getSession(String(telegramId));
      if (freshSession && freshSession.menu === 'collect') {
        return this.handleCollectMenu(ctx, userId, telegramId, lang, messages, freshSession, contentLanguage);
      }

      const firstMessage = messages[0];
      const aggregatedSourceTexts: any[] = [];
      const mediaItemsToAdd: any[] = [];

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const extracted = extractMessageContent(msg);

        if (extracted.text) {
          aggregatedSourceTexts.push({
            content: extracted.text,
            order: aggregatedSourceTexts.length,
            source: formatSource(msg),
            meta: {
              repost: extracted.repostInfo,
            },
          });
        }

        for (const m of extracted.media) {
          if (m.isVoice) {
            const transcribedText = await this.transcribeVoice(ctx, m.fileId, contentLanguage);
            if (transcribedText) {
              aggregatedSourceTexts.push({
                content: transcribedText,
                order: aggregatedSourceTexts.length,
                source: formatSource(msg),
                meta: {
                  repost: extracted.repostInfo,
                  isVoice: true,
                },
              });
            }
            continue; // Do not add voice message to mediaItemsToAdd
          }

          mediaItemsToAdd.push({
            ...m,
            hasSpoiler: m.hasSpoiler || false,
            repostInfo: extracted.repostInfo,
          });
        }
      }

      // Create draft publication
      const firstExtracted = extractMessageContent(firstMessage);
      const publication = await this.publicationsService.create(
        {
          status: PublicationStatus.DRAFT,
          language: lang || 'en-US',
          content: '',
          sourceTexts: aggregatedSourceTexts,
          meta: {
            telegramOrigin: {
              chatId: firstMessage.chat.id,
              messageId: firstMessage.message_id,
              forwardOrigin: firstExtracted.forwardOrigin || null,
            },
          },
        },
        userId,
      );

      // Create media in DB and link to publication
      let mediaCount = 0;
      for (const mediaItem of mediaItemsToAdd) {
        const media = await this.mediaService.create({
          type: mediaItem.type,
          storageType: StorageType.TELEGRAM,
          storagePath: mediaItem.fileId,
          filename: mediaItem.fileName,
          mimeType: mediaItem.mimeType,
          sizeBytes: mediaItem.fileSize !== undefined ? BigInt(mediaItem.fileSize) : undefined,
          meta: {
            telegram: {
              thumbnailFileId: mediaItem.thumbnailFileId,
              hasSpoiler: mediaItem.hasSpoiler || false,
              repost: mediaItem.repostInfo,
            },
          },
        });

        await this.publicationsService.addMedia(publication.id, userId, [
          {
            id: media.id,
            order: mediaCount,
            hasSpoiler: mediaItem.hasSpoiler || false,
          },
        ]);
        mediaCount++;
      }

      const sourceTextsCount = aggregatedSourceTexts.length;

      // Create inline keyboard
      const keyboard = new InlineKeyboard()
        .url(
          String(this.i18n.t('telegram.button_done', { lang })),
          `${this.telegramMiniAppUrl}?startapp=${publication.id}`,
        )
        .text(String(this.i18n.t('telegram.button_cancel', { lang })), 'cancel');

      // Send menu message
      const menuMessage = await ctx.reply(
        String(
          this.i18n.t('telegram.draft_created', {
            lang,
            args: {
              mediaCount,
              sourceTextsCount,
            },
          }),
        ),
        { reply_markup: keyboard },
      );

      // Store last menu message ID for future deletion
      await this.sessionService.setLastMenuMessageId(String(telegramId), menuMessage.message_id);

      // Create session
      await this.sessionService.setSession(String(telegramId), {
        menu: 'collect',
        publicationId: publication.id,
        menuMessageId: menuMessage.message_id,
        createdAt: new Date().toISOString(),
        metadata: {
          sourceTextsCount,
          mediaCount,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating draft: ${error}`);
      const errorMessage = this.i18n.t('telegram.error_creating_draft', { lang });
      const msg = await ctx.reply(String(errorMessage));
      await this.sessionService.setLastMenuMessageId(String(telegramId), msg.message_id);
    }
  }

  /**
   * COLLECT menu - add more content to existing draft
   */
  private async handleCollectMenu(
    ctx: Context,
    userId: string,
    telegramId: number,
    lang: string | undefined,
    messages: Message[],
    session: any,
    contentLanguage: string,
  ): Promise<void> {
    try {
      // Verify publication still exists
      const publication = await this.publicationsService.findOne(session.publicationId, userId);

      if (!publication) {
        await this.sessionService.deleteSession(String(telegramId));
        const errorMessage = this.i18n.t('telegram.error_publication_not_found', { lang });
        await ctx.reply(String(errorMessage));
        return;
      }

      const newSourceTexts: any[] = [];
      const mediaItemsToAdd: any[] = [];

      for (const msg of messages) {
        const extracted = extractMessageContent(msg);

        if (extracted.text) {
          newSourceTexts.push({
            content: extracted.text,
            order: session.metadata.sourceTextsCount + newSourceTexts.length,
            source: formatSource(msg),
            meta: {
              repost: extracted.repostInfo,
            },
          });
        }

        for (const m of extracted.media) {
          if (m.isVoice) {
            const transcribedText = await this.transcribeVoice(ctx, m.fileId, contentLanguage);
            if (transcribedText) {
              newSourceTexts.push({
                content: transcribedText,
                order: session.metadata.sourceTextsCount + newSourceTexts.length,
                source: formatSource(msg),
                meta: {
                  repost: extracted.repostInfo,
                  isVoice: true,
                },
              });
            }
            continue; // Do not add voice message to mediaItemsToAdd
          }
          mediaItemsToAdd.push({
            ...m,
            repostInfo: extracted.repostInfo,
          });
        }
      }

      // Update publication with new source texts if present
      if (newSourceTexts.length > 0) {
        await this.publicationsService.update(session.publicationId, userId, {
          sourceTexts: newSourceTexts,
          appendSourceTexts: true,
        });
      }

      // Add media if any
      let newMediaCount = 0;
      for (const mediaItem of mediaItemsToAdd) {
        const media = await this.mediaService.create({
          type: mediaItem.type,
          storageType: StorageType.TELEGRAM,
          storagePath: mediaItem.fileId,
          filename: mediaItem.fileName,
          mimeType: mediaItem.mimeType,
          sizeBytes: mediaItem.fileSize !== undefined ? BigInt(mediaItem.fileSize) : undefined,
          meta: {
            telegram: {
              thumbnailFileId: mediaItem.thumbnailFileId,
              hasSpoiler: mediaItem.hasSpoiler || false,
              repost: mediaItem.repostInfo,
            },
          },
        });

        await this.publicationsService.addMedia(session.publicationId, userId, [
          {
            id: media.id,
            order: session.metadata.mediaCount + newMediaCount,
            hasSpoiler: mediaItem.hasSpoiler || false,
          },
        ]);
        newMediaCount++;
      }

      const finalSourceTextsCount = session.metadata.sourceTextsCount + newSourceTexts.length;
      const finalMediaCount = session.metadata.mediaCount + newMediaCount;

      // Update session metadata in Redis FIRST
      await this.sessionService.updateMetadata(String(telegramId), {
        sourceTextsCount: finalSourceTextsCount,
        mediaCount: finalMediaCount,
      });

      // Delete old menu message asynchronously
      ctx.api.deleteMessage(ctx.chat!.id, session.menuMessageId).catch(error => {
        this.logger.debug(`Could not delete old menu message during update: ${error.message}`);
      });

      // Prepare updated menu message
      const keyboard = new InlineKeyboard()
        .url(
          String(this.i18n.t('telegram.button_done', { lang })),
          `${this.telegramMiniAppUrl}?startapp=${session.publicationId}`,
        )
        .text(String(this.i18n.t('telegram.button_cancel', { lang })), 'cancel');

      const menuMessage = await ctx.reply(
        String(
          this.i18n.t('telegram.draft_updated', {
            lang,
            args: {
              mediaCount: finalMediaCount,
              sourceTextsCount: finalSourceTextsCount,
            },
          }),
        ),
        { reply_markup: keyboard },
      );

      // Update session with new menu message ID and fresh metadata
      await this.sessionService.setSession(String(telegramId), {
        ...session,
        menuMessageId: menuMessage.message_id,
        metadata: {
          sourceTextsCount: finalSourceTextsCount,
          mediaCount: finalMediaCount,
        },
      });

      // Update last menu message ID for future reference
      await this.sessionService.setLastMenuMessageId(String(telegramId), menuMessage.message_id);
    } catch (error) {
      this.logger.error(`Error updating draft: ${error}`);
      const errorMessage = this.i18n.t('telegram.error_creating_draft', { lang });
      const msg = await ctx.reply(String(errorMessage));
      await this.sessionService.setLastMenuMessageId(String(telegramId), msg.message_id);
    }
  }

  /**
   * Handle "Done" button
   */
  private async handleDone(
    ctx: Context,
    userId: string,
    telegramId: number,
    lang: string | undefined,
    session: any,
  ): Promise<void> {
    // Delete session
    await this.sessionService.deleteSession(String(telegramId));

    // Send completion message
    const publicationUrl = `${this.frontendUrl}/publications/${session.publicationId}`;
    const message = this.i18n.t('telegram.draft_completed', {
      lang,
      args: { url: publicationUrl },
    });

    await ctx.editMessageText(String(message));

    // Store menu message ID so it can be deleted when creating new draft
    await this.sessionService.setLastMenuMessageId(String(telegramId), session.menuMessageId);
  }

  /**
   * Handle "Cancel" button
   */
  private async handleCancel(
    ctx: Context,
    userId: string,
    telegramId: number,
    lang: string | undefined,
    session: any,
  ): Promise<void> {
    try {
      // Delete publication
      if (session.publicationId) {
        await this.publicationsService.remove(session.publicationId, userId);
      }

      // Go to home screen
      await this.handleGoToHome(ctx, telegramId, lang);
    } catch (error) {
      this.logger.error(`Error cancelling draft: ${error}`);
      // Still go home even on error
      await this.handleGoToHome(ctx, telegramId, lang);
    }
  }

  /**
   * Transcribe voice message using STT service
   */
  private async transcribeVoice(ctx: Context, fileId: string, language?: string): Promise<string> {
    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        throw new Error('Could not get file path from Telegram');
      }

      const appConfig = this.configService.get<AppConfig>('app')!;
      const fileUrl = `https://api.telegram.org/file/bot${appConfig.telegramBotToken}/${file.file_path}`;

      // undici request returns a stream in response.body
      const { request } = await import('undici');
      const response = await request(fileUrl);
      
      if (response.statusCode !== 200) {
        throw new Error(`Failed to download file: ${response.statusCode}`);
      }

      const transcription = await this.sttService.transcribeAudioStream(
        response.body as Readable,
        'voice.ogg',
        'audio/ogg',
        language,
      );

      return transcription.text;
    } catch (error) {
      this.logger.error(`Error transcribing voice: ${error}`);
      const lang = ctx.from?.language_code;
      await ctx.reply(String(this.i18n.t('telegram.error_stt_failed', { lang }))).catch(() => {});
      return '';
    }
  }

  /**
   * Go to home screen (reset state and create home session)
   */
  private async handleGoToHome(
    ctx: Context,
    telegramId: number,
    lang: string | undefined,
  ): Promise<void> {
    const user = await this.usersService.findByTelegramId(BigInt(telegramId));
    const messageKey = user ? 'telegram.welcome_existing' : 'telegram.welcome_new';

    const welcomeMessageText = this.i18n.t(messageKey, {
      lang,
      args: { name: user?.fullName || 'friend' },
    });

    let sentMessage;
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(String(welcomeMessageText));
        sentMessage = ctx.callbackQuery.message;
      } catch (e) {
        sentMessage = await ctx.reply(String(welcomeMessageText));
      }
    } else {
      sentMessage = await ctx.reply(String(welcomeMessageText));
    }

    if (sentMessage) {
      await this.sessionService.setLastMenuMessageId(String(telegramId), sentMessage.message_id);

      await this.sessionService.setSession(String(telegramId), {
        menu: 'home',
        menuMessageId: sentMessage.message_id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete previous menu message from Telegram and Redis
   */
  private async deletePreviousMenu(ctx: Context, telegramId: number): Promise<void> {
    try {
      const lastMenuMessageId = await this.sessionService.getLastMenuMessageId(String(telegramId));
      if (lastMenuMessageId) {
        // Delete from Telegram
        const chatId = ctx.chat?.id || ctx.message?.chat.id;
        if (chatId) {
          await ctx.api.deleteMessage(chatId, lastMenuMessageId).catch(error => {
            this.logger.debug(`Could not delete previous menu message: ${error.message}`);
          });
        }
        // Always delete from Redis to avoid duplicate attempts
        await this.sessionService.deleteLastMenuMessageId(String(telegramId));
      }
    } catch (error) {
      this.logger.error(`Error in deletePreviousMenu: ${error}`);
    }
  }
}
