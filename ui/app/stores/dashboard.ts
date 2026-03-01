import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DashboardSummary } from '~/types/dashboard';

/**
 * Dashboard store using Dumb Store pattern.
 * Logic is moved to useDashboard.ts composable.
 */
export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function setSummary(newSummary: DashboardSummary | null) {
    summary.value = newSummary;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function reset() {
    summary.value = null;
    isLoading.value = false;
    error.value = null;
  }

  return {
    summary,
    isLoading,
    error,
    setSummary,
    setLoading,
    setError,
    reset,
  };
});
