import { ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { AUTO_SAVE_DEBOUNCE_MS, AUTOSAVE_INDICATOR_DELAY_MS, AUTOSAVE_INDICATOR_DISPLAY_MS } from '~/constants/autosave';
import { logger } from '~/utils/logger';

export type SaveStatus = 'saved' | 'saving' | 'error';

export interface AutosaveOptions<T> {
  // Function to save data
  saveFn: (data: T) => Promise<void | SaveResult>;

  // Data to watch for changes
  data: Ref<T | null>;

  // Debounce time in milliseconds
  debounceMs?: number;

  // Skip initial watch trigger
  skipInitial?: boolean;

  // Custom equality check function
  isEqual?: (a: T, b: T) => boolean;
}

export interface SaveResult {
  saved: boolean;
  skipped?: boolean;
}

export interface AutosaveReturn {
  saveStatus: Ref<SaveStatus>;
  saveError: Ref<string | null>;
  lastSavedAt: Ref<Date | null>;
  isIndicatorVisible: Ref<boolean>;
  indicatorStatus: Ref<SaveStatus>;
  isDirty: Ref<boolean>;
  forceSave: () => Promise<void>;
  // Manual trigger that ignores isEqual check
  triggerSave: () => Promise<void>;
}

/**
 * Composable for auto-saving data with debouncing, dirty checking, and navigation guards
 */
export function useAutosave<T>(options: AutosaveOptions<T>): AutosaveReturn {
  const {
    saveFn,
    data,
    debounceMs = AUTO_SAVE_DEBOUNCE_MS,
    skipInitial = true,
    isEqual = defaultIsEqual,
  } = options;

  const router = useRouter();
  const { t } = useI18n();

  const saveStatus = ref<SaveStatus>('saved');
  const saveError = ref<string | null>(null);
  const lastSavedAt = ref<Date | null>(null);
  const isDirty = ref(false);

  // Indicator visibility logic
  const isIndicatorVisible = ref(false);
  const indicatorStatus = ref<SaveStatus>('saved');
  let indicatorDelayTimer: NodeJS.Timeout | null = null;
  let indicatorDisplayTimer: NodeJS.Timeout | null = null;

  function clearIndicatorTimers() {
    if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
    if (indicatorDisplayTimer) clearTimeout(indicatorDisplayTimer);
  }

  // Store last saved state for dirty checking
  const lastSavedState = ref<T | null>(null);

  // Promise queue to ensure sequential saves
  let saveQueue = Promise.resolve();

  if (skipInitial && data.value) {
    lastSavedState.value = deepClone(data.value);
  }

  /**
   * Perform the actual save operation
   * @param force If true, skip equality check
   */
  async function performSave(force = false) {
    if (!data.value) return;

    // Check if data is dirty
    if (!force && lastSavedState.value && isEqual(data.value, lastSavedState.value)) {
      return;
    }

    // Add to queue to ensure sequential execution
    saveQueue = saveQueue.then(async () => {
      saveStatus.value = 'saving';
      saveError.value = null;

      const saveStartTime = Date.now();
      
      // Start delay timer for "Saving..." indicator
      clearIndicatorTimers();
      indicatorDelayTimer = setTimeout(() => {
        indicatorStatus.value = 'saving';
        isIndicatorVisible.value = true;
      }, AUTOSAVE_INDICATOR_DELAY_MS);

      try {
        const result = await saveFn(data.value!);

        // Handle both simple void return and SaveResult object
        const wasSaved =
          result === undefined || (typeof result === 'object' && result.saved === true);
        const wasSkipped = typeof result === 'object' && result.skipped === true;

        const duration = Date.now() - saveStartTime;

        if (wasSaved) {
          // Update last saved state
          lastSavedState.value = deepClone(data.value!);
          saveStatus.value = 'saved';
          lastSavedAt.value = new Date();
          isDirty.value = false;

          // Clear delay timer if save finished before it fired
          if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);

          if (duration >= AUTOSAVE_INDICATOR_DELAY_MS) {
            // If save took longer than delay, show "Saved" for a while
            indicatorStatus.value = 'saved';
            isIndicatorVisible.value = true;
            indicatorDisplayTimer = setTimeout(() => {
              isIndicatorVisible.value = false;
            }, AUTOSAVE_INDICATOR_DISPLAY_MS);
          } else {
            // Fast save - hide indicator if it was somehow shown
            isIndicatorVisible.value = false;
          }
        } else if (wasSkipped) {
          // If skipped (e.g. invalid state), we keep the dirty flag and previous status
          saveStatus.value = 'saved';
          
          if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
          isIndicatorVisible.value = false;
        } else {
          // Failed to save according to result
          saveStatus.value = 'error';
          isDirty.value = true;

          if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
          indicatorStatus.value = 'error';
          isIndicatorVisible.value = true;
        }
      } catch (err: any) {
        logger.error('Auto-save failed', err);
        saveStatus.value = 'error';
        saveError.value = t('common.saveError');
        isDirty.value = true;

        if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
        indicatorStatus.value = 'error';
        isIndicatorVisible.value = true;
      }
    });

    await saveQueue;
  }

  // Debounced save function
  const debouncedSave = useDebounceFn(performSave, debounceMs);

  // Watch for changes
  watch(
    data,
    (newValue, oldValue) => {
      if (!newValue) return;

      if (skipInitial && lastSavedState.value === null) {
        lastSavedState.value = deepClone(newValue);
        return;
      }

      // Check if this is a reference change (e.g., switching tabs)
      // vs actual data modification
      const isReferenceChange =
        oldValue && newValue !== oldValue && (oldValue as any).id !== (newValue as any).id;

      if (isReferenceChange) {
        // If the previous object was dirty, we should try to save it before switching
        if (isDirty.value && oldValue) {
          // Use the old data to perform save (sequentially)
          saveQueue = saveQueue.then(async () => {
            try {
              saveStatus.value = 'saving';
              saveError.value = null;
              await saveFn(oldValue);
            } catch (err: any) {
              logger.error('Failed to save old state on reference change', err);
              saveStatus.value = 'error';
              saveError.value = t('common.saveError');
              isDirty.value = true;
            }
          });
        }

        // This is a tab switch or similar - update saved state without saving for the NEW value
        lastSavedState.value = deepClone(newValue);
        isDirty.value = false;
        isIndicatorVisible.value = false;
        clearIndicatorTimers();
        return;
      }

      // This is an actual data change - mark as dirty and trigger save
      isDirty.value = true;
      debouncedSave();
    },
    { deep: true },
  );

  // Navigation guard - prevent navigation while saving
  onBeforeRouteLeave((to, from, next) => {
    if (saveStatus.value === 'saving') {
      const answer = window.confirm(t('common.savingInProgressConfirm'));
      if (answer) {
        next();
      } else {
        next(false);
      }
    } else {
      next();
    }
  });

  // Browser unload guard - prevent closing tab while saving
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatus.value === 'saving') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  };

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    clearIndicatorTimers();
  });

  return {
    saveStatus,
    saveError,
    lastSavedAt,
    isDirty,
    isIndicatorVisible,
    indicatorStatus,
    forceSave: () => performSave(false),
    triggerSave: () => performSave(true),
  };
}

/**
 * Default equality check using JSON serialization
 */
function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Deep clone using JSON serialization
 */
function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}
