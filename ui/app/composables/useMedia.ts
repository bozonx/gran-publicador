import { ref } from 'vue'
import { useApi } from './useApi'

export interface MediaItem {
  id: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  srcType: 'TELEGRAM' | 'FS' | 'URL'
  src: string
  filename?: string
  mimeType?: string
  sizeBytes?: number
  meta?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface CreateMediaInput {
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  srcType: 'TELEGRAM' | 'FS' | 'URL'
  src: string
  filename?: string
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

  async function uploadMedia(file: File): Promise<MediaItem> {
    isLoading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Don't set Content-Type manually - let the browser set it with the correct boundary
      return await api.post<MediaItem>('/media/upload', formData)
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media'
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

  return {
    isLoading,
    error,
    createMedia,
    fetchMedia,
    deleteMedia,
    uploadMedia,
    addMediaToPublication,
    removeMediaFromPublication,
  }
}

/**
 * Get URL for media file
 */
export function getMediaFileUrl(mediaId: string): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase
    ? `${config.public.apiBase}/api/v1`
    : '/api/v1';
  return `${apiBase}/media/${mediaId}/file`;
}
