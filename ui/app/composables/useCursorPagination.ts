import { ref, watch, type Ref } from 'vue';

export interface CursorPaginationResponse<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number;
}

export interface UseCursorPaginationOptions<T, P> {
  fetchFn: (params: P, cursor?: string) => Promise<CursorPaginationResponse<T>>;
  initialParams: P;
  limit?: number;
}

export function useCursorPagination<T, P>(options: UseCursorPaginationOptions<T, P>) {
  const { fetchFn, initialParams, limit = 10 } = options;

  const items = ref<T[]>([]) as Ref<T[]>;
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const cursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const total = ref<number | null>(null);
  const currentParams = ref<P>(JSON.parse(JSON.stringify(initialParams))) as Ref<P>;

  async function load(params?: Partial<P>, isLoadMore = false) {
    if (isLoading.value) return;

    if (!isLoadMore) {
      cursor.value = undefined;
      items.value = [];
    }

    if (params) {
      currentParams.value = { ...currentParams.value, ...params };
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetchFn(currentParams.value, cursor.value);
      
      if (isLoadMore) {
        items.value.push(...response.items);
      } else {
        items.value = response.items;
      }

      cursor.value = response.nextCursor || undefined;
      hasMore.value = !!response.nextCursor;
      if (response.total !== undefined) {
        total.value = response.total;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load data';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value) return;
    await load(undefined, true);
  }

  function reset() {
    items.value = [];
    cursor.value = undefined;
    hasMore.value = false;
    error.value = null;
    currentParams.value = JSON.parse(JSON.stringify(initialParams));
  }

  return {
    items,
    isLoading,
    error,
    hasMore,
    total,
    cursor,
    currentParams,
    load,
    loadMore,
    reset,
  };
}
