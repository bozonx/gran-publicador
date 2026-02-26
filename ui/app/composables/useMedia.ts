import { ref } from 'vue';
import { useApi } from './useApi';

export interface MediaThumbData {
  src: string | null;
  srcset: string | null;
  isVideo: boolean;
  placeholderIcon: string;
  placeholderText: string;
}

export interface MediaItemLike {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | string;
  storageType?: 'TELEGRAM' | 'STORAGE' | string;
  storagePath: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number | string;
  meta?: Record<string, any>;
}

export interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  storageType: 'TELEGRAM' | 'STORAGE';
  storagePath: string;
  filename?: string;
  alt?: string;
  description?: string;
  mimeType?: string;
  sizeBytes?: number | string;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  fullMediaMeta?: Record<string, any>;
  publicToken?: string;
}

export interface CreateMediaInput {
  id?: string;
  type?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  storageType?: 'TELEGRAM' | 'STORAGE';
  storagePath?: string;
  filename?: string;
  alt?: string;
  description?: string;
  mimeType?: string;
  sizeBytes?: number | string;
  meta?: Record<string, any>;
}

export function useMedia() {
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

  async function replaceMediaFile(
    id: string,
    file: File,
    optimize?: Record<string, any>,
    projectId?: string,
  ): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      const formData = new FormData();

      if (projectId) {
        formData.append('projectId', projectId);
      }

      if (optimize) {
        formData.append('optimize', JSON.stringify(optimize));
      }

      formData.append('fileSize', String(file.size));

      formData.append('file', file);

      return await api.post<MediaItem>(`/media/${id}/replace-file`, formData);
    } catch (err: any) {
      error.value = err.message || 'Failed to replace media file';
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
          // Fetch additional info from media storage microservice via proxy
          const fullInfo = await api.get<any>(`/media/${id}/info`);
          if (fullInfo) {
            media.fullMediaMeta = fullInfo;
          }
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

  async function uploadMedia(
    file: File,
    onUploadProgress?: (progress: number) => void,
    optimize?: Record<string, any>,
    projectId?: string,
  ): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      const formData = new FormData();

      if (projectId) {
        formData.append('projectId', projectId);
      }

      if (optimize) {
        formData.append('optimize', JSON.stringify(optimize));
      }

      formData.append('fileSize', String(file.size));

      formData.append('file', file);

      // Don't set Content-Type manually - let the browser set it with the correct boundary

      return await api.post<MediaItem>('/media/upload', formData, {
        onUploadProgress,
      });
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function uploadMediaStream(
    stream: ReadableStream<Uint8Array>,
    filename: string,
    mimeType: string,
    fileSizeBytes?: number,
    projectId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      const config = useRuntimeConfig();
      const rawApiBase = (config.public.apiBase as string) || '';
      const cleanApiBase = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
      const apiBase = cleanApiBase ? `${cleanApiBase}/api/v1` : '/api/v1';

      // Collect chunks from the ReadableStream into a single ArrayBuffer.
      // This avoids creating a Blob/File wrapper while staying compatible with HTTP/1.1.
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.byteLength;
      }

      const buffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return new Promise<MediaItem>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.withCredentials = true;

        if (onProgress) {
          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          });
        }

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as MediaItem);
            } catch {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            let message = `Upload failed with status ${xhr.status}`;
            try {
              const data = JSON.parse(xhr.responseText);
              if (typeof data?.message === 'string') message = data.message;
            } catch {
              // ignore
            }
            reject(new Error(message));
          }
        });

        xhr.addEventListener('error', () =>
          reject(new Error('Network error during stream upload')),
        );
        xhr.addEventListener('abort', () => reject(new Error('Stream upload aborted')));

        xhr.open('POST', `${apiBase}/media/upload-stream`);
        xhr.setRequestHeader('Content-Type', mimeType);
        xhr.setRequestHeader('x-filename', filename);
        xhr.setRequestHeader('x-mime-type', mimeType);
        xhr.setRequestHeader('x-file-size', String(buffer.byteLength));
        if (projectId) xhr.setRequestHeader('x-project-id', projectId);

        xhr.send(buffer.buffer);
      });
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media stream';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function uploadMediaFromUrl(
    url: string,
    filename?: string,
    optimize?: Record<string, any>,
  ): Promise<MediaItem> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.post<MediaItem>('/media/upload-from-url', { url, filename, optimize });
    } catch (err: any) {
      error.value = err.message || 'Failed to upload media from URL';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function addMediaToPublication(
    publicationId: string,
    media: CreateMediaInput[],
  ): Promise<boolean> {
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

  async function removeMediaFromPublication(
    publicationId: string,
    mediaId: string,
  ): Promise<boolean> {
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

  async function reorderMediaInPublication(
    publicationId: string,
    media: Array<{ id: string; order: number }>,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.patch(`/publications/${publicationId}/media/reorder`, { media });
      return true;
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
    data: { hasSpoiler?: boolean; order?: number },
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

  return {
    isLoading,
    error,
    createMedia,
    fetchMedia,
    deleteMedia,
    uploadMedia,
    uploadMediaStream,
    replaceMediaFile,
    uploadMediaFromUrl,
    updateMedia,
    fetchAllMedia,
    addMediaToPublication,
    removeMediaFromPublication,
    reorderMediaInPublication,
    updateMediaLinkInPublication,
  };
}

/**
 * Get URL for media file
 */
export function getMediaFileUrl(
  mediaId: string,
  token?: string,
  version?: string | number,
  download?: boolean,
): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/file`;

  const params: string[] = [];

  if (token) {
    params.push(`token=${token}`);
  }

  if (version !== undefined && version !== null && String(version).length > 0) {
    params.push(`v=${encodeURIComponent(String(version))}`);
  }

  if (download) {
    params.push('download=1');
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}

/**
 * Get public URL for media file (no auth required)
 */
export function getPublicMediaUrl(mediaId: string, publicToken: string): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  return `${apiBase}/media/p/${mediaId}/${publicToken}`;
}

export function getMediaThumbData(media: MediaItemLike, token?: string): MediaThumbData {
  const placeholderIcon =
    media.type === 'IMAGE'
      ? 'i-heroicons-photo'
      : media.type === 'VIDEO'
        ? 'i-heroicons-video-camera'
        : media.type === 'AUDIO'
          ? 'i-heroicons-musical-note'
          : 'i-heroicons-document';

  const placeholderText = media.filename || 'Untitled';

  const type = (media.type || '').toUpperCase();
  const storageType = (media.storageType || '').toUpperCase();
  const hasThumbnailInMeta = !!media.meta?.telegram?.thumbnailFileId;

  const canShowPreview =
    media.id &&
    (type === 'IMAGE' ||
      (storageType === 'TELEGRAM' &&
        (type === 'VIDEO' || type === 'DOCUMENT' || type === 'AUDIO') &&
        hasThumbnailInMeta));

  if (!canShowPreview) {
    return {
      src: null,
      srcset: null,
      isVideo: media.type === 'VIDEO',
      placeholderIcon,
      placeholderText,
    };
  }

  if (type === 'IMAGE') {
    if (storageType === 'STORAGE') {
      const src = getThumbnailUrl(media.id, 400, 400, token);
      const srcset = `${src} 1x, ${getThumbnailUrl(media.id, 800, 800, token)} 2x`;
      return {
        src,
        srcset,
        isVideo: false,
        placeholderIcon,
        placeholderText,
      };
    }

    if (storageType === 'URL') {
      return {
        src: media.storagePath,
        srcset: null,
        isVideo: false,
        placeholderIcon,
        placeholderText,
      };
    }

    return {
      src: getMediaFileUrl(media.id, token),
      srcset: null,
      isVideo: false,
      placeholderIcon,
      placeholderText,
    };
  }

  return {
    src: getThumbnailUrl(media.id, 400, 400, token),
    srcset: null,
    isVideo: type === 'VIDEO',
    placeholderIcon,
    placeholderText,
  };
}

export function getMediaLinksThumbDataLoose(
  mediaLinks: Array<{ media?: MediaItemLike; order: number }>,
  token?: string,
): { first: MediaThumbData | null; totalCount: number } {
  const firstMedia = mediaLinks[0]?.media;
  if (!firstMedia) {
    return { first: null, totalCount: mediaLinks.length };
  }

  return {
    first: getMediaThumbData(firstMedia, token),
    totalCount: mediaLinks.length,
  };
}

/**
 * Get URL for media thumbnail
 */
export function getThumbnailUrl(
  mediaId: string,
  width?: number,
  height?: number,
  token?: string,
  version?: string | number,
): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/thumbnail`;

  const params: string[] = [];
  if (width) params.push(`w=${width}`);
  if (height) params.push(`h=${height}`);
  if (token) params.push(`token=${token}`);
  if (version !== undefined && version !== null && String(version).length > 0)
    params.push(`v=${encodeURIComponent(String(version))}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}
