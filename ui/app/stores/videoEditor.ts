import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';

export interface TimelineClip {
  id: string;
  track: 'video' | 'audio';
  name: string;
  path: string;
  fileHandle?: FileSystemFileHandle;
}

const DEFAULT_PROJECT_SETTINGS: VideoEditorProjectSettings = {
  export: {
    width: 1920,
    height: 1080,
    encoding: {
      format: 'mp4',
      videoCodec: 'avc1.42E032',
      bitrateMbps: 5,
      excludeAudio: false,
      audioBitrateKbps: 128,
    },
  },
  proxy: {
    height: 720,
  },
};

function createDefaultProjectSettings(): VideoEditorProjectSettings {
  return {
    export: {
      width: DEFAULT_PROJECT_SETTINGS.export.width,
      height: DEFAULT_PROJECT_SETTINGS.export.height,
      encoding: {
        format: DEFAULT_PROJECT_SETTINGS.export.encoding.format,
        videoCodec: DEFAULT_PROJECT_SETTINGS.export.encoding.videoCodec,
        bitrateMbps: DEFAULT_PROJECT_SETTINGS.export.encoding.bitrateMbps,
        excludeAudio: DEFAULT_PROJECT_SETTINGS.export.encoding.excludeAudio,
        audioBitrateKbps: DEFAULT_PROJECT_SETTINGS.export.encoding.audioBitrateKbps,
      },
    },
    proxy: {
      height: DEFAULT_PROJECT_SETTINGS.proxy.height,
    },
  };
}

function normalizeProjectSettings(raw: unknown): VideoEditorProjectSettings {
  if (!raw || typeof raw !== 'object') {
    return createDefaultProjectSettings();
  }

  const input = raw as Record<string, any>;
  const exportInput = input.export ?? {};
  const encodingInput = exportInput.encoding ?? {};
  const proxyInput = input.proxy ?? {};

  const width = Number(exportInput.width);
  const height = Number(exportInput.height);
  const bitrateMbps = Number(encodingInput.bitrateMbps);
  const audioBitrateKbps = Number(encodingInput.audioBitrateKbps);
  const proxyHeight = Number(proxyInput.height);
  const format = encodingInput.format;

  return {
    export: {
      width:
        Number.isFinite(width) && width > 0
          ? Math.round(width)
          : DEFAULT_PROJECT_SETTINGS.export.width,
      height:
        Number.isFinite(height) && height > 0
          ? Math.round(height)
          : DEFAULT_PROJECT_SETTINGS.export.height,
      encoding: {
        format: format === 'webm' || format === 'mkv' ? format : 'mp4',
        videoCodec:
          typeof encodingInput.videoCodec === 'string' && encodingInput.videoCodec.trim().length > 0
            ? encodingInput.videoCodec
            : DEFAULT_PROJECT_SETTINGS.export.encoding.videoCodec,
        bitrateMbps:
          Number.isFinite(bitrateMbps) && bitrateMbps > 0
            ? Math.min(200, Math.max(0.2, bitrateMbps))
            : DEFAULT_PROJECT_SETTINGS.export.encoding.bitrateMbps,
        excludeAudio: Boolean(encodingInput.excludeAudio),
        audioBitrateKbps:
          Number.isFinite(audioBitrateKbps) && audioBitrateKbps > 0
            ? Math.round(Math.min(1024, Math.max(32, audioBitrateKbps)))
            : DEFAULT_PROJECT_SETTINGS.export.encoding.audioBitrateKbps,
      },
    },
    proxy: {
      height:
        Number.isFinite(proxyHeight) && proxyHeight > 0
          ? Math.round(proxyHeight)
          : DEFAULT_PROJECT_SETTINGS.proxy.height,
    },
  };
}

export interface VideoEditorProjectSettings {
  export: {
    width: number;
    height: number;
    encoding: {
      format: 'mp4' | 'webm' | 'mkv';
      videoCodec: string;
      bitrateMbps: number;
      excludeAudio: boolean;
      audioBitrateKbps: number;
    };
  };
  proxy: {
    height: number;
  };
}

