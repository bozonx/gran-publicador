import { SocialMedia, PostType, MediaType } from '../../generated/prisma/index.js';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type BodyFormat = 'html' | 'markdown' | 'plain';

/**
 * Content limits for a specific post type on a platform.
 */
export interface PlatformPostTypeContentLimits {
  /** Maximum text length for text-only posts (no media) */
  maxTextLength: number;
  /** Maximum caption length when media is attached */
  maxCaptionLength: number;
  /** Maximum caption length depending on media type (falls back to maxCaptionLength) */
  maxCaptionLengthByMediaType?: Partial<Record<MediaType, number>>;
  /** Maximum title length depending on media type (platform-specific; optional) */
  maxTitleLengthByMediaType?: Partial<Record<MediaType, number>>;
}

/**
 * Media constraints for a specific post type on a platform.
 */
export interface PlatformPostTypeMediaLimits {
  /** Maximum number of media files */
  maxCount: number;
  /** Minimum number of media files (0 = media is optional) */
  minCount: number;
  /** Maximum number of media files in a gallery (2+ items) */
  maxGalleryCount: number;
  /** Allowed media types for a single file */
  allowedTypes: MediaType[];
  /** Allowed media types in a gallery (2+ items) */
  allowedGalleryTypes: MediaType[];
  /** Maximum file size in bytes depending on media type (optional) */
  maxFileSizeBytesByType?: Partial<Record<MediaType, number>>;
  /** Maximum video duration in seconds (optional; platform-specific) */
  maxVideoDurationSeconds?: number;
}

/**
 * Full configuration for a single post type on a platform.
 */
export interface PlatformPostTypeConfig {
  content: PlatformPostTypeContentLimits;
  media: PlatformPostTypeMediaLimits;
}

/**
 * Tags support configuration for a platform.
 */
export interface PlatformTagsConfig {
  /** Whether the platform supports tags/hashtags */
  supported: boolean;
  /** Maximum number of tags allowed */
  maxCount: number;
  /** Recommended number of tags for best engagement */
  recommendedCount: number;
  /** How tags are delivered to the posting service */
  delivery: 'inline' | 'separate' | 'both';
}

/**
 * Platform feature flags.
 */
export interface PlatformFeatures {
  /** Body format used when sending to the posting service */
  bodyFormat: BodyFormat;
  /** Whether the platform supports placing caption above media */
  supportsCaptionAboveMedia: boolean;
  /** Whether the platform supports a separate title field */
  supportsTitle: boolean;
  /** Whether the platform supports a separate description field */
  supportsDescription: boolean;
  /** Whether media can be marked as spoiler */
  supportsHasSpoiler: boolean;
  /** Whether silent/no-notification sending is supported */
  supportsDisableNotification: boolean;
  /** Whether the platform supports scheduling via API */
  supportsScheduling: boolean;
}

/**
 * Credential field descriptor.
 */
export interface PlatformCredentialField {
  /** Field key in the credentials object */
  key: string;
  /** Whether this field is required */
  required: boolean;
  /** Human-readable label */
  label: string;
}

/**
 * UI display configuration for a platform.
 */
export interface PlatformUIConfig {
  /** Brand color (hex) */
  color: string;
  /** Icon class (e.g. UnoCSS icon) */
  icon: string;
  /** Sort weight for display ordering (lower = higher priority) */
  weight: number;
}

/**
 * Complete platform configuration.
 */
export interface SocialMediaPlatformConfig {
  /** Post types supported by this platform */
  supportedPostTypes: PostType[];
  /** Per-post-type configuration (content limits, media limits) */
  postTypes: Partial<Record<PostType, PlatformPostTypeConfig>>;
  /** Tags support configuration */
  tags: PlatformTagsConfig;
  /** Platform feature flags */
  features: PlatformFeatures;
  /** Required credential fields */
  credentials: PlatformCredentialField[];
  /** UI display configuration */
  ui: PlatformUIConfig;
}

// ────────────────────────────────────────────────────────────────────────────
// Shared defaults
// ────────────────────────────────────────────────────────────────────────────

const ALL_MEDIA_TYPES: MediaType[] = [
  MediaType.IMAGE,
  MediaType.VIDEO,
  MediaType.AUDIO,
  MediaType.DOCUMENT,
];

