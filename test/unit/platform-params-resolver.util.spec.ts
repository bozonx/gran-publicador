import { describe, it, expect } from '@jest/globals';
import { SocialMedia } from '../../src/generated/prisma/index.js';
import { resolvePlatformParams } from '../../src/modules/social-posting/utils/platform-params-resolver.util.js';

describe('platform-params-resolver.util (unit)', () => {
  it('resolves Telegram params strictly from credentials (no channelIdentifier fallback)', () => {
    const res = resolvePlatformParams(SocialMedia.telegram, '@fromChannelIdentifier', {
      telegramChannelId: '@fromCredentials',
      telegramBotToken: '123:token',
    });

    expect(res).toEqual({
      channelId: '@fromCredentials',
      apiKey: '123:token',
    });
  });

  it('resolves VK params using channelIdentifier and vkAccessToken', () => {
    const res = resolvePlatformParams(SocialMedia.vk, 'club123', {
      vkAccessToken: 'vk-token',
    });

    expect(res).toEqual({
      channelId: 'club123',
      apiKey: 'vk-token',
    });
  });

  it('resolves default params using channelIdentifier and apiKey', () => {
    const res = resolvePlatformParams(SocialMedia.site, 'site-1', {
      apiKey: 'site-key',
    });

    expect(res).toEqual({
      channelId: 'site-1',
      apiKey: 'site-key',
    });
  });
});
