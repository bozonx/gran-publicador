import { useUserState } from './useUserState';
import type { UsersFilter } from '~/stores/users';

export function useUserFilters() {
  const { store } = useUserState();

  function setFilter(newFilter: UsersFilter) {
    store.setFilter(newFilter);
  }

  function clearFilter() {
    store.clearFilter();
  }

  function setPage(page: number) {
    store.setPage(page);
  }

  return {
    setFilter,
    clearFilter,
    setPage,
  };
}
