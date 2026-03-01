import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDashboardStore } from '~/stores/dashboard';
import type { DashboardSummary } from '~/types/dashboard';

export const useDashboard = () => {
  const store = useDashboardStore();
  const { summary, isLoading, error } = storeToRefs(store);
  const api = useApi();
  const { executeAction } = useApiAction();

  // Helper bindings for store state
  const loadingBinding = computed({
    get: () => isLoading.value,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => error.value,
    set: (val) => store.setError(val)
  });

  async function fetchSummary() {
    const [, response] = await executeAction(
      async () => {
        const data = await api.get<DashboardSummary>('/dashboard/summary');
        store.setSummary(data);
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return response;
  }

  return {
    summary,
    isLoading,
    error,
    fetchSummary,
  };
};
