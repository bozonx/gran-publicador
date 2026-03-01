import { computed } from 'vue';
import type { Ref } from 'vue';
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation';

export interface PostValidationOptions {
  displayContent: Ref<string>;
  mediaCount: Ref<number>;
  selectedChannel: Ref<{ socialMedia: string | null } | undefined | null>;
  mediaArray: Ref<Array<{ type: string }>>;
  displayType: Ref<string | undefined>;
}

export function usePostValidation(options: PostValidationOptions) {
  const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation();

  const validationResult = computed(() => {
    if (!options.selectedChannel.value?.socialMedia) {
      return { isValid: true, errors: [] };
    }

    return validatePostContent(
      options.displayContent.value,
      options.mediaCount.value,
      options.selectedChannel.value.socialMedia as any,
      options.mediaArray.value,
      options.displayType.value
    );
  });

  const contentLength = computed(() => {
    return getContentLength(options.displayContent.value);
  });

  const remainingCharacters = computed(() => {
    if (!options.selectedChannel.value?.socialMedia) return null;

    return getRemainingCharacters(
      options.displayContent.value,
      options.mediaCount.value,
      options.selectedChannel.value.socialMedia as any
    );
  });

  return {
    validationResult,
    contentLength,
    remainingCharacters,
  };
}
