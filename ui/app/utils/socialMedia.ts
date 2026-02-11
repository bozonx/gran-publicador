import type { SocialMedia } from '~/types/socialMedia';
import {
  getConfiguredPlatformsOrEmpty,
  getPlatformColor,
  getPlatformIcon,
  getPlatformWeight,
  isConfiguredPlatform,
} from '~/utils/socialMediaPlatforms';

export const SOCIAL_MEDIA_WEIGHTS: Record<string, number> = Object.fromEntries(
  getConfiguredPlatformsOrEmpty().map(platform => [platform, getPlatformWeight(platform)]),
);

export function getSocialMediaColor(socialMedia: SocialMedia | string): string {
  return getPlatformColor(socialMedia);
}

export function getSocialMediaIcon(socialMedia: SocialMedia | string): string {
  return getPlatformIcon(socialMedia);
}

export function getSocialMediaDisplayName(
  socialMedia: SocialMedia | string,
  t: (key: string) => string,
): string {
  return t(`socialMedia.${String(socialMedia).toLowerCase()}`);
}

export function getSocialMediaOptions(t: (key: string) => string) {
  return getConfiguredPlatformsOrEmpty().map(platform => ({
    value: platform,
    label: t(`socialMedia.${platform.toLowerCase()}`),
  }));
}

export function isKnownConfiguredSocialMedia(value: unknown): value is SocialMedia {
  return isConfiguredPlatform(value);
}
