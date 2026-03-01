import { useUserState } from './useUserState';
import type { UserWithStats } from '~/types/user';
import { computed } from 'vue';

export function useUserCrud() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();
  const state = useUserState();

  // Helper bindings for store state to be used with executeAction
  const loadingBinding = computed({
    get: () => state.isLoading.value,
    set: (val) => state.setLoading(val)
  });
  const errorBinding = computed({
    get: () => state.error.value,
    set: (val) => state.setError(val)
  });

  async function fetchUsers() {
    const [, result] = await executeAction(
      async () => {
        const limit = state.pagination.value.limit;
        const offset = Math.max(0, (state.pagination.value.page - 1) * limit);
        const params = { limit, offset, ...state.filter.value };
        const { data, meta } = await api.get<{ data: UserWithStats[]; meta: { total: number } }>(
          '/users',
          { params },
        );
        state.store.setUsers(data);
        state.store.setTotalCount(meta.total);
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false }
    );
    return result || [];
  }

  async function fetchUserById(id: string) {
    const [, result] = await executeAction(
      async () => await api.get<UserWithStats>(`/users/${id}`),
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false }
    );
    return result;
  }

  async function toggleAdminStatus(userId: string) {
    // Note: this logic performs a fetch first (original logic)
    const user = await fetchUserById(userId);
    if (!user) return null;

    const newStatus = !user.isAdmin;

    const [err] = await executeAction(
      async () => await api.patch(`/users/${userId}/admin`, { isAdmin: newStatus }),
      { successMessage: t('admin.userUpdated') }
    );

    if (!err) {
      if (state.users.value.length > 0) await fetchUsers();
      return newStatus;
    }
    return null;
  }

  async function toggleBan(userId: string, isBanned: boolean, reason?: string) {
    const [err] = await executeAction(
      async () => {
        if (isBanned) {
          await api.post(`/users/${userId}/ban`, { reason });
        } else {
          await api.post(`/users/${userId}/unban`);
        }
      },
      { successMessage: isBanned ? t('admin.userBanned') : t('admin.userUnbanned') }
    );

    if (!err) await fetchUsers();
  }

  async function deleteUserPermanently(userId: string) {
    const [err] = await executeAction(
      async () => await api.delete(`/users/${userId}/permanent`),
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('admin.userDeleted') }
    );
    return !err;
  }

  async function logoutUser(userId: string) {
    const [err] = await executeAction(
      async () => await api.post(`/users/${userId}/logout`),
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('admin.userLoggedOut') }
    );
    return !err;
  }

  return {
    fetchUsers,
    fetchUserById,
    toggleAdminStatus,
    toggleBan,
    deleteUserPermanently,
    logoutUser,
  };
}
