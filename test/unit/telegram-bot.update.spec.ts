import { TelegramBotUpdate } from '../../src/modules/telegram-bot/telegram-bot.update.js';
import { jest } from '@jest/globals';

describe('TelegramBotUpdate', () => {
  const createCtx = (overrides: any = {}) => {
    return {
      from: { id: 100, username: 'u', language_code: 'en-US' },
      chat: { id: 200, type: 'private' },
      message: { message_id: 1, chat: { id: 200 } },
      reply: jest.fn(async () => undefined),
      api: {
        getFile: jest.fn(),
        deleteMessage: jest.fn(),
      },
      ...overrides,
    };
  };

  const createDeps = (overrides: any = {}) => {
    let prisma: any;
    prisma = {
      contentItem: {
        create: jest.fn(async () => ({ id: 'ci1' })),
      },
      contentBlock: {
        create: jest.fn(async () => ({ id: 'cb1' })),
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => ({ text: null })),
        update: jest.fn(async () => ({})),
      },
      contentBlockMedia: {
        create: jest.fn(async () => ({})),
        aggregate: jest.fn(async () => ({ _max: { order: null } })),
        findFirst: jest.fn(async () => null),
      },
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const usersService = {
      findByTelegramId: jest.fn(async () => ({ id: 'user1', isBanned: false })),
      findOrCreateTelegramUser: jest.fn(async () => ({ id: 'user1' })),
    };

    const mediaService = {
      create: jest.fn(async () => ({ id: 'm1' })),
    };

    const sttService = {
      transcribeAudioStream: jest.fn(),
    };

    const i18n = {
      t: jest.fn((key: string, options?: any) => {
        const args = options?.args ?? {};
        if (key === 'telegram.command_not_found') return `cmd:${args.command}`;
        if (key === 'telegram.user_banned') return `banned:${args.reason}`;
        return key;
      }),
    };

    const configService = {
      get: jest.fn(() => ({ telegramBotToken: 't' })),
    };

    return {
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
      deps.usersService as any,
      deps.prisma as any,
      deps.mediaService as any,
      deps.sttService as any,
      deps.i18n as any,
      deps.configService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.onMessage(ctx as any);
    await (update as any).userQueues.get(100)?.onIdle();

    expect(deps.prisma.contentItem.create).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('telegram.content_item_created');
  });

  it('for media_group_id replies only on first message, then silently appends media', async () => {
    const deps = createDeps();

    const update = new TelegramBotUpdate(
      deps.usersService as any,
      deps.prisma as any,
      deps.mediaService as any,
      deps.sttService as any,
      deps.i18n as any,
      deps.configService as any,
    );

    const ctx1 = createCtx({
      message: {
        message_id: 10,
        chat: { id: 200 },
        media_group_id: 'g1',
        photo: [{ file_id: 's1', file_size: 100, width: 90, height: 90 }],
      },
    });

    await update.onMessage(ctx1 as any);
    await (update as any).userQueues.get(100)?.onIdle();
    expect(ctx1.reply).toHaveBeenCalledWith('telegram.content_item_created');

    deps.prisma.contentBlock.findFirst.mockResolvedValueOnce({
      id: 'cbExisting',
      contentItemId: 'ci1',
    });

    const ctx2 = createCtx({
      message: {
        message_id: 11,
        chat: { id: 200 },
        media_group_id: 'g1',
        photo: [{ file_id: 's2', file_size: 100, width: 90, height: 90 }],
      },
    });

    await update.onMessage(ctx2 as any);
    await (update as any).userQueues.get(100)?.onIdle();
    expect(ctx2.reply).not.toHaveBeenCalled();
    expect(deps.prisma.contentBlockMedia.create).toHaveBeenCalled();
  });

  it('rejects unsupported message type', async () => {
    const deps = createDeps();
    const update = new TelegramBotUpdate(
      deps.usersService as any,
      deps.prisma as any,
      deps.mediaService as any,
      deps.sttService as any,
      deps.i18n as any,
      deps.configService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 2,
        chat: { id: 200 },
        sticker: { file_id: 'st1' },
      },
    });

    await update.onMessage(ctx as any);
    await (update as any).userQueues.get(100)?.onIdle();

    expect(ctx.reply).toHaveBeenCalledWith('telegram.unsupported_message_type');
    expect(deps.prisma.contentItem.create).not.toHaveBeenCalled();
  });

  it('does not create duplicates for the same telegram message', async () => {
    const deps = createDeps();

    deps.prisma.contentBlock.findFirst.mockResolvedValueOnce({ id: 'cbExisting' });

    const update = new TelegramBotUpdate(
      deps.usersService as any,
      deps.prisma as any,
      deps.mediaService as any,
      deps.sttService as any,
      deps.i18n as any,
      deps.configService as any,
    );

    const ctx = createCtx({
      message: {
        message_id: 1,
        chat: { id: 200 },
        text: 'Hello',
      },
    });

    await update.onMessage(ctx as any);
    await (update as any).userQueues.get(100)?.onIdle();

    expect(deps.prisma.contentItem.create).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalledWith('telegram.content_item_created');
  });
});
