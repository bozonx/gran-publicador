import { ref } from 'vue'
import { useApi } from './useApi'

export interface MediaItem {
  id: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  storageType: 'TELEGRAM' | 'FS'
  storagePath: string
  filename?: string
  alt?: string
  description?: string
  mimeType?: string
  sizeBytes?: number
  meta?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface CreateMediaInput {
  id?: string
  type?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  storageType?: 'TELEGRAM' | 'FS'
  storagePath?: string
  filename?: string
  alt?: string
  description?: string
  mimeType?: string
  sizeBytes?: number
  meta?: Record<string, any>
}

export function useMedia() {
  const api = useApi()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function createMedia(data: CreateMediaInput): Promise<MediaItem> {
    isLoading.value = true
    error.value = null
    try {
      return await api.post<MediaItem>('/media', data)
    } catch (err: any) {
      error.value = err.message || 'Failed to create media'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMedia(id: string): Promise<MediaItem | null> {
    isLoading.value = true
    error.value = null
    try {
      return await api.get<MediaItem>(`/media/${id}`)
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch media'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteMedia(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.delete(`/media/${id}`)
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to delete media'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function uploadMedia(
    file: File, 
    onUploadProgress?: (progress: number) => void,
    optimize?: Record<string, any>
  ): Promise<MediaItem> {
    isLoading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (optimize) {
        formData.append('optimize', JSON.stringify(optimize))
      }

      // Don't set Content-Type manually - let the browser set it with the correct boundary
      return await api.post<MediaItem>('/media/upload', formData, {
        onUploadProgress
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function uploadMediaFromUrl(url: string, filename?: string, optimize?: Record<string, any>): Promise<MediaItem> {
    isLoading.value = true
    error.value = null
    try {
      return await api.post<MediaItem>('/media/upload-from-url', { url, filename, optimize })
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media from URL'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function addMediaToPublication(publicationId: string, media: CreateMediaInput[]): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.post(`/publications/${publicationId}/media`, { media })
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to add media to publication'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function removeMediaFromPublication(publicationId: string, mediaId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.delete(`/publications/${publicationId}/media/${mediaId}`)
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to remove media from publication'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateMedia(id: string, data: Partial<CreateMediaInput>): Promise<MediaItem> {
    isLoading.value = true
    error.value = null
    try {
      return await api.patch<MediaItem>(`/media/${id}`, data)
    } catch (err: any) {
      error.value = err.message || 'Failed to update media'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function reorderMediaInPublication(
    publicationId: string, 
    media: Array<{ id: string; order: number }>
  ): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.patch(`/publications/${publicationId}/media/reorder`, { media })
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to reorder media'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateMediaLinkInPublication(
    publicationId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number }
  ): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.patch(`/publications/${publicationId}/media/${mediaLinkId}`, data)
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to update media link'
      throw err
    } finally {
      isLoading.value = false
    }
  }


  async function fetchAllMedia(): Promise<MediaItem[]> {
    isLoading.value = true
    error.value = null
    try {
      return await api.get<MediaItem[]>('/media')
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch all media'
      return []
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    createMedia,
    fetchMedia,
    deleteMedia,
    uploadMedia,
    uploadMediaFromUrl,
    updateMedia,
    fetchAllMedia,
    addMediaToPublication,
    removeMediaFromPublication,
    reorderMediaInPublication,
    updateMediaLinkInPublication,
  }
}

/**
 * Get URL for media file
 */
export function getMediaFileUrl(mediaId: string, token?: string): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase
    ? `${config.public.apiBase}/api/v1`
    : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/file`;
  
  if (token) {
    url += `?token=${token}`;
  }
  
  return url;
}

/**
 * Get URL for media thumbnail
 */
export function getThumbnailUrl(mediaId: string, width?: number, height?: number, token?: string): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase
    ? `${config.public.apiBase}/api/v1`
    : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/thumbnail`;
  
  const params = [];
  if (width) params.push(`w=${width}`);
  if (height) params.push(`h=${height}`);
  if (token) params.push(`token=${token}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  return url;
}
