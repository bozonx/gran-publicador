import { describe, it, expect } from '@jest/globals';
import { SocialMedia } from '../../src/generated/prisma/index.js';
import { validatePlatformCredentials } from '../../src/modules/social-posting/utils/credentials-validator.util.js';

describe('credentials-validator.util (unit)', () => {
  it('returns error for non-object credentials', () => {
    const res = validatePlatformCredentials(SocialMedia.telegram, null);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Credentials must be a valid object');
  });

  it('validates Telegram required fields using shared config', () => {
    const res = validatePlatformCredentials(SocialMedia.telegram, {});
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Missing required credential field: telegramBotToken');
    expect(res.errors).toContain('Missing required credential field: telegramChannelId');
  });

  it('adds Telegram format errors in addition to required field checks', () => {
    const res = validatePlatformCredentials(SocialMedia.telegram, {
      telegramBotToken: 'shorttoken',
      telegramChannelId: '@test',
    });

    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('telegramBotToken must be in format');
    expect(res.errors.join(' ')).toContain('too short');
  });

  it('does not accept legacy Telegram botToken key', () => {
    const res = validatePlatformCredentials(SocialMedia.telegram, {
      botToken: '123:token',
      telegramChannelId: '@test',
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Missing required credential field: telegramBotToken');
  });

  it('returns valid for VK when required fields are present', () => {
    const res = validatePlatformCredentials(SocialMedia.vk, {
      vkAccessToken: 'token',
    });

    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('returns errors for VK when required fields are missing', () => {
    const res = validatePlatformCredentials(SocialMedia.vk, {});

    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Missing required credential field: vkAccessToken');
  });

  it('returns valid for SITE when required fields are present', () => {
    const res = validatePlatformCredentials(SocialMedia.site, {
      apiKey: 'key',
    });

    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('returns errors for SITE when required fields are missing', () => {
    const res = validatePlatformCredentials(SocialMedia.site, {});

    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Missing required credential field: apiKey');
  });
});
