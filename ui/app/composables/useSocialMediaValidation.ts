import {
  getPlatformConfig,
  SocialMedia,
} from '@gran/shared/social-media-platforms'
import {
  getValidationRules,
  getTextLength,
  validateMediaTypes,
  type ValidationError,
  type ValidationResult,
} from '~/utils/social-media-validation'

export type { SocialMediaValidationRules, ValidationError, ValidationResult } from '~/utils/social-media-validation'

/**
 * Composable for social media post validation
 */
export function useSocialMediaValidation() {
  const { t } = useI18n()

  /**
   * Validate post content based on platform rules
   */
  function validatePostContent(
    content: string | null | undefined,
    mediaCount: number,
    socialMedia: SocialMedia,
    media?: Array<{ type: string }>,
    postType?: string,
    tags?: string[],
  ): ValidationResult {
    const errors: ValidationError[] = []
    const rules = getValidationRules(socialMedia, postType)

    const contentLength = getTextLength(content)
    const hasMedia = mediaCount > 0

    // Check if content is caption (when media is present) or text post
    if (hasMedia) {
      // Validate caption length
      if (contentLength > rules.maxCaptionLength) {
        errors.push({
          field: 'content',
          message: t('validation.socialMedia.captionTooLong', {
            current: contentLength,
            max: rules.maxCaptionLength,
            platform: socialMedia,
          }),
        })
      }
    } else {
      // Validate text post length
      if (contentLength > rules.maxTextLength) {
        errors.push({
          field: 'content',
          message: t('validation.socialMedia.textTooLong', {
            current: contentLength,
            max: rules.maxTextLength,
            platform: socialMedia,
          }),
        })
      }
    }

    // Validate media count
    if (mediaCount > rules.maxMediaCount) {
      errors.push({
        field: 'media',
        message: t('validation.socialMedia.tooManyMedia', {
          current: mediaCount,
          max: rules.maxMediaCount,
          platform: socialMedia,
        }),
      })
    }

    // Check minimum media count if required
    if (rules.minMediaCount && mediaCount < rules.minMediaCount) {
      errors.push({
        field: 'media',
        message: t('validation.socialMedia.notEnoughMedia', {
          current: mediaCount,
          min: rules.minMediaCount,
          platform: socialMedia,
        }),
      })
    }

    // Validate media types if media array is provided
    if (media && media.length > 0) {
      const mediaTypeErrors = validateMediaTypes(media, rules, socialMedia)
      // Translate messages if any
      mediaTypeErrors.forEach(err => {
        // Here we just keep the message from utils if we don't have a specific translation
        // but it's better to have it translated in composable
        errors.push(err)
      })
    }

    // Validate tags count
    if (tags && tags.length > 0) {
      const platformConfig = getPlatformConfig(socialMedia)
      if (platformConfig && platformConfig.tags && platformConfig.tags.supported) {
        if (tags.length > platformConfig.tags.maxCount) {
          errors.push({
            field: 'tags',
            message: t('validation.socialMedia.tooManyTags', {
              current: tags.length,
              max: platformConfig.tags.maxCount,
              platform: socialMedia,
            }),
          })
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get character count for content (without HTML)
   */
  function getContentLength(content: string | null | undefined): number {
    return getTextLength(content)
  }

  /**
   * Get remaining characters for content
   */
  function getRemainingCharacters(
    content: string | null | undefined,
    mediaCount: number,
    socialMedia: SocialMedia,
  ): number {
    const rules = getValidationRules(socialMedia)
    const contentLength = getTextLength(content)
    const hasMedia = mediaCount > 0

    const maxLength = hasMedia ? rules.maxCaptionLength : rules.maxTextLength
    return maxLength - contentLength
  }

  return {
    getValidationRules,
    validatePostContent,
    getContentLength,
    getRemainingCharacters,
  }
}

