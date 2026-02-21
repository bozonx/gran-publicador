import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

interface PersistedFileTreeState {
  expandedPaths: string[];
}

function getFileTreeStorageKey(projectName: string): string {
  return `gran-video-editor:file-tree:${projectName}`;
}

function readLocalStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorageJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface FsEntrySelection {
  kind: 'file' | 'directory';
  name: string;
  path?: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
}

export const useGranVideoEditorUiStore = defineStore('granVideoEditorUi', () => {
  const selectedFsEntry = ref<FsEntrySelection | null>(null);

  const fileTreeExpandedPaths = ref<Record<string, true>>({});
  const currentFileTreeProjectName = ref<string | null>(null);

  function restoreFileTreeStateOnce(projectName: string) {
    if (typeof window === 'undefined') return;
    if (currentFileTreeProjectName.value === projectName) return;

    currentFileTreeProjectName.value = projectName;

    const parsed = readLocalStorageJson<PersistedFileTreeState>(getFileTreeStorageKey(projectName), {
      expandedPaths: [],
    });

    const next: Record<string, true> = {};
    for (const p of parsed.expandedPaths) {
      if (typeof p === 'string' && p.trim().length > 0) next[p] = true;
    }

    fileTreeExpandedPaths.value = next;
  }

  function schedulePersistFileTreeState(projectName: string) {
    const expandedPaths = Object.keys(fileTreeExpandedPaths.value);
    writeLocalStorageJson(getFileTreeStorageKey(projectName), { expandedPaths });
  }

  function isFileTreePathExpanded(path: string): boolean {
    return Boolean(fileTreeExpandedPaths.value[path]);
  }

  function setFileTreePathExpanded(projectName: string, path: string, expanded: boolean) {
    if (!path) return;

    if (expanded) {
      if (fileTreeExpandedPaths.value[path]) return;
      fileTreeExpandedPaths.value = { ...fileTreeExpandedPaths.value, [path]: true };
      schedulePersistFileTreeState(projectName);
      return;
    }

    if (!fileTreeExpandedPaths.value[path]) return;
    const next = { ...fileTreeExpandedPaths.value };
    delete next[path];
    fileTreeExpandedPaths.value = next;
    schedulePersistFileTreeState(projectName);
  }

  watch(
    selectedFsEntry,
    () => {
      // keep
    },
    { deep: true },
  );

  return {
    selectedFsEntry,
    fileTreeExpandedPaths,
    restoreFileTreeStateOnce,
    isFileTreePathExpanded,
    setFileTreePathExpanded,
  };
});
