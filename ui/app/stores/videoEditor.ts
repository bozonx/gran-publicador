import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';

import type { TimelineDocument } from '~/timeline/types';
import type { TimelineCommand } from '~/timeline/commands';
import { applyTimelineCommand } from '~/timeline/commands';
import {
  createDefaultTimelineDocument,
  parseTimelineFromOtio,
  serializeTimelineToOtio,
} from '~/timeline/otioSerializer';
import { selectTimelineDurationUs } from '~/timeline/selectors';
import { createTimelineDocId } from '~/timeline/id';

function normalizeWorkspaceSettings(raw: unknown): VideoEditorWorkspaceSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_WORKSPACE_SETTINGS,
      defaults: { newProject: { ...DEFAULT_WORKSPACE_SETTINGS.defaults.newProject } },
    };
  }

  const input = raw as Record<string, any>;
  const defaultsInput = input.defaults ?? {};
  const newProjectInput = defaultsInput.newProject ?? {};

  const proxyStorageLimitBytes = Number(input.proxyStorageLimitBytes);
  const width = Number(newProjectInput.width);
  const height = Number(newProjectInput.height);
  const fps = Number(newProjectInput.fps);

  return {
    proxyStorageLimitBytes:
      Number.isFinite(proxyStorageLimitBytes) && proxyStorageLimitBytes > 0
        ? Math.round(proxyStorageLimitBytes)
        : DEFAULT_WORKSPACE_SETTINGS.proxyStorageLimitBytes,
    defaults: {
      newProject: {
        width:
          Number.isFinite(width) && width > 0
            ? Math.round(width)
            : DEFAULT_WORKSPACE_SETTINGS.defaults.newProject.width,
        height:
          Number.isFinite(height) && height > 0
            ? Math.round(height)
            : DEFAULT_WORKSPACE_SETTINGS.defaults.newProject.height,
        fps:
          Number.isFinite(fps) && fps > 0
            ? Math.round(Math.min(240, Math.max(1, fps)))
            : DEFAULT_WORKSPACE_SETTINGS.defaults.newProject.fps,
      },
    },
  };
}

