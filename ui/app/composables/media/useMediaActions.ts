import { ref } from 'vue';
import { useApi, useApiAction, useI18n, logger } from '#imports';
import type { MediaItem, CreateMediaInput } from '~/types/media';

export function useMediaActions() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function createMedia(data: CreateMediaInput): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => await api.post<MediaItem>('/media', data),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
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
        return media;
      },
      { loadingRef: isLoading, errorRef: error, silentErrors: true }
    );
    return result;
  }

  async function deleteMedia(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.delete(`/media/${id}`),
      { loadingRef: isLoading, errorRef: error, successMessage: t('common.success') }
    );
    return !err;
  }

  async function updateMedia(id: string, data: Partial<CreateMediaInput>): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => await api.patch<MediaItem>(`/media/${id}`, data),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
    );
    return result;
  }

  async function fetchAllMedia(): Promise<MediaItem[]> {
    const [, result] = await executeAction(
      async () => await api.get<MediaItem[]>('/media'),
      { loadingRef: isLoading, errorRef: error, silentErrors: true }
    );
    return result || [];
  }

  async function addMediaToPublication(publicationId: string, media: CreateMediaInput[]): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.post(`/publications/${publicationId}/media`, { media }),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
    );
    return !err;
  }

  async function removeMediaFromPublication(publicationId: string, mediaId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.delete(`/publications/${publicationId}/media/${mediaId}`),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
    );
    return !err;
  }

  async function reorderMediaInPublication(publicationId: string, media: Array<{ id: string; order: number }>): Promise<void> {
    await executeAction(
      async () => await api.patch(`/publications/${publicationId}/media/reorder`, { media }),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
    );
  }

  async function updateMediaLinkInPublication(
    publicationId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number; alt?: string; description?: string }
  ): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.patch(`/publications/${publicationId}/media/${mediaLinkId}`, data),
      { loadingRef: isLoading, errorRef: error, throwOnError: true }
    );
    return !err;
  }

  return {
    isLoading,
    error,
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
