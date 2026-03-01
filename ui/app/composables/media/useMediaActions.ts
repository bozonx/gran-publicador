import { ref } from 'vue';
import { useApi } from '../useApi';
import type { MediaItem, CreateMediaInput } from '~/types/media';

export function useMediaActions() {
  const api = useApi();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function createMedia(data: CreateMediaInput): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.post<MediaItem>('/media', data);
    } catch (err: any) {
      error.value = err.message || 'Failed to create media';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchMedia(id: string): Promise<MediaItem | null> {
    isLoading.value = true;
    error.value = null;
    try {
      const media = await api.get<MediaItem>(`/media/${id}`);
      if (media && media.storageType === 'STORAGE') {
        try {
          const fullInfo = await api.get<any>(`/media/${id}/info`);
          if (fullInfo) media.fullMediaMeta = fullInfo;
        } catch (e) {
          console.error('Failed to fetch full media info', e);
        }
      }
      return media;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch media';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteMedia(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.delete(`/media/${id}`);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to delete media';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateMedia(id: string, data: Partial<CreateMediaInput>): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.patch<MediaItem>(`/media/${id}`, data);
    } catch (err: any) {
      error.value = err.message || 'Failed to update media';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAllMedia(): Promise<MediaItem[]> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.get<MediaItem[]>('/media');
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch all media';
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function addMediaToPublication(publicationId: string, media: CreateMediaInput[]): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.post(`/publications/${publicationId}/media`, { media });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to add media to publication';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function removeMediaFromPublication(publicationId: string, mediaId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.delete(`/publications/${publicationId}/media/${mediaId}`);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to remove media from publication';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function reorderMediaInPublication(publicationId: string, media: Array<{ id: string; order: number }>): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.patch(`/publications/${publicationId}/media/reorder`, { media });
    } catch (err: any) {
      error.value = err.message || 'Failed to reorder media';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateMediaLinkInPublication(
    publicationId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number; alt?: string; description?: string }
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.patch(`/publications/${publicationId}/media/${mediaLinkId}`, data);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to update media link';
      throw err;
    } finally {
      isLoading.value = false;
    }
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
