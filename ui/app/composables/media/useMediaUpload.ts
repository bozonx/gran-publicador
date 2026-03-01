import { ref } from 'vue';
import { useApi } from '../useApi';
import { useRuntimeConfig } from '#app';
import type { MediaItem } from '~/types/media';

export function useMediaUpload() {
  const api = useApi();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

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
      if (projectId) formData.append('projectId', projectId);
      if (optimize) formData.append('optimize', JSON.stringify(optimize));
      formData.append('fileSize', String(file.size));
      formData.append('file', file);

      return await api.post<MediaItem>('/media/upload', formData, { onUploadProgress });
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
            if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
          });
        }
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText) as MediaItem); }
            catch { reject(new Error('Failed to parse upload response')); }
          } else {
            let message = `Upload failed with status ${xhr.status}`;
            try {
              const data = JSON.parse(xhr.responseText);
              if (typeof data?.message === 'string') message = data.message;
            } catch { /* ignore */ }
            reject(new Error(message));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during stream upload')));
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
      if (projectId) formData.append('projectId', projectId);
      if (optimize) formData.append('optimize', JSON.stringify(optimize));
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

  return {
    isLoading,
    error,
    uploadMedia,
    uploadMediaStream,
    replaceMediaFile,
    uploadMediaFromUrl,
  };
}
