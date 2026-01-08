import { SocialMedia } from '../../../generated/prisma/client.js';

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
function validateTelegramCredentials(
  credentials: any,
): CredentialsValidationResult {
  const errors: string[] = [];

  // Check for botToken
  if (!credentials.botToken) {
    errors.push('Telegram credentials must include botToken');
  } else if (typeof credentials.botToken !== 'string') {
    errors.push('botToken must be a string');
  } else {
    // Validate botToken format (should contain ':')
    if (!credentials.botToken.includes(':')) {
      errors.push('botToken must be in format "bot_id:token"');
    }

    // Check minimum length
    if (credentials.botToken.length < 20) {
      errors.push('botToken appears to be too short');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
