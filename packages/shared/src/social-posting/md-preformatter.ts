import type { SocialMedia } from '../social-media-platforms.constants.js';

export interface MdPreformatParams {
  platform: SocialMedia;
  markdown: string;
}

export interface PlatformMdPreformatter {
  preformat(markdown: string): string;
}

class IdentityPreformatter implements PlatformMdPreformatter {
  preformat(markdown: string): string {
    return markdown;
  }
}

const DEFAULT_PREFORMATTER = new IdentityPreformatter();

const PLATFORM_PREFORMATTERS: Partial<Record<SocialMedia, PlatformMdPreformatter>> = {};

export function preformatMarkdownForPlatform(params: MdPreformatParams): string {
  const { platform, markdown } = params;

  const preformatter = PLATFORM_PREFORMATTERS[platform] ?? DEFAULT_PREFORMATTER;
  return preformatter.preformat(markdown ?? '');
}
