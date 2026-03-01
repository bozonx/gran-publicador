import { computed } from 'vue';
import { useApi, useApiAction } from '#imports';
import { useRuntimeConfig } from '#app';
import { useMediaStore } from '~/stores/media';
import type { MediaItem } from '~/types/media';

export function useMediaUpload() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const store = useMediaStore();

  // Helper bindings for store state
  const loadingBinding = computed({
    get: () => store.isLoading,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => store.error,
    set: (val) => store.setError(val)
  });

  async function uploadMedia(
    file: File,
    onUploadProgress?: (progress: number) => void,
    optimize?: Record<string, any>,
    projectId?: string,
  ): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const formData = new FormData();
        if (projectId) formData.append('projectId', projectId);
        if (optimize) formData.append('optimize', JSON.stringify(optimize));
        formData.append('fileSize', String(file.size));
        formData.append('file', file);

        const media = await api.post<MediaItem>('/media/upload', formData, { onUploadProgress });
        store.setItems([media, ...store.items]);
        store.setTotalCount(store.totalCount + 1);
        return media;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return result;
  }

  async function uploadMediaStream(
    stream: ReadableStream<Uint8Array>,
    filename: string,
    mimeType: string,
    fileSizeBytes?: number,
    projectId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<MediaItem> {
    store.setLoading(true);
    store.setError(null);
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

      const media = await new Promise<MediaItem>((resolve, reject) => {
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

      store.setItems([media, ...store.items]);
      store.setTotalCount(store.totalCount + 1);
      return media;
    } catch (err: any) {
      store.setError(err.message || 'Failed to upload media stream');
      throw err;
    } finally {
      store.setLoading(false);
    }
  }

  async function replaceMediaFile(
    id: string,
    file: File,
    optimize?: Record<string, any>,
    projectId?: string,
  ): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const formData = new FormData();
        if (projectId) formData.append('projectId', projectId);
        if (optimize) formData.append('optimize', JSON.stringify(optimize));
        formData.append('fileSize', String(file.size));
        formData.append('file', file);
        const media = await api.post<MediaItem>(`/media/${id}/replace-file`, formData);
        store.updateMediaInList(id, media);
        return media;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return result;
  }

  async function uploadMediaFromUrl(
    url: string,
    filename?: string,
    optimize?: Record<string, any>,
  ): Promise<MediaItem | null> {
    const [, result] = await executeAction(
      async () => {
        const media = await api.post<MediaItem>('/media/upload-from-url', { url, filename, optimize });
        store.setItems([media, ...store.items]);
        store.setTotalCount(store.totalCount + 1);
        return media;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return result;
  }

  return {
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    uploadMedia,
    uploadMediaStream,
    replaceMediaFile,
    uploadMediaFromUrl,
  };
}