const VISUAL_MEDIA_TYPES: MediaType[] = [MediaType.IMAGE, MediaType.VIDEO];

const MB_BYTES = 1024 * 1024;

// ────────────────────────────────────────────────────────────────────────────
// Platform configurations
// ────────────────────────────────────────────────────────────────────────────

const TELEGRAM_CONFIG: SocialMediaPlatformConfig = {
  supportedPostTypes: [PostType.POST, PostType.ARTICLE, PostType.NEWS],

  postTypes: {
    [PostType.POST]: {
      content: {
        maxTextLength: 4096,
        maxCaptionLength: 1024,
        maxCaptionLengthByMediaType: {
          [MediaType.IMAGE]: 1024,
          [MediaType.VIDEO]: 1024,
          [MediaType.AUDIO]: 1024,
          [MediaType.DOCUMENT]: 1024,
        },
      },
      media: {
        maxCount: 10,
        minCount: 0,
        maxGalleryCount: 10,
        allowedTypes: ALL_MEDIA_TYPES,
        allowedGalleryTypes: VISUAL_MEDIA_TYPES,
        maxFileSizeBytesByType: {
          [MediaType.IMAGE]: 50 * MB_BYTES,
          [MediaType.VIDEO]: 50 * MB_BYTES,
          [MediaType.AUDIO]: 50 * MB_BYTES,
          [MediaType.DOCUMENT]: 50 * MB_BYTES,
        },
      },
    },
    [PostType.NEWS]: {
      content: {
        maxTextLength: 4096,
        maxCaptionLength: 1024,
        maxCaptionLengthByMediaType: {
          [MediaType.IMAGE]: 1024,
          [MediaType.VIDEO]: 1024,
          [MediaType.AUDIO]: 1024,
          [MediaType.DOCUMENT]: 1024,
        },
      },
      media: {
        maxCount: 10,
        minCount: 0,
        maxGalleryCount: 10,
        allowedTypes: ALL_MEDIA_TYPES,
        allowedGalleryTypes: VISUAL_MEDIA_TYPES,
        maxFileSizeBytesByType: {
          [MediaType.IMAGE]: 50 * MB_BYTES,
          [MediaType.VIDEO]: 50 * MB_BYTES,
          [MediaType.AUDIO]: 50 * MB_BYTES,
          [MediaType.DOCUMENT]: 50 * MB_BYTES,
        },
      },
    },
    [PostType.ARTICLE]: {
      content: {
        // Telegraph articles have a generous limit (~64 KB)
        maxTextLength: 65536,
        maxCaptionLength: 65536,
      },
      media: {
        // Only a single cover image is supported
        maxCount: 1,
        minCount: 0,
        maxGalleryCount: 0,
        allowedTypes: [MediaType.IMAGE],
        allowedGalleryTypes: [],
        maxFileSizeBytesByType: {
          [MediaType.IMAGE]: 50 * MB_BYTES,
        },
      },
    },
  },

  tags: {
    supported: true,
    maxCount: 15,
    recommendedCount: 5,
    // Tags are embedded into the body text, not sent as a separate field
    delivery: 'inline',
  },

  features: {
    bodyFormat: 'html',
    supportsCaptionAboveMedia: true,
    supportsTitle: false,
    supportsDescription: false,
    supportsHasSpoiler: true,
    supportsDisableNotification: true,
    supportsScheduling: false,
  },

  credentials: [
    { key: 'telegramBotToken', required: true, label: 'Bot Token' },
    { key: 'telegramChannelId', required: true, label: 'Channel ID' },
  ],

  ui: {
    color: '#0088cc',
    icon: 'i-simple-icons-telegram',
    weight: 3,
  },
};

