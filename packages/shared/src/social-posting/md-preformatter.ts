import { SocialMedia } from '../social-media-platforms.constants.js';

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

class CleanupPreformatter implements PlatformMdPreformatter {
  preformat(markdown: string): string {
    if (!markdown) return markdown;

    return (
      markdown
        // Remove tg:// mentions, leaving just the user text
        .replace(/\[([^\]]+)\]\(tg:\/\/user\?id=\d+\)/g, '$1')
        // Remove <u> tags, leaving the text inside
        .replace(/<\/?u>/g, '')
        // Remove ||spoiler|| markers, leaving the text inside
        .replace(/\|\|([\s\S]*?)\|\|/g, '$1')
    );
  }
}

const DEFAULT_PREFORMATTER = new IdentityPreformatter();
const CLEANUP_PREFORMATTER = new CleanupPreformatter();

const PLATFORM_PREFORMATTERS: Partial<Record<SocialMedia, PlatformMdPreformatter>> = {
  [SocialMedia.TELEGRAM]: DEFAULT_PREFORMATTER,
  [SocialMedia.VK]: CLEANUP_PREFORMATTER,
  [SocialMedia.SITE]: CLEANUP_PREFORMATTER,
};

export function preformatMarkdownForPlatform(params: MdPreformatParams): string {
  const { platform, markdown } = params;

  const preformatter = PLATFORM_PREFORMATTERS[platform] ?? DEFAULT_PREFORMATTER;
  return preformatter.preformat(markdown ?? '');
}
