import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { SKIP, visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

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

export enum PostType {
  POST = 'POST',
  ARTICLE = 'ARTICLE',
  NEWS = 'NEWS',
  VIDEO = 'VIDEO',
  SHORT = 'SHORT',
  STORY = 'STORY',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export interface SocialMediaValidationRules {
  maxTextLength: number;
  maxCaptionLength: number;
  maxMediaCount: number;
  minMediaCount?: number;
  allowedMediaTypes?: string[];
  allowedGalleryMediaTypes?: string[];
  maxMediaCountForGallery?: number;
}

let rulesCache: Record<string, SocialMediaValidationRules> | null = null;
let rulesPromise: Promise<void> | null = null;

async function ensureRulesLoaded(api: ReturnType<typeof useApi>): Promise<void> {
  if (rulesCache) return;
  if (rulesPromise) return rulesPromise;

  rulesPromise = (async () => {
    const res = await api.get<{ rules: Record<string, SocialMediaValidationRules> }>(
      '/posts/validation-rules',
    );
    rulesCache = res?.rules ?? null;
  })();

  return rulesPromise;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Strip HTML tags from content for length calculation
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function getPlainTextFromMarkdown(markdown: string): string {
  const tree = unified().use(remarkParse).parse(markdown);

  visit(tree as any, 'html', (_node: any, index?: number, parent?: any) => {
    if (!parent || typeof index !== 'number') return;

    const children = (parent.children ?? []) as any[];
    children.splice(index, 1);

    return SKIP;
  });

  return toString(tree as any);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return Number.isFinite(num) ? String.fromCodePoint(num) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const num = Number.parseInt(code, 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : _;
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getPlainTextForLength(content: string): string {
  return decodeHtmlEntities(stripHtmlTags(getPlainTextFromMarkdown(content)));
}

/**
 * Calculate text length without HTML tags
 */
function getTextLength(content: string | null | undefined): number {
  if (!content) return 0;
  return getPlainTextForLength(content).trim().length;
}

/**
 * Validate media types based on platform rules
 */
function validateMediaTypes(
  media: Array<{ type: string }>,
  rules: SocialMediaValidationRules,
  platform: string,
  postType?: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const mediaCount = media.length;

  // Check if this is a gallery (2+ files) or single file
  const isGallery = mediaCount > 1;

  // Telegram ARTICLE override: only 1 IMAGE allowed
  if (platform === SocialMedia.TELEGRAM && postType === PostType.ARTICLE) {
    if (isGallery) {
      errors.push({
        field: 'media',
        message: 'Telegram Article (telegra.ph) does not support galleries. Only one image is allowed.',
      });
    } else if (mediaCount === 1 && media[0]) {
      if (media[0].type !== MediaType.IMAGE) {
        errors.push({
          field: 'media',
          message: `Telegram Article (telegra.ph) only allows IMAGE type, but found: ${media[0].type}`,
        });
      }
    }
    return errors;
  }

  if (isGallery) {
    // Validate gallery media types
    if (rules.allowedGalleryMediaTypes && rules.allowedGalleryMediaTypes.length > 0) {
      const invalidMedia = media.filter(
        (m) => !rules.allowedGalleryMediaTypes!.includes(m.type),
      );
      if (invalidMedia.length > 0) {
        const invalidTypes = [...new Set(invalidMedia.map((m) => m.type))].join(', ');
        const allowedTypes = rules.allowedGalleryMediaTypes.join(', ');
        errors.push({
          field: 'media',
          message: `Gallery for ${platform} only allows ${allowedTypes}, but found: ${invalidTypes}`,
        });
      }
    }

    // Validate gallery count
    if (rules.maxMediaCountForGallery && mediaCount > rules.maxMediaCountForGallery) {
      errors.push({
        field: 'media',
        message: `Gallery has too many files (${mediaCount}) for ${platform}. Maximum for gallery: ${rules.maxMediaCountForGallery}`,
      });
    }
  } else if (mediaCount === 1) {
    // Validate single file media type
    if (rules.allowedMediaTypes && media[0]) {
      const mediaType = media[0].type;
      if (!rules.allowedMediaTypes.includes(mediaType)) {
        const allowedTypes = rules.allowedMediaTypes.join(', ');
        errors.push({
          field: 'media',
          message: `Media type ${mediaType} is not allowed for ${platform}. Allowed types: ${allowedTypes}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Composable for social media post validation
 */
export function useSocialMediaValidation() {
  const { t } = useI18n();
  const api = useApi();

  void ensureRulesLoaded(api);

  /**
   * Get validation rules for a specific platform
   */
  function getValidationRules(socialMedia: SocialMedia): SocialMediaValidationRules {
    const rules = rulesCache?.[socialMedia];
    return (
      rules ?? {
        maxTextLength: Number.MAX_SAFE_INTEGER,
        maxCaptionLength: Number.MAX_SAFE_INTEGER,
        maxMediaCount: Number.MAX_SAFE_INTEGER,
      }
    );
  }

  /**
   * Validate post content based on platform rules
   */
  function validatePostContent(
    content: string | null | undefined,
    mediaCount: number,
    socialMedia: SocialMedia,
    media?: Array<{ type: string }>,
    postType?: string,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const rules = getValidationRules(socialMedia);

    if (!rulesCache) {
      return { isValid: true, errors: [] };
    }

    const contentLength = getTextLength(content);
    const hasMedia = mediaCount > 0;

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
        });
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
        });
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
      });
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
      });
    }

    // Validate media types if media array is provided
    if (media && media.length > 0) {
      const mediaTypeErrors = validateMediaTypes(media, rules, socialMedia, postType);
      errors.push(...mediaTypeErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get character count for content (without HTML)
   */
  function getContentLength(content: string | null | undefined): number {
    return getTextLength(content);
  }

  /**
   * Get remaining characters for content
   */
  function getRemainingCharacters(
    content: string | null | undefined,
    mediaCount: number,
    socialMedia: SocialMedia,
  ): number {
    const rules = getValidationRules(socialMedia);
    const contentLength = getTextLength(content);
    const hasMedia = mediaCount > 0;

    const maxLength = hasMedia ? rules.maxCaptionLength : rules.maxTextLength;
    return maxLength - contentLength;
  }

  return {
    ensureRulesLoaded: () => ensureRulesLoaded(api),
    getValidationRules,
    validatePostContent,
    getContentLength,
    getRemainingCharacters,
  };
}
