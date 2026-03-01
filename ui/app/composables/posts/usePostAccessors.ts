import { computed } from 'vue';
import type { PostWithRelations } from '~/composables/usePosts';
import type { PublicationWithRelations } from '~/composables/usePublications';
import type { ChannelWithProject } from '~/composables/useChannels';
import { getPostTitle, getPostType } from '~/composables/usePosts';
import { isTextContentEmpty } from '~/utils/text';
import { normalizeTags, parseTags } from '~/utils/tags';

export function usePostAccessors(
  props: { 
    post?: PostWithRelations; 
    publication?: PublicationWithRelations;
    availableChannels?: ChannelWithProject[];
    channels?: ChannelWithProject[];
    isCreating?: boolean;
  },
  formData: { content: string; authorSignature: string; channelId: string }
) {
  const selectedChannel = computed(() => {
    if (props.isCreating) {
      return props.availableChannels?.find(c => c.id === formData.channelId);
    }
    // Try to find full channel object in props.channels
    if (props.channels && props.post?.channelId) {
      const pid = props.post.channelId;
      const found = props.channels.find(c => c.id === pid);
      if (found) return found;
    }
    return props.post?.channel as ChannelWithProject | undefined;
  });

  const publicationLanguage = computed(() => {
    return props.publication?.language || props.post?.publication?.language;
  });

  const channelLanguage = computed(() => {
    return selectedChannel.value?.language;
  });

  const displayLanguage = computed(() => {
    // Priority: Channel language (since this block is for a post in a specific channel)
    return channelLanguage.value || publicationLanguage.value;
  });

  function coerceTagsToArray(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return normalizeTags((raw as any[]).map(tag => String(tag ?? '')));
    }

    if (typeof raw === 'string') {
      return normalizeTags(parseTags(raw));
    }

    return [];
  }

  const overriddenTags = computed(() => {
    return coerceTagsToArray(props.post?.tags);
  });

  const displayTitle = computed(() => (props.post ? getPostTitle(props.post) : props.publication?.title));
  
  const isPostContentOverride = computed(() => !isTextContentEmpty(formData.content));
  
  const displayContent = computed(() => {
    if (!isPostContentOverride.value) return props.publication?.content || '';
    return formData.content;
  });

  const displayAuthorSignature = computed(() => formData.authorSignature);

  const displayTags = computed(() => {
    if (overriddenTags.value.length > 0) return overriddenTags.value;
    return coerceTagsToArray(props.publication?.tags);
  });

  const displayType = computed(() => (props.post ? getPostType(props.post) : props.publication?.postType));

  return {
    coerceTagsToArray,
    overriddenTags,
    displayTitle,
    isPostContentOverride,
    displayContent,
    displayAuthorSignature,
    displayTags,
    displayType,
    selectedChannel,
    publicationLanguage,
    channelLanguage,
    displayLanguage,
  };
}
