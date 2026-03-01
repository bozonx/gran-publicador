import { computed } from 'vue';
import { useApi, useApiAction, useI18n, logger } from '#imports';
import { useMediaStore } from '~/stores/media';
import type { MediaItem, CreateMediaInput } from '~/types/media';

export function useMediaActions() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();
  const store = useMediaStore();

  // Helper bindings for store state to be used with executeAction
  const loadingBinding = computed({
    get: () => store.isLoading,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => store.error,
    set: (val) => store.setError(val)
  });

  async function createMedia(data: CreateMediaInput): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const media = await api.post<MediaItem>('/media', data);
        store.setItems([media, ...store.items]);
        store.setTotalCount(store.totalCount + 1);
        return media;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
    return result;
  }

  async function fetchMedia(id: string): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const media = await api.get<MediaItem>(`/media/${id}`);
        if (media && media.storageType === 'STORAGE') {
          try {
            const fullInfo = await api.get<any>(`/media/${id}/info`);
            if (fullInfo) media.fullMediaMeta = fullInfo;
          } catch (e) {
            logger.error('Failed to fetch full media info', e);
          }
        }
        store.setCurrentMedia(media);
        return media;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result;
  }

  async function deleteMedia(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/media/${id}`);
        store.removeMediaFromList(id);
        store.setTotalCount(Math.max(0, store.totalCount - 1));
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.success') }
    );
    return !err;
  }

  async function updateMedia(id: string, data: Partial<CreateMediaInput>): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const updated = await api.patch<MediaItem>(`/media/${id}`, data);
        store.updateMediaInList(id, updated);
        return updated;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
    return result;
  }

  async function fetchAllMedia(params?: { projectId?: string; limit?: number; offset?: number; search?: string }): Promise<MediaItem[]> {
    const [, result] = await executeAction(
      async () => {
        const response = await api.get<any>('/media', { params });
        // Handle both simple array and paginated response
        const items = Array.isArray(response) ? response : response.items;
        const total = Array.isArray(response) ? items.length : (response.total ?? items.length);
        
        if (params?.offset && params.offset > 0) {
          store.appendItems(items);
        } else {
          store.setItems(items);
        }
        store.setTotalCount(total);
        return items;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result || [];
  }

  async function addMediaToPublication(publicationId: string, media: CreateMediaInput[]): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.post(`/publications/${publicationId}/media`, { media }),
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
    return !err;
  }

  async function removeMediaFromPublication(publicationId: string, mediaId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.delete(`/publications/${publicationId}/media/${mediaId}`),
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
    return !err;
  }

  async function reorderMediaInPublication(publicationId: string, media: Array<{ id: string; order: number }>): Promise<void> {
    await executeAction(
      async () => await api.patch(`/publications/${publicationId}/media/reorder`, { media }),
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
  }

  async function updateMediaLinkInPublication(
    publicationId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number; alt?: string; description?: string }
  ): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.patch(`/publications/${publicationId}/media/${mediaLinkId}`, data),
      { loadingRef: loadingBinding, errorRef: errorBinding, throwOnError: true }
    );
    return !err;
  }

  return {
    items: computed(() => store.items),
    currentMedia: computed(() => store.currentMedia),
    totalCount: computed(() => store.totalCount),
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    createMedia,
    fetchMedia,
    deleteMedia,
    updateMedia,
    fetchAllMedia,
    addMediaToPublication,
    removeMediaFromPublication,
    reorderMediaInPublication,
    updateMediaLinkInPublication,
  };
}
