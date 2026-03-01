import { computed } from 'vue';
import { useMediaActions } from './media/useMediaActions';
import { useMediaUpload } from './media/useMediaUpload';

export type { MediaItem, CreateMediaInput, MediaItemLike, MediaThumbData } from '~/types/media';

export function useMedia() {
  const actions = useMediaActions();
  const upload = useMediaUpload();
  const { isLoading: actionsLoading, error: actionsError, ...actionsMethods } = actions;
  const { isLoading: uploadLoading, error: uploadError, ...uploadMethods } = upload;

  return {
    // State (merging isLoading and error from both)
    isLoading: computed(() => actionsLoading.value || uploadLoading.value),
    error: computed(() => actionsError.value || uploadError.value),

    // Actions
    ...actionsMethods,
    ...uploadMethods,
  };
}
