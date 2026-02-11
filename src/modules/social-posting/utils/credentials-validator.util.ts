import { SocialMedia } from '../../../generated/prisma/index.js';
import {
  getPlatformConfig,
  SocialMedia as SharedSocialMedia,
} from '@gran/shared/social-media-platforms';

export interface CredentialsValidationResult {
  valid: boolean;
  errors: string[];
}

function isSharedSocialMedia(value: unknown): value is SharedSocialMedia {
  return (
    typeof value === 'string' && (Object.values(SharedSocialMedia) as string[]).includes(value)
  );
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

  if (!isSharedSocialMedia(platform)) {
    return {
      valid: false,
      errors: [`Unknown platform: ${platform}`],
    };
  }

  const config = getPlatformConfig(platform);
  if (!config) {
    return {
      valid: false,
      errors: [`Unknown platform: ${platform}`],
    };
  }

  const requiredFields = config.credentials?.filter(f => f.required) ?? [];
  for (const field of requiredFields) {
    const value = (credentials as any)[field.key];
    const hasValue = value !== undefined && value !== null && String(value).trim().length > 0;
    if (!hasValue) {
      errors.push(`Missing required credential field: ${field.key}`);
    }
  }

  if (platform === SocialMedia.telegram) {
    errors.push(...validateTelegramCredentials(credentials));
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
function validateTelegramCredentials(credentials: any): string[] {
  const errors: string[] = [];

  // Check for telegramBotToken
  const botToken = credentials.telegramBotToken;
  if (!botToken) {
    // Missing is reported by required field validation
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
  const channelId = credentials.telegramChannelId;
  if (!channelId) {
    // Missing is reported by required field validation
  } else if (typeof channelId !== 'string' && typeof channelId !== 'number') {
    errors.push('telegramChannelId must be a string or number');
  }

  return errors;
}
