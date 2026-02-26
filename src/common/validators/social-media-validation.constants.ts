import { MediaType, type PostType, type SocialMedia } from '../../generated/prisma/index.js';
import {
  getPostTypeConfig,
  type MediaType as SharedMediaType,
  PostType as SharedPostType,
  SocialMedia as SharedSocialMedia,
} from '@gran/shared/social-media-platforms';

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

function isSharedSocialMedia(value: unknown): value is SharedSocialMedia {
  return (
    typeof value === 'string' && (Object.values(SharedSocialMedia) as string[]).includes(value)
  );
}

function isSharedPostType(value: unknown): value is SharedPostType {
  return typeof value === 'string' && (Object.values(SharedPostType) as string[]).includes(value);
}

function toSharedSocialMedia(platform: SocialMedia): SharedSocialMedia | undefined {
  switch (platform) {
    case 'TELEGRAM':
      return SharedSocialMedia.TELEGRAM;
    case 'VK':
      return SharedSocialMedia.VK;
    case 'SITE':
      return SharedSocialMedia.SITE;
    default:
      return undefined;
  }
}

function toSharedPostType(postType: PostType | null | undefined): SharedPostType | undefined {
  if (postType == null) {
    return SharedPostType.POST;
  }
  switch (postType) {
    case 'POST':
      return SharedPostType.POST;
    case 'ARTICLE':
      return SharedPostType.ARTICLE;
    case 'NEWS':
      return SharedPostType.NEWS;
    case 'STORY':
      return SharedPostType.STORY;
    case 'VIDEO':
      return SharedPostType.VIDEO;
    default:
      return undefined;
  }
}

function mapSharedMediaTypesToPrisma(types: SharedMediaType[]): MediaType[] {
  const allowed = new Set(Object.values(MediaType) as string[]);
  const result: MediaType[] = [];
  for (const t of types) {
    if (!allowed.has(t)) {
      throw new Error(`Shared MediaType value is not present in Prisma enum: ${t}`);
    }
    result.push(t as unknown as MediaType);
  }
  return result;
}

export function getValidationRules(
  socialMedia: SocialMedia,
  postType?: PostType,
): SocialMediaValidationRules | undefined {
  const sharedPlatform = toSharedSocialMedia(socialMedia);
  if (!sharedPlatform) return undefined;

  const sharedPostType = toSharedPostType(postType);
  if (!sharedPostType) return undefined;

  const postTypeConfig = getPostTypeConfig(sharedPlatform, sharedPostType);
  if (!postTypeConfig) return undefined;

  const maxTextLength = postTypeConfig.content.maxTextLength;
  const maxCaptionLength = postTypeConfig.content.maxCaptionLength;

  const maxMediaCount = postTypeConfig.media.maxCount;
  const minMediaCount = postTypeConfig.media.minCount || undefined;
  const maxMediaCountForGallery = postTypeConfig.media.maxGalleryCount || undefined;

  const allowedMediaTypes = mapSharedMediaTypesToPrisma(postTypeConfig.media.allowedTypes);
  const allowedGalleryMediaTypes = mapSharedMediaTypesToPrisma(
    postTypeConfig.media.allowedGalleryTypes,
  );

  return {
    maxTextLength,
    maxCaptionLength,
    maxMediaCount,
    minMediaCount,
    maxMediaCountForGallery,
    allowedMediaTypes,
    allowedGalleryMediaTypes,
  };
}

export function getValidationRulesOrThrow(
  socialMedia: SocialMedia,
  postType?: PostType,
): SocialMediaValidationRules {
  const rules = getValidationRules(socialMedia, postType);
  if (!rules) {
    throw new Error(
      `Unsupported platform or post type: platform=${socialMedia}, postType=${postType}`,
    );
  }
  return rules;
}