const DEFAULT_PROJECT_SETTINGS: VideoEditorProjectSettings = {
  export: {
    width: 1920,
    height: 1080,
    fps: 30,
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

const DEFAULT_USER_SETTINGS: VideoEditorUserSettings = {
  openBehavior: 'open_last_project',
};

const DEFAULT_WORKSPACE_SETTINGS: VideoEditorWorkspaceSettings = {
  proxyStorageLimitBytes: 10 * 1024 * 1024 * 1024,
  defaults: {
    newProject: {
      width: 1920,
      height: 1080,
      fps: 25,
    },
  },
};

function createDefaultProjectSettings(): VideoEditorProjectSettings {
  return {
    export: {
      width: DEFAULT_PROJECT_SETTINGS.export.width,
      height: DEFAULT_PROJECT_SETTINGS.export.height,
      fps: DEFAULT_PROJECT_SETTINGS.export.fps,
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
  const fps = Number(exportInput.fps);
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
      fps:
        Number.isFinite(fps) && fps > 0
          ? Math.round(Math.min(240, Math.max(1, fps)))
          : DEFAULT_PROJECT_SETTINGS.export.fps,
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
    fps: number;
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

export interface VideoEditorUserSettings {
  openBehavior: 'open_last_project' | 'show_project_picker';
}

export interface VideoEditorWorkspaceSettings {
  proxyStorageLimitBytes: number;
  defaults: {
    newProject: {
      width: number;
      height: number;
      fps: number;
    };
  };
}

export const useVideoEditorStore = defineStore('videoEditor', () => {
  const workspaceHandle = ref<FileSystemDirectoryHandle | null>(null);
  const projectsHandle = ref<FileSystemDirectoryHandle | null>(null);
  const currentProjectName = ref<string | null>(null);
  const currentFileName = ref<string | null>(null);
  const lastProjectName = useLocalStorage<string | null>('gran-editor-last-project', null);
  const userSettings = useLocalStorage<VideoEditorUserSettings>('gran-video-editor:user-settings', {
    openBehavior: DEFAULT_USER_SETTINGS.openBehavior,
  });

  const projects = ref<string[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Custom interface for file sys entry
  const selectedFsEntry = ref<any | null>(null);

  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);

  const timelineDoc = ref<TimelineDocument | null>(null);

  const projectSettings = ref<VideoEditorProjectSettings>(createDefaultProjectSettings());
  const isLoadingProjectSettings = ref(false);
  let isPersistingProjectSettings = false;

  const workspaceSettings = ref<VideoEditorWorkspaceSettings>({
    ...DEFAULT_WORKSPACE_SETTINGS,
    defaults: {
      newProject: { ...DEFAULT_WORKSPACE_SETTINGS.defaults.newProject },
    },
  });
  const isLoadingWorkspaceSettings = ref(false);
  let isPersistingWorkspaceSettings = false;

  const fileTreeExpandedPaths = ref<Record<string, true>>({});
  let restoredFileTreeProjectName: string | null = null;
  let persistFileTreeTimeout: number | null = null;

  const isApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  function getFileTreeStorageKey(projectName: string): string {
    return `gran-video-editor:file-tree:${projectName}`;
  }

  function restoreFileTreeStateOnce(projectName: string) {
    if (typeof window === 'undefined') return;
    if (restoredFileTreeProjectName === projectName) return;

    restoredFileTreeProjectName = projectName;
    fileTreeExpandedPaths.value = {};

    try {
      const raw = window.localStorage.getItem(getFileTreeStorageKey(projectName));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const expanded = Array.isArray(parsed?.expandedPaths) ? parsed.expandedPaths : [];
      const next: Record<string, true> = {};
      for (const p of expanded) {
        if (typeof p === 'string' && p.trim().length > 0) next[p] = true;
      }
      fileTreeExpandedPaths.value = next;
    } catch (e) {
      console.warn('Failed to restore file tree state', e);
    }
  }

  function schedulePersistFileTreeState() {
    if (typeof window === 'undefined') return;
    const projectName = currentProjectName.value;
    if (!projectName) return;

    if (persistFileTreeTimeout !== null) window.clearTimeout(persistFileTreeTimeout);
    persistFileTreeTimeout = window.setTimeout(() => {
      persistFileTreeTimeout = null;
      try {
        const expandedPaths = Object.keys(fileTreeExpandedPaths.value);
        window.localStorage.setItem(
          getFileTreeStorageKey(projectName),
          JSON.stringify({ expandedPaths }),
        );
      } catch (e) {
        console.warn('Failed to persist file tree state', e);
      }
    }, 500);
  }

  function isFileTreePathExpanded(path: string): boolean {
    return Boolean(fileTreeExpandedPaths.value[path]);
  }

  function setFileTreePathExpanded(path: string, expanded: boolean) {
    if (!path) return;
    if (expanded) {
      if (fileTreeExpandedPaths.value[path]) return;
      fileTreeExpandedPaths.value = { ...fileTreeExpandedPaths.value, [path]: true };
      schedulePersistFileTreeState();
      return;
    }

    if (!fileTreeExpandedPaths.value[path]) return;
    const next = { ...fileTreeExpandedPaths.value };
    delete next[path];
    fileTreeExpandedPaths.value = next;
    schedulePersistFileTreeState();
  }

  function applyWorkspaceDefaultsToProjectSettings(
    input: VideoEditorProjectSettings,
  ): VideoEditorProjectSettings {
    return {
      ...input,
      export: {
        ...input.export,
        width: workspaceSettings.value.defaults.newProject.width,
        height: workspaceSettings.value.defaults.newProject.height,
        fps: workspaceSettings.value.defaults.newProject.fps,
      },
    };
  }

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

  async function ensureTimelineFileHandle(options?: {
    create?: boolean;
  }): Promise<FileSystemFileHandle | null> {
    if (!projectsHandle.value || !currentProjectName.value || !currentFileName.value) return null;
    const projectDir = await projectsHandle.value.getDirectoryHandle(currentProjectName.value);
    return await projectDir.getFileHandle(currentFileName.value, {
      create: options?.create ?? false,
    });
  }

  async function loadTimeline() {
    if (!currentProjectName.value || !currentFileName.value) return;
    const fallback = {
      id: createTimelineDocId(currentProjectName.value),
      name: currentProjectName.value,
      fps: workspaceSettings.value.defaults.newProject.fps,
    };

    try {
      const handle = await ensureTimelineFileHandle({ create: false });
      if (!handle) {
        timelineDoc.value = createDefaultTimelineDocument(fallback);
        return;
      }

      const file = await handle.getFile();
      const text = await file.text();
      timelineDoc.value = parseTimelineFromOtio(text, fallback);
    } catch (e: any) {
      console.warn('Failed to load timeline file, fallback to default', e);
      timelineDoc.value = createDefaultTimelineDocument(fallback);
    } finally {
      duration.value = timelineDoc.value ? selectTimelineDurationUs(timelineDoc.value) : 0;
    }
  }

  async function saveTimeline() {
    if (!timelineDoc.value) return;
    try {
      const handle = await ensureTimelineFileHandle({ create: true });
      if (!handle) return;
      const writable = await (handle as any).createWritable();
      await writable.write(serializeTimelineToOtio(timelineDoc.value));
      await writable.close();
    } catch (e) {
      console.warn('Failed to save timeline file', e);
    }
  }

  async function computeMediaDurationUs(
    fileHandle: FileSystemFileHandle,
    trackKind: 'video' | 'audio',
  ) {
    try {
      const file = await fileHandle.getFile();
      const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
      const source = new BlobSource(file);
      const input = new Input({ source, formats: ALL_FORMATS } as any);
      try {
        const track =
          trackKind === 'audio'
            ? await input.getPrimaryAudioTrack()
            : await input.getPrimaryVideoTrack();
        if (!track) return 0;
        if (typeof track.canDecode === 'function' && !(await track.canDecode())) return 0;
        const durS = await track.computeDuration();
        const durUs = Math.floor(durS * 1_000_000);
        return Number.isFinite(durUs) && durUs > 0 ? durUs : 0;
      } finally {
        if ('dispose' in input && typeof (input as any).dispose === 'function')
          (input as any).dispose();
        else if ('close' in input && typeof (input as any).close === 'function')
          (input as any).close();
      }
    } catch (e) {
      console.warn('Failed to compute media duration', e);
      return 0;
    }
  }

  async function addClipToTimelineFromPath(input: {
    trackKind: 'video' | 'audio';
    name: string;
    path: string;
  }) {
    const handle = await getFileHandleByPath(input.path);
    if (!handle) {
      error.value = 'Failed to access file handle';
      return;
    }

    const durationUs = await computeMediaDurationUs(handle, input.trackKind);
    if (!durationUs) {
      error.value = 'Failed to compute media duration';
      return;
    }

    applyTimeline({
      type: 'add_clip_to_track',
      trackKind: input.trackKind,
      name: input.name,
      path: input.path,
      durationUs,
    });
  }

  function applyTimeline(cmd: TimelineCommand) {
    if (!timelineDoc.value) {
      if (!currentProjectName.value) return;
      timelineDoc.value = createDefaultTimelineDocument({
        id: createTimelineDocId(currentProjectName.value),
        name: currentProjectName.value,
        fps: workspaceSettings.value.defaults.newProject.fps,
      });
    }

    try {
      const { next } = applyTimelineCommand(timelineDoc.value, cmd);
      timelineDoc.value = next;
      duration.value = selectTimelineDurationUs(next);
      void saveTimeline();
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to apply timeline command';
      throw e;
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
        projectSettings.value = applyWorkspaceDefaultsToProjectSettings(
          createDefaultProjectSettings(),
        );
        return;
      }

      const settingsFile = await settingsFileHandle.getFile();
      const text = await settingsFile.text();
      if (!text.trim()) {
        projectSettings.value = applyWorkspaceDefaultsToProjectSettings(
          createDefaultProjectSettings(),
        );
        return;
      }

      const parsed = JSON.parse(text);
      projectSettings.value = normalizeProjectSettings(parsed);
    } catch (e: any) {
      if (e?.name === 'NotFoundError') {
        projectSettings.value = applyWorkspaceDefaultsToProjectSettings(
          createDefaultProjectSettings(),
        );
        return;
      }
      console.warn('Failed to load project settings, fallback to defaults', e);
      projectSettings.value = applyWorkspaceDefaultsToProjectSettings(
        createDefaultProjectSettings(),
      );
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

  async function ensureWorkspaceSettingsFile(options?: {
    create?: boolean;
  }): Promise<FileSystemFileHandle | null> {
    if (!workspaceHandle.value) return null;
    const granDir = await workspaceHandle.value.getDirectoryHandle('.gran', {
      create: options?.create ?? false,
    });
    return await granDir.getFileHandle('editor.settings.json', {
      create: options?.create ?? false,
    });
  }

  async function loadWorkspaceSettings() {
    if (!workspaceHandle.value) return;
    isLoadingWorkspaceSettings.value = true;
    try {
      const settingsFileHandle = await ensureWorkspaceSettingsFile({ create: false });
      if (!settingsFileHandle) {
        workspaceSettings.value = normalizeWorkspaceSettings(null);
        return;
      }

      const file = await settingsFileHandle.getFile();
      const text = await file.text();
      if (!text.trim()) {
        workspaceSettings.value = normalizeWorkspaceSettings(null);
        return;
      }

      workspaceSettings.value = normalizeWorkspaceSettings(JSON.parse(text));
    } catch (e: any) {
      if (e?.name === 'NotFoundError') {
        workspaceSettings.value = normalizeWorkspaceSettings(null);
        return;
      }

      console.warn('Failed to load workspace editor settings, fallback to defaults', e);
      workspaceSettings.value = normalizeWorkspaceSettings(null);
    } finally {
      isLoadingWorkspaceSettings.value = false;
    }
  }

  async function saveWorkspaceSettings() {
    if (!workspaceHandle.value || isLoadingWorkspaceSettings.value) return;
    isPersistingWorkspaceSettings = true;
    try {
      const settingsFileHandle = await ensureWorkspaceSettingsFile({ create: true });
      if (!settingsFileHandle) return;
      const writable = await (settingsFileHandle as any).createWritable();
      await writable.write(`${JSON.stringify(workspaceSettings.value, null, 2)}\n`);
      await writable.close();
    } catch (e) {
      console.warn('Failed to save workspace editor settings', e);
    } finally {
      isPersistingWorkspaceSettings = false;
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

          if (userSettings.value.openBehavior === 'open_last_project') {
            const candidate = lastProjectName.value;
            if (candidate && projects.value.includes(candidate)) {
              await openProject(candidate);
            }
          }
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
    await loadWorkspaceSettings();
    await saveWorkspaceSettings();
  }

  async function openWorkspace() {
    if (!isApiSupported) return;
    error.value = null;
    isLoading.value = true;
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await setupWorkspace(handle);
      await saveHandleToIndexedDB(handle);

      if (userSettings.value.openBehavior === 'open_last_project') {
        const candidate = lastProjectName.value;
        if (candidate && projects.value.includes(candidate)) {
          await openProject(candidate);
        }
      }
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

      try {
        const granDir = await projectDir.getDirectoryHandle('.gran', { create: true });
        const settingsHandle = await granDir.getFileHandle('project.settings.json', {
          create: true,
        });
        const initial = createDefaultProjectSettings();
        const seeded: VideoEditorProjectSettings = {
          ...initial,
          export: {
            ...initial.export,
            width: workspaceSettings.value.defaults.newProject.width,
            height: workspaceSettings.value.defaults.newProject.height,
            fps: workspaceSettings.value.defaults.newProject.fps,
          },
        };
        const writableSettings = await (settingsHandle as any).createWritable();
        await writableSettings.write(`${JSON.stringify(seeded, null, 2)}\n`);
        await writableSettings.close();
      } catch (e) {
        console.warn('Failed to create project settings file', e);
      }

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

      currentProjectName.value = name;
      currentFileName.value = otioFileName;
      timelineDoc.value = createDefaultTimelineDocument({
        id: createTimelineDocId(name),
        name,
        fps: workspaceSettings.value.defaults.newProject.fps,
      });
      await saveTimeline();

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

    restoreFileTreeStateOnce(name);
    currentProjectName.value = name;
    currentFileName.value = `${name}_001.otio`;
    lastProjectName.value = name;
    await loadProjectSettings();
    await saveProjectSettings();

    await loadTimeline();
  }

  function resetWorkspace() {
    workspaceHandle.value = null;
    projectsHandle.value = null;
    currentProjectName.value = null;
    currentFileName.value = null;
    selectedFsEntry.value = null;
    projects.value = [];
    error.value = null;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    timelineDoc.value = null;
    projectSettings.value = createDefaultProjectSettings();
    isLoadingProjectSettings.value = false;
    isPersistingProjectSettings = false;
    workspaceSettings.value = normalizeWorkspaceSettings(null);
    isLoadingWorkspaceSettings.value = false;
    isPersistingWorkspaceSettings = false;
    fileTreeExpandedPaths.value = {};
    restoredFileTreeProjectName = null;
    if (persistFileTreeTimeout) {
      window.clearTimeout(persistFileTreeTimeout);
      persistFileTreeTimeout = null;
    }
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

  watch(
    workspaceSettings,
    async () => {
      if (isLoadingWorkspaceSettings.value || isPersistingWorkspaceSettings) return;
      await saveWorkspaceSettings();
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
    timelineDoc,
    isPlaying,
    currentTime,
    duration,
    projectSettings,
    userSettings,
    workspaceSettings,
    fileTreeExpandedPaths,
    isFileTreePathExpanded,
    setFileTreePathExpanded,
    loadProjectSettings,
    saveProjectSettings,
    loadWorkspaceSettings,
    saveWorkspaceSettings,
    getFileHandleByPath,
    loadTimeline,
    saveTimeline,
    applyTimeline,
    addClipToTimelineFromPath,
    init,
    openWorkspace,
    createProject,
    loadProjects,
    openProject,
    resetWorkspace,
  };
});
