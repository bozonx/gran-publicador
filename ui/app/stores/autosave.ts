import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { SaveStatus } from '~/composables/autosave/useAutosaveIndicator';

export interface AutosaveSession {
  id: string;
  status: SaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
  isDirty: boolean;
  isIndicatorVisible: boolean;
  indicatorStatus: SaveStatus;
}

/**
 * Global Autosave store using Dumb Store pattern.
 * Coordinates multiple active autosave sessions and provides a global "Saving" status.
 */
export const useAutosaveStore = defineStore('autosave', () => {
  const sessions = ref<Record<string, AutosaveSession>>({});
  
  const isAnySaving = computed(() => 
    Object.values(sessions.value).some(s => s.status === 'saving')
  );

  const isAnyDirty = computed(() => 
    Object.values(sessions.value).some(s => s.isDirty)
  );

  function setSession(id: string, updates: Partial<AutosaveSession>) {
    if (!sessions.value[id]) {
      sessions.value[id] = {
        id,
        status: 'saved',
        error: null,
        lastSavedAt: null,
        isDirty: false,
        isIndicatorVisible: false,
        indicatorStatus: 'saved',
      };
    }
    sessions.value[id] = { ...sessions.value[id], ...updates };
  }

  function removeSession(id: string) {
    const { [id]: _, ...rest } = sessions.value;
    sessions.value = rest;
  }

  function reset() {
    sessions.value = {};
  }

  return {
    sessions,
    isAnySaving,
    isAnyDirty,
    setSession,
    removeSession,
    reset,
  };
});
