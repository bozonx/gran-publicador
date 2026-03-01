import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { UserWithStats, UsersFilter, UsersPaginationOptions } from '~/types/user';

/**
 * Users store using Dumb Store pattern.
 */
export const useUsersStore = defineStore('users', () => {
  const users = shallowRef<UserWithStats[]>([]);
  const currentUser = shallowRef<UserWithStats | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const filter = ref<UsersFilter>({});
  const pagination = ref<UsersPaginationOptions>({ page: 1, limit: 20 });
  const totalCount = ref(0);

  const totalPages = computed(() => Math.ceil(totalCount.value / pagination.value.limit));

  function setUsers(newUsers: UserWithStats[]) {
    users.value = newUsers;
  }

  function setCurrentUser(user: UserWithStats | null) {
    currentUser.value = user;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setFilter(newFilter: UsersFilter) {
    filter.value = { ...filter.value, ...newFilter };
    pagination.value.page = 1;
  }

  function clearFilter() {
    filter.value = {};
    pagination.value.page = 1;
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function reset() {
    users.value = [];
    currentUser.value = null;
    isLoading.value = false;
    error.value = null;
    filter.value = {};
    pagination.value = { page: 1, limit: 20 };
    totalCount.value = 0;
  }

  return {
    users,
    currentUser,
    isLoading,
    error,
    filter,
    pagination,
    totalCount,
    totalPages,
    setUsers,
    setCurrentUser,
    setLoading,
    setError,
    setFilter,
    clearFilter,
    setPage,
    setTotalCount,
    reset,
  };
});