const VK_CONFIG: SocialMediaPlatformConfig = {
  supportedPostTypes: [PostType.POST, PostType.ARTICLE, PostType.NEWS],

  postTypes: {
    [PostType.POST]: {
      content: {
        maxTextLength: 16384,
        maxCaptionLength: 16384,
      },
      media: {
        maxCount: 10,
        minCount: 0,
        maxGalleryCount: 10,
        allowedTypes: ALL_MEDIA_TYPES,
        allowedGalleryTypes: ALL_MEDIA_TYPES,
      },
    },
    [PostType.NEWS]: {
      content: {
        maxTextLength: 16384,
        maxCaptionLength: 16384,
      },
      media: {
        maxCount: 10,
        minCount: 0,
        maxGalleryCount: 10,
        allowedTypes: ALL_MEDIA_TYPES,
        allowedGalleryTypes: ALL_MEDIA_TYPES,
      },
    },
    [PostType.ARTICLE]: {
      content: {
        // VK articles (wiki pages) support long content
        maxTextLength: 65536,
        maxCaptionLength: 65536,
      },
      media: {
        maxCount: 10,
        minCount: 0,
        maxGalleryCount: 10,
        allowedTypes: [MediaType.IMAGE, MediaType.VIDEO],
        allowedGalleryTypes: [MediaType.IMAGE, MediaType.VIDEO],
      },
    },
  },

  tags: {
    supported: true,
    maxCount: 30,
    recommendedCount: 10,
    // VK supports hashtags both inline and as a separate field
    delivery: 'both',
  },

  features: {
    bodyFormat: 'markdown',
    supportsCaptionAboveMedia: false,
    supportsTitle: true,
    supportsDescription: true,
    supportsHasSpoiler: false,
    supportsDisableNotification: false,
    supportsScheduling: true,
  },

  credentials: [{ key: 'vkAccessToken', required: true, label: 'Access Token' }],

  ui: {
    color: '#4a76a8',
    icon: 'i-simple-icons-vk',
    weight: 1,
  },
};

const SITE_CONFIG: SocialMediaPlatformConfig = {
  supportedPostTypes: [PostType.ARTICLE],

  postTypes: {
    [PostType.ARTICLE]: {
      content: {
        maxTextLength: 500_000,
        maxCaptionLength: 500_000,
      },
      media: {
        maxCount: 100,
        minCount: 0,
        maxGalleryCount: 100,
        allowedTypes: [MediaType.IMAGE],
        allowedGalleryTypes: [MediaType.IMAGE],
      },
    },
  },

  tags: {
    supported: true,
    maxCount: 50,
    recommendedCount: 10,
    delivery: 'separate',
  },

  features: {
    bodyFormat: 'markdown',
    supportsCaptionAboveMedia: false,
    supportsTitle: true,
    supportsDescription: true,
    supportsHasSpoiler: false,
    supportsDisableNotification: false,
    supportsScheduling: true,
  },

  credentials: [{ key: 'apiKey', required: true, label: 'API Key' }],

  ui: {
    color: '#6b7280',
    icon: 'i-heroicons-globe-alt',
    weight: 4,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────

/**
 * Unified social media platform configuration registry.
 * Single source of truth for platform capabilities, limits, and UI settings.
 *
 * Currently covers: TELEGRAM, VK, SITE.
 * Other platforms (YOUTUBE, TIKTOK, FACEBOOK) can be added later.
 */
export const SOCIAL_MEDIA_PLATFORMS: Partial<Record<SocialMedia, SocialMediaPlatformConfig>> = {
  [SocialMedia.TELEGRAM]: TELEGRAM_CONFIG,
  [SocialMedia.VK]: VK_CONFIG,
  [SocialMedia.SITE]: SITE_CONFIG,
};

// ────────────────────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get the full platform configuration or undefined if not configured.
 */
export function getPlatformConfig(platform: SocialMedia): SocialMediaPlatformConfig | undefined {
  return SOCIAL_MEDIA_PLATFORMS[platform];
}

/**
 * Get post type configuration for a specific platform and post type.
 * Falls back to POST config if the requested post type is not configured.
 */
export function getPostTypeConfig(
  platform: SocialMedia,
  postType: PostType,
): PlatformPostTypeConfig | undefined {
  const config = SOCIAL_MEDIA_PLATFORMS[platform];
  if (!config) return undefined;

  return config.postTypes[postType] ?? config.postTypes[PostType.POST];
}

/**
 * Check if a platform supports a given post type.
 */
export function isPlatformPostTypeSupported(platform: SocialMedia, postType: PostType): boolean {
  const config = SOCIAL_MEDIA_PLATFORMS[platform];
  if (!config) return false;

  return config.supportedPostTypes.includes(postType);
}

/**
 * Get all configured platform keys.
 */
export function getConfiguredPlatforms(): SocialMedia[] {
  return Object.keys(SOCIAL_MEDIA_PLATFORMS) as SocialMedia[];
}
