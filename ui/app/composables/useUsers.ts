import { useUserState } from './users/useUserState';
import { useUserCrud } from './users/useUserCrud';
import { useUserFilters } from './users/useUserFilters';
import { useUserUi } from './users/useUserUi';

export { getUserDisplayName, getUserInitials } from './users/useUserUi';

export function useUsers() {
  const state = useUserState();
  const crud = useUserCrud();
  const filters = useUserFilters();
  const ui = useUserUi();

  return {
    ...state,
    ...crud,
    ...filters,
    ...ui,
  };
}