export const useVideoEditorStore = defineStore('videoEditor', () => {
  const workspaceHandle = ref<FileSystemDirectoryHandle | null>(null);
  const projectsHandle = ref<FileSystemDirectoryHandle | null>(null);
  const currentProjectName = ref<string | null>(null);
  const currentFileName = ref<string | null>(null);
  const lastProjectName = useLocalStorage<string | null>('gran-editor-last-project', null);

  const projects = ref<string[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Custom interface for file sys entry
  const selectedFsEntry = ref<any | null>(null);

  const timelineClips = ref<TimelineClip[]>([]);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);

  const projectSettings = ref<VideoEditorProjectSettings>(createDefaultProjectSettings());
  const isLoadingProjectSettings = ref(false);
  let isPersistingProjectSettings = false;

  const isApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  async function getFileHandleByPath(path: string): Promise<FileSystemFileHandle | null> {
    if (!projectsHandle.value || !currentProjectName.value) return null;
    try {
      const projectDir = await projectsHandle.value.getDirectoryHandle(currentProjectName.value);
      const parts = path.split('/');
      let currentDir = projectDir;
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i]!);
      }
      return await currentDir.getFileHandle(parts[parts.length - 1]!);
    } catch (e) {
      console.error('Failed to get file handle for path:', path, e);
      return null;
    }
  }

  async function ensureProjectSettingsFile(options?: {
    create?: boolean;
  }): Promise<FileSystemFileHandle | null> {
    if (!projectsHandle.value || !currentProjectName.value) return null;
    const projectDir = await projectsHandle.value.getDirectoryHandle(currentProjectName.value);
    const granDir = await projectDir.getDirectoryHandle('.gran', {
      create: options?.create ?? false,
    });
    return await granDir.getFileHandle('project.settings.json', {
      create: options?.create ?? false,
    });
  }

  async function loadProjectSettings() {
    isLoadingProjectSettings.value = true;
    try {
      const settingsFileHandle = await ensureProjectSettingsFile({ create: false });
      if (!settingsFileHandle) {
        projectSettings.value = createDefaultProjectSettings();
        return;
      }

      const settingsFile = await settingsFileHandle.getFile();
      const text = await settingsFile.text();
      if (!text.trim()) {
        projectSettings.value = createDefaultProjectSettings();
        return;
      }

      const parsed = JSON.parse(text);
      projectSettings.value = normalizeProjectSettings(parsed);
    } catch (e: any) {
      if (e?.name === 'NotFoundError') {
        projectSettings.value = createDefaultProjectSettings();
        return;
      }
      console.warn('Failed to load project settings, fallback to defaults', e);
      projectSettings.value = createDefaultProjectSettings();
    } finally {
      isLoadingProjectSettings.value = false;
    }
  }

  async function saveProjectSettings() {
    if (!projectsHandle.value || !currentProjectName.value || isLoadingProjectSettings.value) {
      return;
    }

    isPersistingProjectSettings = true;
    try {
      const settingsFileHandle = await ensureProjectSettingsFile({ create: true });
      if (!settingsFileHandle) return;
      const writable = await (settingsFileHandle as any).createWritable();
      await writable.write(`${JSON.stringify(projectSettings.value, null, 2)}\n`);
      await writable.close();
    } catch (e) {
      console.warn('Failed to save project settings', e);
    } finally {
      isPersistingProjectSettings = false;
    }
  }

  // Helper to store handle in IndexedDB (as we can't put it in localStorage)
  async function saveHandleToIndexedDB(handle: FileSystemDirectoryHandle) {
    const request = indexedDB.open('GranVideoEditor', 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    return new Promise((resolve, reject) => {
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        store.put(handle, 'workspace');
        tx.oncomplete = () => {
          resolve(true);
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async function getHandleFromIndexedDB(): Promise<FileSystemDirectoryHandle | null> {
    const request = indexedDB.open('GranVideoEditor', 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    return new Promise((resolve, reject) => {
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        const getReq = store.get('workspace');
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          reject(getReq.error);
        };
      };
      request.onerror = () => {
        resolve(null);
      }; // Database might not exist yet
    });
  }

  async function init() {
    if (!isApiSupported) return;
    try {
      const handle = await getHandleFromIndexedDB();
      if (handle) {
        // Verify permission (browser might require user gesture for re-activation sometimes,
        // but often if it's stored in IDB it works or requires a simple prompt)
        const options = { mode: 'readwrite' };
        if ((await (handle as any).queryPermission(options)) === 'granted') {
          await setupWorkspace(handle);
        }
      }
    } catch (e) {
      console.warn('Failed to restore workspace handle:', e);
    }
  }

  async function setupWorkspace(handle: FileSystemDirectoryHandle) {
    workspaceHandle.value = handle;
    // Ensure base directories exist
    const folders = ['proxies', 'thumbs', 'cache', 'projects'];
    for (const folder of folders) {
      if (folder === 'projects') {
        projectsHandle.value = await handle.getDirectoryHandle(folder, { create: true });
      } else {
        await handle.getDirectoryHandle(folder, { create: true });
      }
    }
    await loadProjects();
  }

  async function openWorkspace() {
    if (!isApiSupported) return;
    error.value = null;
    isLoading.value = true;
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await setupWorkspace(handle);
      await saveHandleToIndexedDB(handle);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        error.value = e?.message ?? 'Failed to open workspace folder';
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function loadProjects() {
    if (!projectsHandle.value) return;

    projects.value = [];
    try {
      const iterator =
        (projectsHandle.value as any).values?.() ?? (projectsHandle.value as any).entries?.();
      if (!iterator) return;

      for await (const value of iterator) {
        const handle = Array.isArray(value) ? value[1] : value;
        if (handle.kind === 'directory') {
          projects.value.push(handle.name);
        }
      }

      projects.value.sort((a, b) => a.localeCompare(b));
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load projects';
    }
  }

  async function createProject(name: string) {
    if (!projectsHandle.value) {
      error.value = 'Workspace not initialized';
      return;
    }

    if (projects.value.includes(name)) {
      error.value = 'Project already exists';
      return;
    }

    error.value = null;
    isLoading.value = true;
    try {
      const projectDir = await projectsHandle.value.getDirectoryHandle(name, { create: true });
      const sourcesDir = await projectDir.getDirectoryHandle('sources', { create: true });
      await sourcesDir.getDirectoryHandle('video', { create: true });
      await sourcesDir.getDirectoryHandle('audio', { create: true });
      await sourcesDir.getDirectoryHandle('images', { create: true });
      await sourcesDir.getDirectoryHandle('timelines', { create: true });

      const otioFileName = `${name}_001.otio`;
      const otioFile = await projectDir.getFileHandle(otioFileName, { create: true });

      const writable = await (otioFile as any).createWritable();
      await writable.write(`{
  "OTIO_SCHEMA": "Timeline.1",
  "name": "${name}",
  "tracks": {
    "OTIO_SCHEMA": "Stack.1",
    "children": [],
    "name": "tracks"
  }
}`);
      await writable.close();

      await loadProjects();
      await openProject(name);
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create project';
    } finally {
      isLoading.value = false;
    }
  }

  async function openProject(name: string) {
    if (!projects.value.includes(name)) {
      error.value = 'Project not found';
      return;
    }
    currentProjectName.value = name;
    currentFileName.value = `${name}_001.otio`;
    lastProjectName.value = name;
    await loadProjectSettings();
    await saveProjectSettings();
  }

  function resetWorkspace() {
    workspaceHandle.value = null;
    projectsHandle.value = null;
    currentProjectName.value = null;
    currentFileName.value = null;
    selectedFsEntry.value = null;
    projects.value = [];
    error.value = null;
    timelineClips.value = [];
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    projectSettings.value = createDefaultProjectSettings();
    isLoadingProjectSettings.value = false;
    isPersistingProjectSettings = false;
    // Clear IndexedDB
    const request = indexedDB.open('GranVideoEditor', 1);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete('workspace');
    };
  }

  watch(
    projectSettings,
    async () => {
      if (isLoadingProjectSettings.value || isPersistingProjectSettings) return;
      await saveProjectSettings();
    },
    { deep: true },
  );

  return {
    workspaceHandle,
    projectsHandle,
    currentProjectName,
    currentFileName,
    lastProjectName,
    projects,
    isLoading,
    error,
    selectedFsEntry,
    isApiSupported,
    timelineClips,
    isPlaying,
    currentTime,
    duration,
    projectSettings,
    loadProjectSettings,
    saveProjectSettings,
    getFileHandleByPath,
    init,
    openWorkspace,
    createProject,
    loadProjects,
    openProject,
    resetWorkspace,
  };
});
