import { SocialMedia, MediaType } from '../../generated/prisma/enums.js';


/**
 * Validation rules for different social media platforms
 */
export interface SocialMediaValidationRules {
  // Maximum length for text-only posts
  maxTextLength: number;
  // Maximum length for caption when media files are present
  maxCaptionLength: number;
  // Maximum number of media files per post
  maxMediaCount: number;
  // Minimum media count (if media is required)
  minMediaCount?: number;
  // Allowed media types for single file (when mediaCount === 1)
  allowedMediaTypes?: MediaType[];
  // Allowed media types for gallery (when mediaCount > 1)
  allowedGalleryMediaTypes?: MediaType[];
  // Maximum number of media files for gallery (when mediaCount > 1)
  maxMediaCountForGallery?: number;
}

/**
 * Platform-specific validation rules
 */
export const SOCIAL_MEDIA_VALIDATION_RULES: Record<
  SocialMedia,
  SocialMediaValidationRules
> = {
  [SocialMedia.TELEGRAM]: {
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    maxMediaCount: 10,
    maxMediaCountForGallery: 10,
    allowedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO, MediaType.AUDIO, MediaType.DOCUMENT],
    allowedGalleryMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
  },
  [SocialMedia.VK]: {
    maxTextLength: 16384,
    maxCaptionLength: 16384,
    maxMediaCount: 10,
  },
  [SocialMedia.YOUTUBE]: {
    maxTextLength: 5000,
    maxCaptionLength: 5000,
    maxMediaCount: 1,
    minMediaCount: 1,
  },
  [SocialMedia.TIKTOK]: {
    maxTextLength: 2200,
    maxCaptionLength: 2200,
    maxMediaCount: 1,
    minMediaCount: 1,
  },
  [SocialMedia.FACEBOOK]: {
    maxTextLength: 63206,
    maxCaptionLength: 63206,
    maxMediaCount: 10,
  },
  [SocialMedia.SITE]: {
    maxTextLength: 100000,
    maxCaptionLength: 100000,
    maxMediaCount: 1,
    allowedMediaTypes: [MediaType.IMAGE],
  },
};

/**
 * Get validation rules for a specific social media platform
 */
export function getValidationRules(
  socialMedia: SocialMedia,
): SocialMediaValidationRules {
  return SOCIAL_MEDIA_VALIDATION_RULES[socialMedia];
}
