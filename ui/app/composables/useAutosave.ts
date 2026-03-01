import { ref, watch, type Ref, computed, onUnmounted, toRaw } from 'vue';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  AUTOSAVE_INDICATOR_DELAY_MS,
  AUTOSAVE_INDICATOR_DISPLAY_MS,
} from '~/constants/autosave';
import { logger } from '~/utils/logger';
import {
  defaultIsEqual,
  deepCloneOrNull,
  getErrorStatus,
  isRetryableStatus,
  isNetworkError,
} from '~/utils/autosave';
import { useAutosaveIndicator, type SaveStatus } from './autosave/useAutosaveIndicator';
import { useAutosaveRetry } from './autosave/useAutosaveRetry';
import { useAutosaveGuards } from './autosave/useAutosaveGuards';

/**
 * Resolver for i18n and toast in case they are not available during testing.
 */
function resolveNuxtTool(name: string) {
  const globalAny = globalThis as any;
  return globalAny[name] || globalAny[`__nuxt_${name}`] || null;
}

export type { SaveStatus, SaveResult } from './autosave/useAutosaveIndicator';

export interface AutosaveOptions<T> {
  saveFn: (data: T, signal?: AbortSignal) => Promise<void | SaveResult>;
  data: Ref<T | null>;
  debounceMs?: number;
  skipInitial?: boolean;
  isEqual?: (a: T, b: T) => boolean;
  enableNavigationGuards?: boolean;
  enableBlurSave?: boolean;
}

export interface AutosaveReturn {
  saveStatus: Ref<SaveStatus>;
  saveError: Ref<string | null>;
  lastSavedAt: Ref<Date | null>;
  isIndicatorVisible: Ref<boolean>;
  indicatorStatus: Ref<SaveStatus>;
  isDirty: Ref<boolean>;
  flushSave: () => Promise<void>;
  forceSave: () => Promise<void>;
  triggerSave: () => Promise<void>;
  retrySave: () => Promise<void>;
  syncBaseline: () => void;
}

