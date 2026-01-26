import { SocialMedia } from '../../../generated/prisma/index.js';

export interface CredentialsValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates platform-specific credentials based on bozonx-social-media-posting requirements
 */
export function validatePlatformCredentials(
  platform: SocialMedia,
  credentials: any,
): CredentialsValidationResult {
  const errors: string[] = [];

  if (!credentials || typeof credentials !== 'object') {
    return {
      valid: false,
      errors: ['Credentials must be a valid object'],
    };
  }

  switch (platform) {
    case SocialMedia.TELEGRAM:
      return validateTelegramCredentials(credentials);

    case SocialMedia.VK:
    case SocialMedia.YOUTUBE:
    case SocialMedia.TIKTOK:
    case SocialMedia.FACEBOOK:
    case SocialMedia.SITE:
      errors.push(`Platform ${platform} is not yet supported for publishing`);
      break;

    default:
      errors.push(`Unknown platform: ${platform}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Telegram credentials
 * Required: botToken (mapped to apiKey in library)
 */
function validateTelegramCredentials(credentials: any): CredentialsValidationResult {
  const errors: string[] = [];

  // Check for telegramBotToken
  const botToken = credentials.telegramBotToken || credentials.botToken;
  if (!botToken) {
    errors.push('Telegram credentials must include telegramBotToken');
  } else if (typeof botToken !== 'string') {
    errors.push('telegramBotToken must be a string');
  } else {
    // Validate botToken format (should contain ':')
    if (!botToken.includes(':')) {
      errors.push('telegramBotToken must be in format "bot_id:token"');
    }

    // Check minimum length
    if (botToken.length < 20) {
      errors.push('telegramBotToken appears to be too short');
    }
  }

  // Check for telegramChannelId
  const channelId = credentials.telegramChannelId || credentials.chatId;
  if (!channelId) {
    errors.push('Telegram credentials must include telegramChannelId');
  } else if (typeof channelId !== 'string' && typeof channelId !== 'number') {
    errors.push('telegramChannelId must be a string or number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
