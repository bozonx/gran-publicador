import { ref } from 'vue';
import type { PublicationStatus, PostStatus } from '~/types/posts';

interface PublishResponse {
  success: boolean;
  message: string;
  data?: {
    publicationId?: string;
    postId?: string;
    status: PublicationStatus | PostStatus;
    publishedCount?: number;
    failedCount?: number;
    results?: Array<{
      postId: string;
      channelId: string;
      success: boolean;
      error?: string;
    }>;
  };
}

export const useSocialPosting = () => {
  const isPublishing = ref(false);
  const publishError = ref<string | null>(null);

  /**
   * Publish all posts of a publication
   */
  const publishPublication = async (publicationId: string): Promise<PublishResponse> => {
    isPublishing.value = true;
    publishError.value = null;

    try {
      const response = await $fetch<PublishResponse>(`/api/publications/${publicationId}/publish`, {
        method: 'POST',
      });

      return response;
    } catch (error: any) {
      publishError.value = error.message || 'Failed to publish publication';
      throw error;
    } finally {
      isPublishing.value = false;
    }
  };

  /**
   * Publish a single post
   */
  const publishPost = async (postId: string): Promise<PublishResponse> => {
    isPublishing.value = true;
    publishError.value = null;

    try {
      const response = await $fetch<PublishResponse>(`/api/posts/${postId}/publish`, {
        method: 'POST',
      });

      return response;
    } catch (error: any) {
      publishError.value = error.message || 'Failed to publish post';
      throw error;
    } finally {
      isPublishing.value = false;
    }
  };

  /**
   * Check if publication can be published
   */
  const canPublishPublication = (publication: any): boolean => {
    if (!publication) return false;

    // Check if publication has content or media
    const hasContent = !!(publication.content && publication.content.trim());
    const hasMedia = publication.media && publication.media.length > 0;

    if (!hasContent && !hasMedia) {
      return false;
    }

    // Check if publication has posts
    if (!publication.posts || publication.posts.length === 0) {
      return false;
    }

    // Check if at least one channel is ready
    return publication.posts.some((post: any) => {
      if (!post.channel) return false;
      return canPublishToChannel(post.channel);
    });
  };

  /**
   * Check if post can be published
   */
  const canPublishPost = (post: any, publication?: any): boolean => {
    if (!post) return false;

    // Check if publication has content or media
    const pub = publication || post.publication;
    if (!pub) return false;

    const hasContent = !!(pub.content && pub.content.trim());
    const hasMedia = pub.media && pub.media.length > 0;

    if (!hasContent && !hasMedia) {
      return false;
    }

    // Check if channel is ready
    const channel = post.channel;
    if (!channel) return false;

    return canPublishToChannel(channel);
  };

  /**
   * Check if channel is ready for publishing
   */
  const canPublishToChannel = (channel: any): boolean => {
    if (!channel) return false;

    // Check if channel is active
    if (!channel.isActive) return false;

    // Check if channel is archived
    if (channel.archivedAt) return false;

    // Check if project is archived
    if (channel.project?.archivedAt) return false;

    // Check if channel has identifier
    if (!channel.channelIdentifier) return false;

    // Check if channel has credentials
    if (!channel.credentials) return false;

    try {
      const credentials = typeof channel.credentials === 'string' 
        ? JSON.parse(channel.credentials) 
        : channel.credentials;

      // For Telegram, check telegramBotToken
      if (channel.socialMedia === 'TELEGRAM') {
        const token = credentials.telegramBotToken || credentials.botToken;
        return !!(token && token.includes(':'));
      }

      // For VK, check vkAccessToken
      if (channel.socialMedia === 'VK') {
        return !!(credentials.vkAccessToken || credentials.accessToken);
      }

      // For other platforms, just check if credentials exist
      return !!credentials && Object.keys(credentials).length > 0;
    } catch {
      return false;
    }
  };

  return {
    isPublishing,
    publishError,
    publishPublication,
    publishPost,
    canPublishPublication,
    canPublishPost,
    canPublishToChannel,
  };
};
