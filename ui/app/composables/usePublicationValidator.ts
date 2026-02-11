import type { ValidationError } from '~/types/publication-form';
import type { Channel } from '~/types/channels';
import type { PublicationWithRelations } from '~/composables/usePublications';

/**
 * Composable for validating publication content against social media constraints
 */
export function usePublicationValidator() {
  const { validatePostContent } = useSocialMediaValidation();

  /**
   * Validate publication content for selected channels
   */
  function validateForChannels(
    content: string,
    mediaCount: number,
    mediaArray: Array<{ type: string }>,
    postType: string,
    selectedChannelIds: string[],
    availableChannels: Channel[],
    channelMap?: Record<string, { name: string; socialMedia: string }>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    const resolvedMap: Record<string, { name: string; socialMedia: string }> =
      channelMap ??
      Object.fromEntries(
        availableChannels.map(c => [c.id, { name: c.name, socialMedia: c.socialMedia }]),
      );

    selectedChannelIds.forEach(id => {
      const channel = resolvedMap[id];
      if (channel && channel.socialMedia) {
        const result = validatePostContent(
          content,
          mediaCount,
          channel.socialMedia as any,
          mediaArray,
          postType,
        );

        if (!result.isValid) {
          result.errors.forEach(err => {
            errors.push({
              channel: channel.name,
              message: err.message,
            });
          });
        }
      }
    });

    return errors;
  }

  /**
   * Validate publication content for existing posts
   */
  function validateForExistingPosts(
    content: string,
    mediaCount: number,
    mediaArray: Array<{ type: string }>,
    postType: string,
    publication: PublicationWithRelations | null,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const { isTextContentEmpty } = useTextUtils();

    if (!publication?.posts) return errors;

    publication.posts.forEach((post: any) => {
      // Check if post inherits content: null, undefined, or empty string
      const isInherited = isTextContentEmpty(post.content);
      const hasChannel = post.channel && post.channel.socialMedia;

      if (isInherited && hasChannel) {
        const result = validatePostContent(
          content,
          mediaCount,
          post.channel.socialMedia as any,
          mediaArray,
          postType,
        );

        if (!result.isValid) {
          result.errors.forEach(err => {
            errors.push({
              channel: post.channel.name,
              message: err.message,
            });
          });
        }
      }
    });

    return errors;
  }

  return {
    validateForChannels,
    validateForExistingPosts,
  };
}

/**
 * Helper composable for text utilities
 */
function useTextUtils() {
  function isTextContentEmpty(content: string | null | undefined): boolean {
    return !content || content.trim() === '';
  }

  return {
    isTextContentEmpty,
  };
}
