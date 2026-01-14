import { SocialMedia } from '../../generated/prisma/enums.js';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { SKIP, visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

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
  media?: Array<{ type: string }>;
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

export function getPlainTextForLength(content: string): string {
  return decodeHtmlEntities(stripHtmlTags(getPlainTextFromMarkdown(content)));
}

/**
 * Calculate text length without HTML tags
 */
export function getTextLength(content: string | null | undefined): number {
  if (!content) return 0;
  return getPlainTextForLength(content).length;
}

export function normalizeOverrideContent(
  content: string | null | undefined,
): string | null | undefined {
  if (content === undefined) return undefined;
  if (content === null) return null;
  if (getPlainTextForLength(content).trim().length === 0) return null;
  return content;
}

/**
 * Validate media types based on platform rules
 */
function validateMediaTypes(
  media: Array<{ type: string }>,
  rules: SocialMediaValidationRules,
  socialMedia: SocialMedia,
): string[] {
  const errors: string[] = [];
  const mediaCount = media.length;

  // Check if this is a gallery (2+ files) or single file
  const isGallery = mediaCount > 1;

  if (isGallery) {
    // Validate gallery media types
    if (rules.allowedGalleryMediaTypes) {
      const invalidMedia = media.filter(
        (m) => !rules.allowedGalleryMediaTypes!.includes(m.type as any),
      );
      if (invalidMedia.length > 0) {
        const invalidTypes = [...new Set(invalidMedia.map((m) => m.type))].join(', ');
        const allowedTypes = rules.allowedGalleryMediaTypes.join(', ');
        errors.push(
          `Gallery for ${socialMedia} only allows ${allowedTypes}, but found: ${invalidTypes}`,
        );
      }
    }

    // Validate gallery count
    if (rules.maxMediaCountForGallery && mediaCount > rules.maxMediaCountForGallery) {
      errors.push(
        `Gallery has too many files (${mediaCount}) for ${socialMedia}. Maximum for gallery: ${rules.maxMediaCountForGallery}`,
      );
    }
  } else if (mediaCount === 1) {
    // Validate single file media type
    if (rules.allowedMediaTypes) {
      const mediaType = media[0].type;
      if (!rules.allowedMediaTypes.includes(mediaType as any)) {
        const allowedTypes = rules.allowedMediaTypes.join(', ');
        errors.push(
          `Media type ${mediaType} is not allowed for ${socialMedia}. Allowed types: ${allowedTypes}`,
        );
      }
    }
  }

  return errors;
}

/**
 * Validate post content based on social media platform rules
 */
export function validatePostContent(data: PostValidationData): ValidationResult {
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

  // Validate media types if media array is provided
  if (data.media && data.media.length > 0) {
    const mediaTypeErrors = validateMediaTypes(data.media, rules, data.socialMedia);
    errors.push(...mediaTypeErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get validation rules for display in UI
 */
export function getValidationRulesForDisplay(socialMedia: SocialMedia): SocialMediaValidationRules {
  return getValidationRules(socialMedia);
}
