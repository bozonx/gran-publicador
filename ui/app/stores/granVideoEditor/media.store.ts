import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useGranVideoEditorWorkspaceStore } from './workspace.store';
import { useGranVideoEditorProjectStore } from './project.store';

export interface MediaMetadata {
  source: {
    size: number;
    lastModified: number;
  };
  duration: number;
  video?: {
    width: number;
    height: number;
    displayWidth: number;
    displayHeight: number;
    rotation: number;
    codec: string;
    parsedCodec: string;
    fps: number;
    colorSpace?: any;
  };
  audio?: {
    codec: string;
    parsedCodec: string;
    sampleRate: number;
    channels: number;
  };
}

export const useGranVideoEditorMediaStore = defineStore('granVideoEditorMedia', () => {
  const workspaceStore = useGranVideoEditorWorkspaceStore();
  const projectStore = useGranVideoEditorProjectStore();

  const mediaMetadata = ref<Record<string, MediaMetadata>>({});

  function getCacheFileName(projectRelativePath: string): string {
    return `${encodeURIComponent(projectRelativePath)}.json`;
  }

  async function ensureCacheDir(): Promise<FileSystemDirectoryHandle | null> {
    if (!workspaceStore.workspaceHandle || !projectStore.currentProjectName) return null;
    const cacheDir = await workspaceStore.workspaceHandle.getDirectoryHandle('cache', { create: true });
    return await cacheDir.getDirectoryHandle(projectStore.currentProjectName, { create: true });
  }

  async function ensureFilesMetaDir(): Promise<FileSystemDirectoryHandle | null> {
    const projectCacheDir = await ensureCacheDir();
    if (!projectCacheDir) return null;
    return await projectCacheDir.getDirectoryHandle('files-meta', { create: true });
  }

  function parseVideoCodec(codec: string): string {
    if (codec.startsWith('avc1')) return 'H.264 (AVC)';
    if (codec.startsWith('hev1') || codec.startsWith('hvc1')) return 'H.265 (HEVC)';
    if (codec.startsWith('vp09')) return 'VP9';
    if (codec.startsWith('av01')) return 'AV1';
    return codec;
  }

  function parseAudioCodec(codec: string): string {
    if (codec.startsWith('mp4a')) return 'AAC';
    if (codec.startsWith('opus')) return 'Opus';
    if (codec.startsWith('vorbis')) return 'Vorbis';
    return codec;
  }

  async function getOrFetchMetadataByPath(path: string, options?: { forceRefresh?: boolean }) {
    const handle = await projectStore.getFileHandleByPath(path);
    if (!handle) return null;
    return await getOrFetchMetadata(handle, path, options);
  }

  async function getOrFetchMetadata(
    fileHandle: FileSystemFileHandle,
    projectRelativePath: string,
    options?: { forceRefresh?: boolean },
  ): Promise<MediaMetadata | null> {
    const file = await fileHandle.getFile();
    const cacheKey = projectRelativePath;

    if (!options?.forceRefresh && mediaMetadata.value[cacheKey]) {
      const cached = mediaMetadata.value[cacheKey]!;
      if (cached.source.size === file.size && cached.source.lastModified === file.lastModified) {
        return cached;
      }
    }

    const metaDir = await ensureFilesMetaDir();
    const cacheFileName = getCacheFileName(projectRelativePath);

    if (!options?.forceRefresh && metaDir) {
      try {
        const cacheHandle = await metaDir.getFileHandle(cacheFileName);
        const cacheFile = await cacheHandle.getFile();
        const text = await cacheFile.text();
        const parsed = JSON.parse(text) as MediaMetadata;
        if (parsed.source.size === file.size && parsed.source.lastModified === file.lastModified) {
          mediaMetadata.value[cacheKey] = parsed;
          return parsed;
        }
      } catch {
        // Cache miss
      }
    }

    try {
      const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
      const source = new BlobSource(file);
      const input = new Input({ source, formats: ALL_FORMATS } as any);

      try {
        const durationS = await input.computeDuration();
        const vTrack = await input.getPrimaryVideoTrack();
        const aTrack = await input.getPrimaryAudioTrack();

        const meta: MediaMetadata = {
          source: {
            size: file.size,
            lastModified: file.lastModified,
          },
          duration: durationS,
        };

        if (vTrack) {
          const stats = await vTrack.computePacketStats(100);
          const codecParam = await vTrack.getCodecParameterString();
          const colorSpace = typeof vTrack.getColorSpace === 'function' ? await vTrack.getColorSpace() : undefined;

          meta.video = {
            width: vTrack.codedWidth,
            height: vTrack.codedHeight,
            displayWidth: vTrack.displayWidth,
            displayHeight: vTrack.displayHeight,
            rotation: vTrack.rotation,
            codec: codecParam || vTrack.codec || '',
            parsedCodec: parseVideoCodec(codecParam || vTrack.codec || ''),
            fps: stats.averagePacketRate,
            colorSpace,
          };
        }

        if (aTrack) {
          const codecParam = await aTrack.getCodecParameterString();
          meta.audio = {
            codec: codecParam || aTrack.codec || '',
            parsedCodec: parseAudioCodec(codecParam || aTrack.codec || ''),
            sampleRate: aTrack.sampleRate,
            channels: aTrack.numberOfChannels,
          };
        }

        mediaMetadata.value[cacheKey] = meta;

        if (metaDir) {
          const cacheHandle = await metaDir.getFileHandle(cacheFileName, { create: true });
          const writable = await (cacheHandle as any).createWritable();
          await writable.write(JSON.stringify(meta, null, 2));
          await writable.close();
        }

        return meta;
      } finally {
        if ('dispose' in input && typeof (input as any).dispose === 'function') (input as any).dispose();
        else if ('close' in input && typeof (input as any).close === 'function') (input as any).close();
      }
    } catch (e) {
      console.error('Failed to fetch metadata for', projectRelativePath, e);
      return null;
    }
  }

  return {
    mediaMetadata,
    getOrFetchMetadataByPath,
    getOrFetchMetadata,
  };
});
