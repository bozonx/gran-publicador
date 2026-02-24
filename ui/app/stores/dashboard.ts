import { defineStore } from 'pinia';

export interface DashboardSummary {
  projects: any[];
  recentContent: any[];
  channelsSummary: {
    totalCount: number;
    grouped: Array<{ count: number; socialMedia: string }>;
  };
  publications: {
    scheduled: {
      items: any[];
      total: number;
      groupedByProject: Array<{
        project: { id: string; name: string };
        publications: any[];
      }>;
    };
    problems: {
      items: any[];
      total: number;
      groupedByProject: Array<{
        project: { id: string; name: string };
        publications: any[];
      }>;
    };
    recentPublished: {
      items: any[];
      total: number;
    };
  };
  timestamp: string;
}

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const api = useApi();

  async function fetchSummary() {
    isLoading.value = true;
    error.value = null;
    try {
      summary.value = await api.get<DashboardSummary>('/dashboard/summary');
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch dashboard summary';
      console.error('[DashboardStore] fetchSummary error:', err);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    summary,
    isLoading,
    error,
    fetchSummary,
  };
});
