import { TelegramBotUpdate } from '../../src/modules/telegram-bot/telegram-bot.update.js';
import { describe, expect, it, jest } from '@jest/globals';

describe('TelegramBotUpdate', () => {
  const createCtx = (overrides: any = {}) => {
    return {
      from: { id: 100, username: 'u', language_code: 'en-US' },
      chat: { id: 200, type: 'private' },
      message: { message_id: 1, chat: { id: 200 } },
      reply: jest.fn(() => undefined),
      api: {
        getFile: jest.fn(),
        deleteMessage: jest.fn(),
      },
      ...overrides,
    };
  };

  const createDeps = (overrides: any = {}) => {
    const telegramMessagesQueue = {
      add: jest.fn(async () => ({ id: 'job1' })),
    };

    const redisService = {
      acquireLock: jest.fn(async () => 'lock-token'),
      releaseLock: jest.fn(async () => undefined),
    };

    const prisma: any = {
      contentItem: {
        create: jest.fn(() => ({ id: 'ci1' })),
        findFirst: jest.fn(() => null),
        findUnique: jest.fn(() => ({ text: null })),
        update: jest.fn(() => ({})),
      },
      contentItemMedia: {
        create: jest.fn(() => ({})),
        aggregate: jest.fn(() => ({ _max: { order: null } })),
        findFirst: jest.fn(() => null),
      },
    };
    prisma.$transaction = jest.fn(async (fn: any) => await fn(prisma));

    const usersService = {
      findByTelegramId: jest.fn(() => ({ id: 'user1', isBanned: false })),
      findOrCreateTelegramUser: jest.fn(() => ({ id: 'user1', uiLanguage: 'en-US' })),
    };

    const mediaService = {
      create: jest.fn(() => ({ id: 'm1' })),
    };

    const sttService = {
      transcribeAudioStream: jest.fn(),
    };

    const i18n = {
      t: jest.fn((key: string, options?: any) => {
        const args = options?.args ?? {};
        if (key === 'telegram.command_not_found') return `cmd:${String(args.command)}`;
        if (key === 'telegram.user_banned') return `banned:${String(args.reason)}`;
        return key;
      }),
    };

    const configService = {
      get: jest.fn(() => ({ telegramBotToken: 't' })),
    };

    const botApi = {
      sendMessage: jest.fn(async () => undefined),
      getFile: jest.fn(async () => ({ file_path: 'f' })),
    };

    return {
      telegramMessagesQueue,
      redisService,
      botApi,
      prisma,
      usersService,
      mediaService,
      sttService,
      i18n,
      configService,
      ...overrides,
    };
  };

  it('creates content item for text message and replies', async () => {
    const deps = createDeps();
    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx.message,
    });

    expect(deps.prisma.contentItem.create).toHaveBeenCalledTimes(1);
    expect(deps.botApi.sendMessage).toHaveBeenCalledWith(
      200,
      'telegram.content_item_created',
      undefined,
    );
  });

  it('includes Mini App button when TELEGRAM_MINI_APP_URL is configured', async () => {
    const deps = createDeps({
      configService: {
        get: jest.fn(() => ({
          telegramBotToken: 't',
          telegramMiniAppUrl: 'https://app.example.com',
        })),
      },
    });

    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx.message,
    });

    const call = deps.botApi.sendMessage.mock.calls.find(
      (c: any[]) => c[0] === 200 && c[1] === 'telegram.content_item_created',
    );
    expect(call).toBeTruthy();
    expect(call[2]).toMatchObject({
      reply_markup: {
        inline_keyboard: [
          [
            {
              web_app: {
                url: expect.stringContaining('/publications/quick-create?contentItemId=ci1'),
              },
            },
          ],
        ],
      },
    });
  });

  it('handles /start: creates user and replies with welcome + start_message', async () => {
    const deps = createDeps();
    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: '/start',
      },
    });

    await update.onStart(ctx);

    expect(deps.usersService.findOrCreateTelegramUser).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('telegram.welcome');
    expect(ctx.reply).toHaveBeenCalledWith('telegram.start_message');
  });

  it('for media_group_id replies only on first message, then silently appends media', async () => {
    const deps = createDeps();

    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx1 = createCtx({
      message: {
        message_id: 10,
        chat: { id: 200 },
        media_group_id: 'g1',
        photo: [{ file_id: 's1', file_size: 100, width: 90, height: 90 }],
      },
    });

    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx1.message,
    });
    expect(deps.botApi.sendMessage).toHaveBeenCalledWith(
      200,
      'telegram.content_item_created',
      undefined,
    );

    deps.prisma.contentItem.findFirst.mockResolvedValueOnce({
      id: 'ci1',
    });

    deps.prisma.contentItemMedia.findFirst.mockResolvedValueOnce(null);

    const ctx2 = createCtx({
      message: {
        message_id: 11,
        chat: { id: 200 },
        media_group_id: 'g1',
        photo: [{ file_id: 's2', file_size: 100, width: 90, height: 90 }],
      },
    });

    deps.botApi.sendMessage.mockClear();
    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx2.message,
    });
    expect(deps.botApi.sendMessage).not.toHaveBeenCalled();
    expect(deps.prisma.contentItemMedia.create).toHaveBeenCalled();
  });

  it('rejects unsupported message type', async () => {
    const deps = createDeps();
    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 2,
        chat: { id: 200 },
        sticker: { file_id: 'st1' },
      },
    });

    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx.message,
    });

    expect(deps.botApi.sendMessage).toHaveBeenCalledWith(
      200,
      'telegram.unsupported_message_type',
      undefined,
    );
    expect(deps.prisma.contentItem.create).not.toHaveBeenCalled();
  });

  it('does not create duplicates for the same telegram message', async () => {
    const deps = createDeps();

    deps.prisma.contentItem.findFirst.mockResolvedValueOnce({ id: 'ciExisting' });

    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.handleQueuedMessage({
      botApi: deps.botApi as any,
      lockKey: 'lock',
      telegramUserId: 100,
      chatId: 200,
      message: ctx.message,
    });

    expect(deps.prisma.contentItem.create).not.toHaveBeenCalled();
    expect(deps.botApi.sendMessage).not.toHaveBeenCalled();
  });

  it('enqueues a job on onMessage', async () => {
    const deps = createDeps();
    const update = new TelegramBotUpdate(
      deps.telegramMessagesQueue as any,
      deps.usersService,
      deps.prisma,
      deps.mediaService,
      deps.sttService,
      deps.i18n,
      deps.configService,
      deps.redisService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.onMessage(ctx);

    expect(deps.telegramMessagesQueue.add).toHaveBeenCalledTimes(1);
  });
});
