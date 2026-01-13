/**
 * Social media validation rules for client-side
 */

export enum SocialMedia {
  TELEGRAM = 'TELEGRAM',
  VK = 'VK',
  YOUTUBE = 'YOUTUBE',
  TIKTOK = 'TIKTOK',
  FACEBOOK = 'FACEBOOK',
  SITE = 'SITE',
}

export interface SocialMediaValidationRules {
  maxTextLength: number
  maxCaptionLength: number
  maxMediaCount: number
  minMediaCount?: number
}

const VALIDATION_RULES: Record<SocialMedia, SocialMediaValidationRules> = {
  [SocialMedia.TELEGRAM]: {
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    maxMediaCount: 10,
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
    maxMediaCount: 50,
  },
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Strip HTML tags from content for length calculation
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Calculate text length without HTML tags
 */
function getTextLength(content: string | null | undefined): number {
  if (!content) return 0
  return stripHtmlTags(content).length
}

/**
 * Composable for social media post validation
 */
export function useSocialMediaValidation() {
  const { t } = useI18n()

  /**
   * Get validation rules for a specific platform
   */
  function getValidationRules(socialMedia: SocialMedia): SocialMediaValidationRules {
    return VALIDATION_RULES[socialMedia]
  }

  /**
   * Validate post content based on platform rules
   */
  function validatePostContent(
    content: string | null | undefined,
    mediaCount: number,
    socialMedia: SocialMedia
  ): ValidationResult {
    const errors: ValidationError[] = []
    const rules = getValidationRules(socialMedia)
    
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
    socialMedia: SocialMedia
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
