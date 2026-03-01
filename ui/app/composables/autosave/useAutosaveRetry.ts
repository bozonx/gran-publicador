import { ref, type Ref, computed } from 'vue';
import {
  AUTOSAVE_RETRY_BASE_DELAY_MS,
  AUTOSAVE_RETRY_MAX_ATTEMPTS,
  AUTOSAVE_RETRY_MAX_DELAY_MS,
} from '~/constants/autosave';

export interface UseAutosaveRetryOptions {
  onRetry: (attempt: number) => Promise<void> | void;
  onStopWithToast: () => void;
  onStopWithAuthToast: (status: 401 | 403) => void;
  shouldRetryRef: Ref<boolean>;
}

export function useAutosaveRetry(options: UseAutosaveRetryOptions) {
  const { onRetry, onStopWithToast, onStopWithAuthToast, shouldRetryRef } = options;

  let retryTimer: NodeJS.Timeout | null = null;
  const attempts = ref(0);
  const lastErrorStatus = ref<number | null>(null);
  const isLastErrorRetryable = ref(false);

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

  function scheduleRetry() {
    if (!shouldRetryRef.value || !isLastErrorRetryable.value) {
      clearRetryTimer();
      return;
    }

    if (attempts.value >= AUTOSAVE_RETRY_MAX_ATTEMPTS) {
      onStopWithToast();
      clearRetryTimer();
      return;
    }

    if (retryTimer) return;

    const nextAttempt = attempts.value + 1;
    const delayMs = computeRetryDelayMs(nextAttempt);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!shouldRetryRef.value) return;
      attempts.value = nextAttempt;
      await onRetry(nextAttempt);
    }, delayMs);
  }

  function reset() {
    clearRetryTimer();
    attempts.value = 0;
    lastErrorStatus.value = null;
    isLastErrorRetryable.value = false;
  }

  function handleAuthError(status: 401 | 403) {
    clearRetryTimer();
    isLastErrorRetryable.value = false;
    onStopWithAuthToast(status);
  }

  return {
    attempts,
    lastErrorStatus,
    isLastErrorRetryable,
    scheduleRetry,
    clearRetryTimer,
    reset,
    handleAuthError,
  };
}
