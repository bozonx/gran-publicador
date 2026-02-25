import { ref } from 'vue';
import type { PublicationStatus, PostStatus } from '~/types/posts';
import { isTextContentEmpty } from '~/utils/text';

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
  const api = useApi();
  const isPublishing = ref(false);
  const publishError = ref<string | null>(null);
  const { validatePostContent } = useSocialMediaValidation();

  /**
   * Publish all posts of a publication
   */
  const publishPublication = async (
    publicationId: string,
    force = false,
  ): Promise<PublishResponse> => {
    isPublishing.value = true;
    publishError.value = null;

    try {
      const response = await api.post<PublishResponse>(
        `/publications/${publicationId}/publish?force=${force}`,
      );

      return response;
    } catch (error: any) {
      publishError.value = error.message || 'Failed to publish publication';
      throw error;
    } finally {
      isPublishing.value = false;
    }
  };

  /**
   * Publish all posts of a publication immediately
   */
  const publishPublicationNow = async (publicationId: string): Promise<PublishResponse> => {
    isPublishing.value = true;
    publishError.value = null;

    try {
      const response = await api.post<PublishResponse>(
        `/publications/${publicationId}/publish-now`,
      );

      return response;
    } catch (error: any) {
      publishError.value = error.message || 'Failed to publish publication immediately';
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
      const response = await api.post<PublishResponse>(`/posts/${postId}/publish`);

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
    const hasContent = !isTextContentEmpty(publication.content);
    const hasMedia = Array.isArray(publication.media) && publication.media.length > 0;

    // Check if publication has at least one post
    const hasPosts = Array.isArray(publication.posts) && publication.posts.length > 0;

    if (!(hasContent || hasMedia) || !hasPosts) return false;

    // Validate against social media rules
    if (publication.posts) {
      const mediaArray = publication.media?.map((m: any) => ({ type: m.media?.type })) || [];
      const mediaCount = mediaArray.length;

      for (const post of publication.posts) {
        if (post.channel?.socialMedia) {
          const result = validatePostContent(
            post.content || publication.content,
            mediaCount,
            post.channel.socialMedia,
            mediaArray,
            publication.postType,
          );
          if (!result.isValid) return false;
        }
      }
    }

    return true;
  };

  /**
   * Check if post can be published
   */
  const canPublishPost = (post: any, publication?: any): boolean => {
    if (!post) return false;

    // Check if publication has content or media
    const pub = publication || post.publication;
    if (!pub) return false;

    const hasContent = !isTextContentEmpty(post.content || pub.content);
    const hasMedia = Array.isArray(pub.media) && pub.media.length > 0;

    if (!(hasContent || hasMedia)) return false;

    // Validate against social media rules
    if (post.channel?.socialMedia) {
      const mediaArray = pub.media?.map((m: any) => ({ type: m.media?.type })) || [];
      const result = validatePostContent(
        post.content || pub.content,
        mediaArray.length,
        post.channel.socialMedia,
        mediaArray,
        pub.postType,
      );
      if (!result.isValid) return false;
    }

    return true;
  };

  /**
   * Check if channel is ready for publishing
   */
  const canPublishToChannel = (channel: any): boolean => {
    if (!channel) return false;

    // Check if channel is active and not archived
    if (!channel.isActive || channel.archivedAt || channel.project?.archivedAt) return false;

    // Check if channel has identifier
    if (!channel.channelIdentifier) return false;

    return !!channel.credentials;
  };

  return {
    isPublishing,
    publishError,
    publishPublication,
    publishPublicationNow,
    publishPost,
    canPublishPublication,
    canPublishPost,
    canPublishToChannel,
  };
};
