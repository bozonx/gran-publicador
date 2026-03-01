import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { PublicationWithRelations } from '~/types/publications';

/**
 * Publications store using Dumb Store pattern.
 * Logic is moved to usePublicationState.ts and other publication composables.
 */
export const usePublicationsStore = defineStore('publications', () => {
  const items = ref<PublicationWithRelations[]>([]);
  const currentPublication = ref<PublicationWithRelations | null>(null);
  const totalCount = ref(0);
  const totalUnfilteredCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function setItems(newItems: PublicationWithRelations[]) {
    items.value = newItems;
  }

  function appendItems(newItems: PublicationWithRelations[]) {
    // Avoid duplicates
    const existingIds = new Set(items.value.map(i => i.id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
    items.value = [...items.value, ...uniqueNewItems];
  }

  function setCurrentPublication(publication: PublicationWithRelations | null) {
    currentPublication.value = publication;
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function setTotalUnfilteredCount(count: number) {
    totalUnfilteredCount.value = count;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function updatePublicationInList(id: string, updates: Partial<PublicationWithRelations>) {
    const index = items.value.findIndex(p => p.id === id);
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates };
    }
    if (currentPublication.value?.id === id) {
      currentPublication.value = { ...currentPublication.value, ...updates };
    }
  }

  function reset() {
    items.value = [];
    currentPublication.value = null;
    totalCount.value = 0;
    totalUnfilteredCount.value = 0;
    isLoading.value = false;
    error.value = null;
  }

  return {
    items,
    currentPublication,
    totalCount,
    totalUnfilteredCount,
    isLoading,
    error,
    setItems,
    appendItems,
    setCurrentPublication,
    setTotalCount,
    setTotalUnfilteredCount,
    setLoading,
    setError,
    updatePublicationInList,
    reset,
  };
});
