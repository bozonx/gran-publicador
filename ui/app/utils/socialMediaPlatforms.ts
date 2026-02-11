import {
  getConfiguredPlatforms,
  getPlatformConfig,
  getPostTypeConfig,
  PostType,
  SocialMedia,
} from '@gran/shared/social-media-platforms';

export type { PostType, SocialMedia };

export interface PostTypeOption {
  value: PostType;
  label: string;
}

export function getConfiguredPlatformsOrEmpty(): SocialMedia[] {
  return getConfiguredPlatforms();
}

export function getSupportedPostTypesIntersection(
  platforms: Array<SocialMedia | null | undefined>,
): PostType[] {
  const uniquePlatforms = [...new Set(platforms.filter(Boolean))] as SocialMedia[];
  if (uniquePlatforms.length === 0) return [];

  const postTypesByPlatform = uniquePlatforms
    .map(p => getPlatformConfig(p)?.supportedPostTypes)
    .filter(Boolean) as PostType[][];

  if (postTypesByPlatform.length === 0) return [];

  const [first, ...rest] = postTypesByPlatform;
  if (!first) return [];

  return first.filter(type => rest.every(types => types.includes(type)));
}

export function getPostTypeOptionsForPlatforms(params: {
  t: (key: string) => string;
  platforms: Array<SocialMedia | null | undefined>;
}): PostTypeOption[] {
  const { t, platforms } = params;
  const supported = getSupportedPostTypesIntersection(platforms);

  return supported.map(value => ({
    value,
    label: t(`postType.${value.toLowerCase()}`),
  }));
}

export function getPlatformColor(platform: SocialMedia | string): string {
  if (!isConfiguredPlatform(platform)) return '#6b7280';
  return getPlatformConfig(platform)?.ui.color ?? '#6b7280';
}

export function getPlatformIcon(platform: SocialMedia | string): string {
  if (!isConfiguredPlatform(platform)) return 'i-heroicons-hashtag';
  return getPlatformConfig(platform)?.ui.icon ?? 'i-heroicons-hashtag';
}

export function getPlatformWeight(platform: SocialMedia | string): number {
  if (!isConfiguredPlatform(platform)) return 99;
  return getPlatformConfig(platform)?.ui.weight ?? 99;
}

export function isConfiguredPlatform(platform: unknown): platform is SocialMedia {
  return (
    typeof platform === 'string' &&
    (getConfiguredPlatformsOrEmpty() as readonly string[]).includes(platform)
  );
}

export function getAggregatedMaxTextLength(params: {
  platforms: Array<SocialMedia | null | undefined>;
  postType: PostType;
  hasMedia: boolean;
}): number | null {
  const { platforms, postType, hasMedia } = params;
  const uniquePlatforms = [...new Set(platforms.filter(Boolean))] as SocialMedia[];
  if (uniquePlatforms.length === 0) return null;

  const lengths = uniquePlatforms
    .map(p => getPostTypeConfig(p, postType)?.content)
    .filter(Boolean)
    .map(content => (hasMedia ? content!.maxCaptionLength : content!.maxTextLength));

  if (lengths.length === 0) return null;

  return Math.min(...lengths);
}

export function getAggregatedTagsConfig(platforms: Array<SocialMedia | null | undefined>): {
  supported: boolean;
  maxCount: number | null;
  recommendedCount: number | null;
} {
  const uniquePlatforms = [...new Set(platforms.filter(Boolean))] as SocialMedia[];
  if (uniquePlatforms.length === 0) {
    return { supported: false, maxCount: null, recommendedCount: null };
  }

  const tags = uniquePlatforms.map(p => getPlatformConfig(p)?.tags).filter(Boolean);

  if (tags.length === 0) {
    return { supported: false, maxCount: null, recommendedCount: null };
  }

  const supported = tags.every(t => t!.supported);
  if (!supported) {
    return { supported: false, maxCount: null, recommendedCount: null };
  }

  return {
    supported: true,
    maxCount: Math.min(...tags.map(t => t!.maxCount)),
    recommendedCount: Math.min(...tags.map(t => t!.recommendedCount)),
  };
}

export interface PlatformTagsLimits {
  platform: SocialMedia;
  supported: boolean;
  maxCount: number | null;
  recommendedCount: number | null;
  maxTagLength: number | null;
}

export function getTagsLimitsByPlatform(
  platforms: Array<SocialMedia | null | undefined>,
): PlatformTagsLimits[] {
  const uniquePlatforms = [...new Set(platforms.filter(Boolean))] as SocialMedia[];
  if (uniquePlatforms.length === 0) return [];

  return uniquePlatforms.map(platform => {
    const cfg = getPlatformConfig(platform);
    const tags = cfg?.tags;
    if (!tags) {
      return {
        platform,
        supported: false,
        maxCount: null,
        recommendedCount: null,
        maxTagLength: null,
      };
    }

    return {
      platform,
      supported: Boolean(tags.supported),
      maxCount: Number.isFinite(tags.maxCount) ? tags.maxCount : null,
      recommendedCount: Number.isFinite(tags.recommendedCount) ? tags.recommendedCount : null,
      maxTagLength: Number.isFinite(tags.constraints?.maxTagLength)
        ? (tags.constraints!.maxTagLength as number)
        : null,
    };
  });
}
