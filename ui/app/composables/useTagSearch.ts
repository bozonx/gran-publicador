import { createSearchRequestTracker, resolveTagSearchScope } from '~/utils/common-input-tags';

interface UseTagSearchOptions {
  searchEndpoint?: string;
  scope?: 'personal' | 'project';
  projectId?: string;
  userId?: string;
  groupId?: string;
  debounceMs?: number;
}

/**
 * Composable for managing tag search logic with debounce and cancellation support.
 */
export function useTagSearch(options: UseTagSearchOptions = {}) {
  const {
    searchEndpoint = '/tags/search',
    debounceMs = 200,
  } = options;

  const { t } = useI18n();
  const api = useApi();
  const toast = useToast();
  
  const loading = ref(false);
  const items = ref<string[]>([]);
  const searchTerm = ref('');
  const activeSearchController = ref<AbortController | null>(null);
  const searchRequestTracker = createSearchRequestTracker();

  async function searchTags(q: string, signal?: AbortSignal) {
    if (!q || q.length < 1) return [];

    const params: any = {
      q,
      limit: 10,
    };

    if (options.scope) {
      params.scope = options.scope;
      if (options.scope === 'project') {
        params.projectId = options.projectId;
      }
      params.groupId = options.groupId;
    } else {
      const resolvedScope = resolveTagSearchScope({
        projectId: options.projectId,
        userId: options.userId,
      });

      if (resolvedScope.reason !== 'ok') {
        // Warning logic can be moved here or handled via return
        return [];
      }
      Object.assign(params, resolvedScope.scope);
    }

    try {
      const res = await api.get<{ name: string }[]>(searchEndpoint, {
        signal,
        params,
      });
      return res.map(t => t.name);
    } catch (err: any) {
      if (err.message === 'Request aborted') {
        return [];
      }

      console.error('Failed to search tags:', err);
      toast.add({
        title: t('common.error'),
        description: t('common.unexpectedError'),
        color: 'error',
      });
      return [];
    }
  }

  const debouncedSearch = useDebounceFn(async () => {
    const q = searchTerm.value.trim();
    if (!q) return;

    activeSearchController.value?.abort();
    const nextController = api.createAbortController();
    activeSearchController.value = nextController;

    const requestId = searchRequestTracker.next();
    loading.value = true;

    try {
      const result = await searchTags(q, nextController.signal);
      if (!searchRequestTracker.isLatest(requestId)) return;
      items.value = result;
    } finally {
      if (searchRequestTracker.isLatest(requestId)) {
        loading.value = false;
      }
    }
  }, debounceMs);

  watch(searchTerm, () => {
    if (!searchTerm.value.trim()) {
      searchRequestTracker.invalidate();
      activeSearchController.value?.abort();
      activeSearchController.value = null;
      loading.value = false;
      items.value = [];
      return;
    }
    debouncedSearch();
  });

  onBeforeUnmount(() => {
    activeSearchController.value?.abort();
  });

  return {
    searchTerm,
    items,
    loading,
    searchRequestTracker,
  };
}
