import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { MediaItem } from '~/types/media';

/**
 * Media store using Dumb Store pattern.
 */
export const useMediaStore = defineStore('media', () => {
  const items = shallowRef<MediaItem[]>([]);
  const currentMedia = shallowRef<MediaItem | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);

  function setItems(newItems: MediaItem[]) {
    items.value = newItems;
  }

  function appendItems(newItems: MediaItem[]) {
    const existingIds = new Set(items.value.map(i => i.id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
    items.value = [...items.value, ...uniqueNewItems];
  }

  function setCurrentMedia(media: MediaItem | null) {
    currentMedia.value = media;
  }

  function updateMediaInList(id: string, updates: Partial<MediaItem>) {
    const index = items.value.findIndex(item => item.id === id);
    if (index !== -1) {
      const newList = [...items.value];
      newList[index] = { ...newList[index], ...updates };
      items.value = newList;
    }
    if (currentMedia.value?.id === id) {
      currentMedia.value = { ...currentMedia.value, ...updates };
    }
  }

  function removeMediaFromList(id: string) {
    items.value = items.value.filter(item => item.id !== id);
    if (currentMedia.value?.id === id) {
      currentMedia.value = null;
    }
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function reset() {
    items.value = [];
    currentMedia.value = null;
    isLoading.value = false;
    error.value = null;
    totalCount.value = 0;
  }

  return {
    items,
    currentMedia,
    isLoading,
    error,
    totalCount,
    setItems,
    appendItems,
    setCurrentMedia,
    updateMediaInList,
    removeMediaFromList,
    setLoading,
    setError,
    setTotalCount,
    reset,
  };
});
