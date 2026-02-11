import { SocialMedia } from '../../../generated/prisma/index.js';

export interface PlatformParams {
  channelId: string;
  apiKey: string;
}

/**
 * Resolves channel ID and authentication token for a specific social media platform.
 * This ensures that correct fields from credentials are used for each platform.
 */
export function resolvePlatformParams(
  platform: SocialMedia,
  channelIdentifier: string,
  credentials: any,
): PlatformParams {
  switch (platform) {
    case SocialMedia.telegram:
      /**
       * For Telegram, we strictly use the telegramChannelId from credentials.
       * We DO NOT fallback to channelIdentifier as per user requirement.
       */
      return {
        channelId: credentials?.telegramChannelId || '',
        apiKey: credentials?.telegramBotToken || '',
      };

    case SocialMedia.vk:
      /**
       * For VK, channelIdentifier is used as the target ID (club or user ID).
       */
      return {
        channelId: channelIdentifier,
        apiKey: credentials?.vkAccessToken || '',
      };

    case SocialMedia.site:
      return {
        channelId: channelIdentifier,
        apiKey: credentials?.apiKey || '',
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
