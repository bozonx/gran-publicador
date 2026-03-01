import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { PostWithRelations } from '~/types/posts';
import type { PostsFilter } from '~/composables/posts/usePostState';

/**
 * Posts store using Dumb Store pattern.
 * Logic is moved to usePostState.ts and other post composables.
 */
export const usePostsStore = defineStore('posts', () => {
  const items = ref<PostWithRelations[]>([]);
  const currentPost = ref<PostWithRelations | null>(null);
  const totalCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const filter = ref<PostsFilter>({});
  const pagination = ref({
    page: 1,
    limit: 10,
  });

  function setItems(newItems: PostWithRelations[]) {
    items.value = newItems;
  }

  function appendItems(newItems: PostWithRelations[]) {
    const existingIds = new Set(items.value.map(i => i.id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
    items.value = [...items.value, ...uniqueNewItems];
  }

  function setCurrentPost(post: PostWithRelations | null) {
    currentPost.value = post;
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setFilter(newFilter: PostsFilter) {
    filter.value = newFilter;
  }

  function setPagination(newPagination: { page: number; limit: number }) {
    pagination.value = newPagination;
  }

  function updatePostInList(id: string, updates: Partial<PostWithRelations>) {
    const index = items.value.findIndex(p => p.id === id);
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates };
    }
    if (currentPost.value?.id === id) {
      currentPost.value = { ...currentPost.value, ...updates };
    }
  }

  function reset() {
    items.value = [];
    currentPost.value = null;
    totalCount.value = 0;
    isLoading.value = false;
    error.value = null;
    filter.value = {};
    pagination.value = {
      page: 1,
      limit: 10,
    };
  }

  return {
    items,
    currentPost,
    totalCount,
    isLoading,
    error,
    filter,
    pagination,
    setItems,
    appendItems,
    setCurrentPost,
    setTotalCount,
    setLoading,
    setError,
    setFilter,
    setPagination,
    updatePostInList,
    reset,
  };
});