export function useAutosave<T>(options: AutosaveOptions<T>): AutosaveReturn {
  const {
    saveFn,
    data,
    debounceMs = AUTO_SAVE_DEBOUNCE_MS,
    skipInitial = true,
    isEqual = defaultIsEqual,
    enableNavigationGuards = true,
    enableBlurSave = true,
  } = options;

  let t: (key: string) => string = key => key;
  let toast: any = { add: () => undefined };
  
  try {
    const useI18nFn = resolveNuxtTool('useI18n');
    if (useI18nFn) {
      const i18n = useI18nFn();
      t = (key: string) => String(i18n.t(key));
    }
    const useToastFn = resolveNuxtTool('useToast');
    if (useToastFn) toast = useToastFn();
  } catch (error) {
    logger.warn('useI18n or useToast is not available', error);
  }

  const saveStatus = ref<SaveStatus>('saved');
  const saveError = ref<string | null>(null);
  const lastSavedAt = ref<Date | null>(null);
  const isDirty = ref(false);

  const {
    indicatorStatus,
    isIndicatorVisible,
    showSaving,
    showSaved,
    showError,
    hideIndicator,
    clearIndicatorTimers,
  } = useAutosaveIndicator();

  const retryManager = useAutosaveRetry({
    shouldRetryRef: computed(() => isDirty.value && saveStatus.value === 'error'),
    onRetry: () => performSave(true),
    onStopWithToast: () => {
      toast.add({
        title: t('common.error'),
        description: t('common.unsavedChanges'),
        color: 'error',
        actions: [{ label: t('common.retry'), onClick: () => performSave(true) }],
      });
    },
    onStopWithAuthToast: (status) => {
      const description = status === 401 ? t('auth.sessionExpiredDescription') : t('common.accessDenied');
      toast.add({ title: t('common.error'), description, color: 'error' });
    }
  });

  const lastSavedState = ref<T | null>(skipInitial && data.value ? deepCloneOrNull(data.value) : null);
  let baselineInitialized = skipInitial && !!data.value;
  let saveQueue = Promise.resolve();
  let currentAbortController: AbortController | null = null;
  let errorToastShownForCycle = false;

  async function performSave(force = false) {
    if (!data.value) return;

    if (currentAbortController) currentAbortController.abort();
    const abortController = new AbortController();
    currentAbortController = abortController;
    const signal = abortController.signal;

    const snapshot = deepCloneOrNull(data.value);
    if (!snapshot) return;

    saveQueue = saveQueue.then(async () => {
      if (signal.aborted) return;
      if (!force && lastSavedState.value && isEqual(snapshot, lastSavedState.value)) return;

      saveStatus.value = 'saving';
      saveError.value = null;
      retryManager.clearRetryTimer();

      const saveStartTime = Date.now();
      showSaving();

      try {
        const result = await saveFn(snapshot as T, signal);
        if (signal.aborted) return;

        const wasSaved = result === undefined || (typeof result === 'object' && result.saved === true);
        const wasSkipped = typeof result === 'object' && result.skipped === true;
        const duration = Date.now() - saveStartTime;

        if (wasSaved) {
          lastSavedState.value = deepCloneOrNull(snapshot);
          saveStatus.value = 'saved';
          lastSavedAt.value = new Date();
          isDirty.value = false;
          errorToastShownForCycle = false;
          retryManager.reset();

          if (duration >= AUTOSAVE_INDICATOR_DELAY_MS) {
            showSaved();
          } else {
            hideIndicator();
          }
        } else if (wasSkipped) {
          saveStatus.value = isDirty.value ? 'invalid' : 'saved';
          indicatorStatus.value = saveStatus.value;
          isIndicatorVisible.value = saveStatus.value !== 'saved';
          retryManager.reset();
        } else {
          saveStatus.value = 'error';
          saveError.value = t('common.saveError');
          isDirty.value = true;
          showError();

          if (!errorToastShownForCycle) {
            errorToastShownForCycle = true;
            toast.add({
              title: t('common.error'),
              description: saveError.value ?? undefined,
              color: 'error',
              actions: [{ label: t('common.retry'), onClick: () => {
                errorToastShownForCycle = false;
                retryManager.reset();
                performSave(true);
              }}]
            });
          }
        }
      } catch (err: any) {
        if (signal.aborted || err?.name === 'AbortError') return;

        logger.error('Auto-save failed', err);
        saveStatus.value = 'error';
        saveError.value = t('common.saveError');
        isDirty.value = true;
        showError();

        const status = getErrorStatus(err);
        retryManager.lastErrorStatus.value = status;
        retryManager.isLastErrorRetryable.value = isRetryableStatus(status) || (status === null && isNetworkError(err));

        if (status === 401 || status === 403) {
          retryManager.handleAuthError(status);
          return;
        }

        if (!errorToastShownForCycle) {
            errorToastShownForCycle = true;
            toast.add({
              title: t('common.error'),
              description: saveError.value ?? undefined,
              color: 'error',
              actions: [{ label: t('common.retry'), onClick: () => {
                errorToastShownForCycle = false;
                retryManager.reset();
                performSave(true);
              }}]
            });
          }

        retryManager.scheduleRetry();
      }
    });

    await saveQueue;
  }

  const debouncedSave = useDebounceFn(performSave, debounceMs);

  useAutosaveGuards({
    isSaving: computed(() => saveStatus.value === 'saving'),
    isDirty: isDirty,
    enableNavigationGuards,
    enableBlurSave,
    t,
    onBlurSave: () => performSave(false)
  });

  watch(data, (newValue, oldValue) => {
    if (!newValue) return;
    if (skipInitial && !baselineInitialized) {
      lastSavedState.value = deepCloneOrNull(newValue);
      baselineInitialized = true;
      return;
    }

    const isReferenceChange = oldValue && (
      (oldValue as any)?.id !== (newValue as any)?.id || oldValue !== newValue
    );

    if (isReferenceChange) {
      if (isDirty.value && oldValue) {
        saveQueue = saveQueue.then(async () => {
          try {
            await saveFn(oldValue);
          } catch (err) {
            logger.error('Failed to save old state on reference change', err);
          }
        });
      }
      lastSavedState.value = deepCloneOrNull(newValue);
      baselineInitialized = true;
      isDirty.value = false;
      hideIndicator();
      retryManager.reset();
      return;
    }

    isDirty.value = true;
    if (saveStatus.value !== 'saving') saveStatus.value = 'unsaved';
    indicatorStatus.value = saveStatus.value;
    isIndicatorVisible.value = true;
    debouncedSave();
  }, { deep: true });

  onUnmounted(() => {
    if (isDirty.value && saveStatus.value !== 'saving') performSave(false);
    clearIndicatorTimers();
    retryManager.clearRetryTimer();
  });

  return {
    saveStatus,
    saveError,
    lastSavedAt,
    isDirty,
    isIndicatorVisible,
    indicatorStatus,
    flushSave: () => performSave(false),
    forceSave: () => performSave(true),
    triggerSave: () => performSave(true),
    retrySave: async () => {
      errorToastShownForCycle = false;
      retryManager.reset();
      await performSave(true);
    },
    syncBaseline: () => {
      if (!data.value) return;
      lastSavedState.value = deepCloneOrNull(data.value);
      baselineInitialized = true;
      isDirty.value = false;
      saveStatus.value = 'saved';
      saveError.value = null;
      hideIndicator();
      retryManager.reset();
      if (currentAbortController) currentAbortController.abort();
    }
  };
}
