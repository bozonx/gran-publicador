import { SocialMedia } from '../../generated/prisma/enums.js';

import {
  getValidationRules,
  SocialMediaValidationRules,
} from './social-media-validation.constants.js';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Post validation data interface
 */
export interface PostValidationData {
  content?: string | null;
  mediaCount: number;
  socialMedia: SocialMedia;
}

/**
 * Strip HTML tags from content for length calculation
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Calculate text length without HTML tags
 */
function getTextLength(content: string | null | undefined): number {
  if (!content) return 0;
  return stripHtmlTags(content).length;
}

/**
 * Validate post content based on social media platform rules
 */
export function validatePostContent(
  data: PostValidationData,
): ValidationResult {
  const errors: string[] = [];
  const rules = getValidationRules(data.socialMedia);

  const contentLength = getTextLength(data.content);
  const hasMedia = data.mediaCount > 0;

  // Check if content is caption (when media is present) or text post
  if (hasMedia) {
    // Validate caption length
    if (contentLength > rules.maxCaptionLength) {
      errors.push(
        `Caption length (${contentLength}) exceeds maximum allowed (${rules.maxCaptionLength}) for ${data.socialMedia}`,
      );
    }
  } else {
    // Validate text post length
    if (contentLength > rules.maxTextLength) {
      errors.push(
        `Text length (${contentLength}) exceeds maximum allowed (${rules.maxTextLength}) for ${data.socialMedia}`,
      );
    }
  }

  // Validate media count
  if (data.mediaCount > rules.maxMediaCount) {
    errors.push(
      `Media count (${data.mediaCount}) exceeds maximum allowed (${rules.maxMediaCount}) for ${data.socialMedia}`,
    );
  }

  // Check minimum media count if required
  if (rules.minMediaCount && data.mediaCount < rules.minMediaCount) {
    errors.push(
      `Media count (${data.mediaCount}) is below minimum required (${rules.minMediaCount}) for ${data.socialMedia}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get validation rules for display in UI
 */
export function getValidationRulesForDisplay(
  socialMedia: SocialMedia,
): SocialMediaValidationRules {
  return getValidationRules(socialMedia);
}
