import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMediaStore } from '~/stores/media';
import { useMediaActions } from './media/useMediaActions';
import { useMediaUpload } from './media/useMediaUpload';

export type { MediaItem, CreateMediaInput, MediaItemLike, MediaThumbData } from '~/types/media';

export function useMedia() {
  const store = useMediaStore();
  const { items, currentMedia, totalCount, isLoading, error } = storeToRefs(store);
  
  const actions = useMediaActions();
  const upload = useMediaUpload();

  const { 
    isLoading: actionsLoading, 
    error: actionsError, 
    items: _i, 
    currentMedia: _cm, 
    totalCount: _tc, 
    ...actionsMethods 
  } = actions;
  
  const { 
    isLoading: uploadLoading, 
    error: uploadError, 
    ...uploadMethods 
  } = upload;

  return {
    // State from store
    items,
    currentMedia,
    totalCount,
    isLoading,
    error,

    // Actions
    ...actionsMethods,
    ...uploadMethods,
  };
}
