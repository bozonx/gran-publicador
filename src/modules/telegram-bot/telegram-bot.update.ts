import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from '../users/users.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { MediaService } from '../media/media.service.js';
import { TelegramSessionService } from './telegram-session.service.js';
import { extractMessageContent, formatSource, truncateText } from './telegram-content.helper.js';
import { AppConfig } from '../../config/app.config.js';
import { PublicationStatus, StorageType } from '../../generated/prisma/client.js';

@Injectable()
export class TelegramBotUpdate {
  private readonly logger = new Logger(TelegramBotUpdate.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly publicationsService: PublicationsService,
    private readonly mediaService: MediaService,
    private readonly sessionService: TelegramSessionService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.frontendUrl = appConfig.frontendUrl;
  }

  /**
   * Handle /start command
   */
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

    // Clear any existing session
    await this.sessionService.deleteSession(String(from.id));

    // Delete previous menu message if exists
    await this.deletePreviousMenu(ctx, from.id);

    const lang = from.language_code;
    const messageKey = isNew ? 'telegram.welcome_new' : 'telegram.welcome_existing';

    const welcomeMessageText = this.i18n.t(messageKey, {
      lang,
      args: { name: user.fullName || 'friend' },
    });

    const sentMessage = await ctx.reply(String(welcomeMessageText));

