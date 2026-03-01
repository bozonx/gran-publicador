import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { NewsItem } from '~/types/news';

/**
 * News store using Dumb Store pattern.
 */
export const useNewsStore = defineStore('news', () => {
  const items = ref<NewsItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const cursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);

  function setItems(newItems: NewsItem[]) {
    items.value = newItems;
  }

  function appendItems(newItems: NewsItem[]) {
    const existingIds = new Set(items.value.map(i => i.id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
    items.value = [...items.value, ...uniqueNewItems];
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setCursor(newCursor: string | undefined) {
    cursor.value = newCursor;
  }

  function setHasMore(value: boolean) {
    hasMore.value = value;
  }

  function reset() {
    items.value = [];
    isLoading.value = false;
    error.value = null;
    cursor.value = undefined;
    hasMore.value = false;
  }

  return {
    items,
    isLoading,
    error,
    cursor,
    hasMore,
    setItems,
    appendItems,
    setLoading,
    setError,
    setCursor,
    setHasMore,
    reset,
  };
});
