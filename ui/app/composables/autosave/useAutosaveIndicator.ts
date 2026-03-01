import { ref, type Ref } from 'vue';
import { AUTOSAVE_INDICATOR_DELAY_MS, AUTOSAVE_INDICATOR_DISPLAY_MS } from '~/constants/autosave';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved' | 'invalid';

export interface SaveResult {
  saved: boolean;
  skipped?: boolean;
}

export function useAutosaveIndicator() {
  const isIndicatorVisible = ref(false);
  const indicatorStatus = ref<SaveStatus>('saved');
  let indicatorDelayTimer: NodeJS.Timeout | null = null;
  let indicatorDisplayTimer: NodeJS.Timeout | null = null;

  function clearIndicatorTimers() {
    if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
    if (indicatorDisplayTimer) clearTimeout(indicatorDisplayTimer);
  }

  function showSaving() {
    clearIndicatorTimers();
    indicatorDelayTimer = setTimeout(() => {
      indicatorStatus.value = 'saving';
      isIndicatorVisible.value = true;
    }, AUTOSAVE_INDICATOR_DELAY_MS);
  }

  function showSaved(duration = AUTOSAVE_INDICATOR_DISPLAY_MS) {
    if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
    
    indicatorStatus.value = 'saved';
    isIndicatorVisible.value = true;
    
    indicatorDisplayTimer = setTimeout(() => {
      isIndicatorVisible.value = false;
    }, duration);
  }

  function showError() {
    clearIndicatorTimers();
    indicatorStatus.value = 'error';
    isIndicatorVisible.value = true;
  }

  function hideIndicator() {
    clearIndicatorTimers();
    isIndicatorVisible.value = false;
  }

  return {
    isIndicatorVisible,
    indicatorStatus,
    showSaving,
    showSaved,
    showError,
    hideIndicator,
    clearIndicatorTimers,
  };
}