    // Store this message as the "last menu" so it can be deleted when user sends content
    await this.sessionService.setLastMenuMessageId(String(from.id), sentMessage.message_id);
  }

  /**
   * Handle regular messages
   */
  public async onMessage(ctx: Context): Promise<void> {
    const from = ctx.from;
    const message = ctx.message;

    if (!from || !message) return;

    this.logger.debug(
      `Received message from ${from.id} (${from.username}): ${message && 'text' in message ? message.text : '[media]'}`,
    );

    const lang = from.language_code;

    // Delete previous menu message if exists
    await this.deletePreviousMenu(ctx, from.id);

    // Validate user
    const validationResult = await this.validateUser(from.id, lang, ctx);
    if (!validationResult.valid) return;

    const user = validationResult.user!;

    // Check if there's an active session
    const session = await this.sessionService.getSession(String(from.id));

    if (!session) {
      // No session - enter HOME menu
      await this.handleHomeMenu(ctx, user.id, from.id, lang, message);
    } else {
      // Active session - handle COLLECT menu
      await this.handleCollectMenu(ctx, user.id, from.id, lang, message, session);
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

    // Validate user
    const validationResult = await this.validateUser(from.id, lang, ctx);
    if (!validationResult.valid) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = validationResult.user!;
    const session = await this.sessionService.getSession(String(from.id));

    if (!session) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'done') {
      await this.handleDone(ctx, user.id, from.id, lang, session);
    } else if (data === 'cancel') {
      await this.handleCancel(ctx, user.id, from.id, lang, session);
    }

    await ctx.answerCallbackQuery();
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
    message: any,
  ): Promise<void> {
    try {
      // (Previous menu already deleted in onMessage)

      // Extract content from message
      const extracted = extractMessageContent(message);
      const sourceText = extracted.text || '';

      // Create draft publication
      const publication = await this.publicationsService.create(
        {
          status: PublicationStatus.DRAFT,
          language: lang || 'en-US',
          content: sourceText,
          sourceTexts: [
            {
              content: sourceText,
              order: 0,
              source: formatSource(message),
            },
          ],
          meta: {
            telegramOrigin: {
              chatId: message.chat.id,
              messageId: message.message_id,
              forwardOrigin: extracted.forwardOrigin || null,
            },
          },
        },
        userId,
      );

      // Create media if any
      let mediaCount = 0;
      if (extracted.media.length > 0) {
        for (const mediaItem of extracted.media) {
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
              },
            },
          });

          await this.publicationsService.addMedia(publication.id, userId, [
            {
              mediaId: media.id,
              order: mediaCount,
              hasSpoiler: mediaItem.hasSpoiler || false,
            },
          ]);
          mediaCount++;
        }
      }

      // Create inline keyboard
      const keyboard = new InlineKeyboard()
        .text(String(this.i18n.t('telegram.button_done', { lang })), 'done')
        .text(String(this.i18n.t('telegram.button_cancel', { lang })), 'cancel');

      // Send menu message
      const menuMessage = await ctx.reply(
        String(
          this.i18n.t('telegram.draft_created', {
            lang,
            args: {
              content: truncateText(sourceText),
              mediaCount,
              sourceTextsCount: 1,
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
          sourceTextsCount: 1,
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
    message: any,
    session: any,
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

      // Extract content from message
      const extracted = extractMessageContent(message);
      const sourceText = extracted.text || '';

      // Update publication with new source text
      const currentSourceTexts = Array.isArray(publication.sourceTexts)
        ? publication.sourceTexts
        : [];
      const newSourceTexts = [
        ...currentSourceTexts,
        {
          content: sourceText,
          order: currentSourceTexts.length,
          source: formatSource(message),
        },
      ];

      await this.publicationsService.update(session.publicationId, userId, {
        sourceTexts: newSourceTexts,
      });

      // Add media if any
      let newMediaCount = 0;
      if (extracted.media.length > 0) {
        for (const mediaItem of extracted.media) {
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
              },
            },
          });

          await this.publicationsService.addMedia(session.publicationId, userId, [
            {
              mediaId: media.id,
              order: session.metadata.mediaCount + newMediaCount,
              hasSpoiler: mediaItem.hasSpoiler || false,
            },
          ]);
          newMediaCount++;
        }
      }

      // Update session metadata
      await this.sessionService.updateMetadata(String(telegramId), {
        sourceTextsCount: newSourceTexts.length,
        mediaCount: session.metadata.mediaCount + newMediaCount,
      });

      // Delete old menu message asynchronously
      ctx.api.deleteMessage(message.chat.id, session.menuMessageId).catch(error => {
        this.logger.debug(`Could not delete old menu message during update: ${error.message}`);
      });

      // Prepare updated menu message
      const keyboard = new InlineKeyboard()
        .text(String(this.i18n.t('telegram.button_done', { lang })), 'done')
        .text(String(this.i18n.t('telegram.button_cancel', { lang })), 'cancel');

      const menuMessage = await ctx.reply(
        String(
          this.i18n.t('telegram.draft_updated', {
            lang,
            args: {
              content: truncateText(publication.content || ''),
              mediaCount: session.metadata.mediaCount + newMediaCount,
              sourceTextsCount: newSourceTexts.length,
            },
          }),
        ),
        { reply_markup: keyboard },
      );

      // Update session with new menu message ID
      await this.sessionService.setSession(String(telegramId), {
        ...session,
        menuMessageId: menuMessage.message_id,
        metadata: {
          sourceTextsCount: newSourceTexts.length,
          mediaCount: session.metadata.mediaCount + newMediaCount,
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
      await this.publicationsService.remove(session.publicationId, userId);

      // Delete session
      await this.sessionService.deleteSession(String(telegramId));

      // Send cancellation message
      const message = this.i18n.t('telegram.draft_cancelled', { lang });
      await ctx.editMessageText(String(message));

      // Store menu message ID so it can be deleted when creating new draft
      await this.sessionService.setLastMenuMessageId(String(telegramId), session.menuMessageId);
    } catch (error) {
      this.logger.error(`Error cancelling draft: ${error}`);
      // Still delete session even if publication deletion fails
      await this.sessionService.deleteSession(String(telegramId));

      const message = this.i18n.t('telegram.draft_cancelled', { lang });
      await ctx.editMessageText(String(message));

      // Store menu message ID even on error
      await this.sessionService.setLastMenuMessageId(String(telegramId), session.menuMessageId);
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
