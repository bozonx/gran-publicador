import { ref, watch, type Ref, computed, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  AUTOSAVE_INDICATOR_DELAY_MS,
  AUTOSAVE_INDICATOR_DISPLAY_MS,
  AUTOSAVE_RETRY_BASE_DELAY_MS,
  AUTOSAVE_RETRY_MAX_ATTEMPTS,
  AUTOSAVE_RETRY_MAX_DELAY_MS,
} from '~/constants/autosave';
import { logger } from '~/utils/logger';

function resolveUseI18n(): null | (() => { t: (key: string) => unknown }) {
  // Nuxt auto-imports are available at runtime, but not in unit tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalUseI18n = (globalThis as any).useI18n;
  if (typeof globalUseI18n === 'function') return globalUseI18n;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localUseI18n = (globalThis as any).__nuxt_useI18n;
  if (typeof localUseI18n === 'function') return localUseI18n;

  return null;
}

function resolveUseToast(): null | (() => { add: (toast: unknown) => unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalUseToast = (globalThis as any).useToast;
  if (typeof globalUseToast === 'function') return globalUseToast;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localUseToast = (globalThis as any).__nuxt_useToast;
  if (typeof localUseToast === 'function') return localUseToast;

  return null;
}

export type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

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
  retrySave: () => Promise<void>;
  /**
   * Update the internal baseline to the current value without saving.
   * Useful after syncing state from server/props to avoid triggering autosave.
   */
  syncBaseline: () => void;
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

  let t: (key: string) => string = key => key;
  try {
    const useI18nFn = resolveUseI18n();
    if (useI18nFn) {
      const i18n = useI18nFn();
      t = (key: string) => String(i18n.t(key));
    }
  } catch (error) {
    logger.warn('useI18n is not available, falling back to identity translator', error);
  }

  // Nuxt UI toast has a richer type than we need here; keep it minimal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toast: any = {
    add: () => undefined,
  };
  try {
    const useToastFn = resolveUseToast();
    if (useToastFn) {
      toast = useToastFn();
    }
  } catch (error) {
    logger.warn('useToast is not available, falling back to no-op toast', error);
  }

  const saveStatus = ref<SaveStatus>('saved');
  const saveError = ref<string | null>(null);
  const lastSavedAt = ref<Date | null>(null);
  const isDirty = ref(false);

  const shouldRetry = computed(() => isDirty.value && saveStatus.value === 'error');

  // Indicator visibility logic
  const isIndicatorVisible = ref(false);
  const indicatorStatus = ref<SaveStatus>('saved');
  let indicatorDelayTimer: NodeJS.Timeout | null = null;
  let indicatorDisplayTimer: NodeJS.Timeout | null = null;

  // Retry logic
  let retryTimer: NodeJS.Timeout | null = null;
  let retryAttempts = 0;
  let errorToastShownForCycle = false;
  let retryLimitToastShownForCycle = false;
  let lastErrorStatus: number | null = null;
  let lastErrorRetryable = false;
  let authToastShownForCycle = false;

  function getErrorStatus(err: unknown): number | null {
    // useApi normalizes errors as { status, data }
    // $fetch errors can have response.status
    const anyErr = err as any;
    const status =
      anyErr?.status ??
      anyErr?.response?.status ??
      anyErr?.response?._data?.statusCode ??
      anyErr?.data?.statusCode;
    return typeof status === 'number' ? status : null;
  }

  function isRetryableStatus(status: number | null): boolean {
    if (status === null) return false;
    if (status === 0) return true;
    if (status === 429) return true;
    if (status >= 500) return true;
    return false;
  }

  function isNetworkError(err: unknown): boolean {
    const anyErr = err as any;
    const message = String(anyErr?.message ?? '').toLowerCase();
    if (!message) return false;
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('fetch failed') ||
      message.includes('econnreset')
    );
  }

  function clearIndicatorTimers() {
    if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
    if (indicatorDisplayTimer) clearTimeout(indicatorDisplayTimer);
  }

  function clearRetryTimer() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function computeRetryDelayMs(attempt: number): number {
    const base = AUTOSAVE_RETRY_BASE_DELAY_MS;
    const exp = base * 2 ** Math.max(0, attempt - 1);
    const capped = Math.min(exp, AUTOSAVE_RETRY_MAX_DELAY_MS);
    const jitter = 0.2;
    const jitterFactor = 1 + (Math.random() * 2 - 1) * jitter;
    return Math.max(0, Math.round(capped * jitterFactor));
  }

  function stopRetriesWithToast() {
    clearRetryTimer();
    if (!retryLimitToastShownForCycle) {
      retryLimitToastShownForCycle = true;
      toast.add({
        title: t('common.error'),
        description: t('common.unsavedChanges'),
        color: 'error',
      });
    }
  }

  function stopRetriesWithAuthToast(status: 401 | 403) {
    clearRetryTimer();
    lastErrorRetryable = false;
    if (authToastShownForCycle) return;
    authToastShownForCycle = true;

    const description =
      status === 401 ? t('auth.sessionExpiredDescription') : t('common.accessDenied');

    toast.add({
      title: t('common.error'),
      description,
      color: 'error',
    });
  }

  function scheduleRetry() {
    if (!shouldRetry.value) {
      clearRetryTimer();
      return;
    }

    if (!lastErrorRetryable) {
      clearRetryTimer();
      return;
    }

    if (retryAttempts >= AUTOSAVE_RETRY_MAX_ATTEMPTS) {
      stopRetriesWithToast();
      return;
    }

    if (retryTimer) return;

    const nextAttempt = retryAttempts + 1;
    const delayMs = computeRetryDelayMs(nextAttempt);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!shouldRetry.value) return;
      retryAttempts = nextAttempt;
      void performSave(true);
    }, delayMs);
  }

  // Store last saved state for dirty checking
  const lastSavedState = ref<T | null>(null);
  let baselineInitialized = false;

  // Promise queue to ensure sequential saves
  let saveQueue = Promise.resolve();

  if (skipInitial && data.value) {
    lastSavedState.value = deepCloneOrNull(data.value);
    baselineInitialized = true;
  }

  function syncBaseline() {
    if (!data.value) return;

    lastSavedState.value = deepCloneOrNull(data.value);
    baselineInitialized = true;
    isDirty.value = false;
    saveStatus.value = 'saved';
    saveError.value = null;
    errorToastShownForCycle = false;
    retryLimitToastShownForCycle = false;
    retryAttempts = 0;
    lastErrorStatus = null;
    lastErrorRetryable = false;
    authToastShownForCycle = false;
    isIndicatorVisible.value = false;
    clearIndicatorTimers();
    clearRetryTimer();
  }

  /**
   * Perform the actual save operation
   * @param force If true, skip equality check
   */
  async function performSave(force = false) {
    if (!data.value) return;

    // Add to queue to ensure sequential execution
    saveQueue = saveQueue.then(async () => {
      // Check equality inside the queue to avoid duplicate saves
      // when multiple performSave calls pass the check before entering the queue
      if (
        !force &&
        lastSavedState.value &&
        data.value &&
        isEqual(data.value, lastSavedState.value)
      ) {
        return;
      }

      if (!data.value) return;

      saveStatus.value = 'saving';
      saveError.value = null;
      clearRetryTimer();

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
          lastSavedState.value = deepCloneOrNull(data.value!);
          saveStatus.value = 'saved';
          lastSavedAt.value = new Date();
          isDirty.value = false;
          errorToastShownForCycle = false;
          retryLimitToastShownForCycle = false;
          retryAttempts = 0;
          lastErrorStatus = null;
          lastErrorRetryable = false;
          authToastShownForCycle = false;

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
          saveStatus.value = isDirty.value ? 'unsaved' : 'saved';

          if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
          indicatorStatus.value = saveStatus.value;
          isIndicatorVisible.value = saveStatus.value === 'unsaved';
          clearRetryTimer();
          lastErrorStatus = null;
          lastErrorRetryable = false;
        } else {
          // Failed to save according to result
          saveStatus.value = 'error';
          saveError.value = t('common.saveError');
          isDirty.value = true;

          lastErrorStatus = null;
          // If saveFn does not throw, we cannot reliably classify error.
          // Do not retry automatically.
          lastErrorRetryable = false;

          if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
          indicatorStatus.value = 'error';
          isIndicatorVisible.value = true;

          if (!errorToastShownForCycle) {
            errorToastShownForCycle = true;
            toast.add({
              title: t('common.error'),
              description: saveError.value ?? undefined,
              color: 'error',
            });
          }
        }
      } catch (err: any) {
        logger.error('Auto-save failed', err);
        saveStatus.value = 'error';
        saveError.value = t('common.saveError');
        isDirty.value = true;

        lastErrorStatus = getErrorStatus(err);
        lastErrorRetryable =
          isRetryableStatus(lastErrorStatus) || (lastErrorStatus === null && isNetworkError(err));

        if (indicatorDelayTimer) clearTimeout(indicatorDelayTimer);
        indicatorStatus.value = 'error';
        isIndicatorVisible.value = true;

        if (lastErrorStatus === 401 || lastErrorStatus === 403) {
          stopRetriesWithAuthToast(lastErrorStatus);
          return;
        }

        if (!errorToastShownForCycle) {
          errorToastShownForCycle = true;
          toast.add({
            title: t('common.error'),
            description: saveError.value ?? undefined,
            color: 'error',
          });
        }

        scheduleRetry();
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

      if (skipInitial && !baselineInitialized) {
        lastSavedState.value = deepCloneOrNull(newValue);
        baselineInitialized = true;
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
          // Defer new-value baseline reset until after save completes
          // so that errors from saving old data are properly surfaced
          saveQueue = saveQueue.then(async () => {
            try {
              saveStatus.value = 'saving';
              saveError.value = null;
              await saveFn(oldValue);
              // Save succeeded — reset state for the new value
              saveStatus.value = 'saved';
            } catch (err: any) {
              logger.error('Failed to save old state on reference change', err);
              saveStatus.value = 'error';
              saveError.value = t('common.saveError');

              toast.add({
                title: t('common.error'),
                description: t('common.unsavedChanges'),
                color: 'error',
              });
            }
          });
        }

        // This is a tab switch or similar - update saved state without saving for the NEW value
        lastSavedState.value = deepCloneOrNull(newValue);
        baselineInitialized = true;
        isDirty.value = false;
        isIndicatorVisible.value = false;
        clearIndicatorTimers();
        clearRetryTimer();
        errorToastShownForCycle = false;
        return;
      }

      // This is an actual data change - mark as dirty and trigger save
      isDirty.value = true;
      errorToastShownForCycle = false;
      retryLimitToastShownForCycle = false;
      authToastShownForCycle = false;
      if (saveStatus.value !== 'saving') {
        saveStatus.value = 'unsaved';
      }
      indicatorStatus.value = saveStatus.value;
      isIndicatorVisible.value = true;
      debouncedSave();
    },
    { deep: true },
  );

  // Navigation guard - prevent navigation while saving
  // In unit tests or some runtimes there may be no active router context.
  try {
    onBeforeRouteLeave((to, from, next) => {
      if (saveStatus.value === 'saving' || isDirty.value) {
        const key =
          saveStatus.value === 'saving'
            ? 'common.savingInProgressConfirm'
            : 'common.unsavedChangesConfirm';
        const answer = window.confirm(t(key));
        if (answer) {
          next();
        } else {
          next(false);
        }
      } else {
        next();
      }
    });
  } catch (error) {
    logger.warn('Failed to register autosave route leave guard', error);
  }

  // Browser unload guard - prevent closing tab while saving
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatus.value === 'saving' || isDirty.value) {
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
    clearRetryTimer();
  });

  return {
    saveStatus,
    saveError,
    lastSavedAt,
    isDirty,
    isIndicatorVisible,
    indicatorStatus,
    forceSave: () => performSave(true),
    triggerSave: () => performSave(true),
    retrySave: async () => {
      if (!data.value) return;
      errorToastShownForCycle = false;
      retryLimitToastShownForCycle = false;
      retryAttempts = 0;
      authToastShownForCycle = false;
      clearRetryTimer();
      await performSave(true);
    },
    syncBaseline,
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
function deepCloneOrNull<T>(obj: T): T | null {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch (error) {
      // Vue reactive proxies and some complex objects can fail structuredClone.
      // Fall back to JSON clone for plain data.
      logger.warn('Failed to structuredClone autosave state, falling back to JSON clone', error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    logger.warn('Failed to deep clone autosave state, falling back to null baseline', error);
    return null;
  }
}
