import { storeToRefs } from 'pinia';
import { useUsersStore } from '~/stores/users';

export function useUserState() {
  const store = useUsersStore();
  const { 
    users, 
    currentUser, 
    isLoading, 
    error, 
    filter, 
    pagination, 
    totalCount, 
    totalPages 
  } = storeToRefs(store);

  return {
    store,
    users,
    currentUser,
    isLoading,
    error,
    filter,
    pagination,
    totalCount,
    totalPages,
    setLoading: store.setLoading,
    setError: store.setError,
  };
}
