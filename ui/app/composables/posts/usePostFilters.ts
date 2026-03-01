import { usePostState, type PostsFilter } from './usePostState';

export function usePostFilters() {
  const state = usePostState();

  function setPage(page: number) {
    state.pagination.value.page = page;
    state.filter.value = {
      ...state.filter.value,
      limit: state.filter.value.limit ?? state.pagination.value.limit,
      offset: Math.max(0, (page - 1) * (state.filter.value.limit ?? state.pagination.value.limit)),
    };
  }

  function setFilter(newFilter: Partial<PostsFilter>) {
    state.filter.value = { ...state.filter.value, ...newFilter };
    state.pagination.value.page = 1;
    state.filter.value.offset = 0;
  }

  function clearFilter() {
    state.filter.value = {};
    state.pagination.value.page = 1;
  }

  return {
    setPage,
    setFilter,
    clearFilter,
  };
}
