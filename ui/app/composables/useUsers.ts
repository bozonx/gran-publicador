import { storeToRefs } from 'pinia';
import { useUsersStore } from '~/stores/users';
import type { UserWithStats, UsersFilter } from '~/stores/users';

export function useUsers() {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const store = useUsersStore();
  const { users, currentUser, isLoading, error, filter, pagination, totalCount, totalPages } =
    storeToRefs(store);

  async function fetchUsers() {
    store.setLoading(true);
    store.setError(null);

    try {
      const limit = pagination.value.limit;
      const offset = Math.max(0, (pagination.value.page - 1) * limit);

      const params = {
        limit,
        offset,
        ...filter.value,
      };

      const { data, meta } = await api.get<{ data: UserWithStats[]; meta: { total: number } }>(
        '/users',
        {
          params,
        },
      );

      store.setUsers(data);
      store.setTotalCount(meta.total);
    } catch (err: any) {
      const message = err.message || 'Failed to fetch users';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
    } finally {
      store.setLoading(false);
    }
  }

  async function fetchUserById(id: string) {
    store.setLoading(true);
    store.setError(null);
    try {
      return await api.get<UserWithStats>(`/users/${id}`);
    } catch (err: any) {
      const message = err.message || 'Failed to fetch user';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function toggleAdminStatus(userId: string) {
    try {
      // Fetch fresh user data to ensure we toggle the correct state
      const user = await fetchUserById(userId);
      if (!user) return;

      const newStatus = !user.isAdmin; // Use the property from the API response

      await api.patch(`/users/${userId}/admin`, { isAdmin: newStatus });

      toast.add({
        title: t('common.success'),
        description: t('admin.userUpdated'),
        color: 'success',
      });

      // Refresh list if we have it
      if (users.value.length > 0) {
        await fetchUsers();
      }
      return newStatus;
    } catch (err: any) {
      const message = err.message || 'Failed to update user';
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    }
  }

  async function toggleBan(userId: string, isBanned: boolean, reason?: string) {
    try {
      if (isBanned) {
        await api.post(`/users/${userId}/ban`, { reason });
      } else {
        await api.post(`/users/${userId}/unban`);
      }

      toast.add({
        title: t('common.success'),
        description: isBanned ? t('admin.userBanned') : t('admin.userUnbanned'),
        color: 'success',
      });

      // Refresh list
      await fetchUsers();
    } catch (err: any) {
      const message = err.message || 'Failed to update user';
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
    }
  }

  function setFilter(newFilter: UsersFilter) {
    store.setFilter(newFilter);
  }

  function clearFilter() {
    store.clearFilter();
  }

  function setPage(page: number) {
    store.setPage(page);
  }

  function getUserDisplayName(user: UserWithStats): string {
    return (
      user.fullName || user.telegramUsername || user.full_name || user.telegram_username || 'User'
    );
  }

  function getUserInitials(user: UserWithStats): string {
    const name = getUserDisplayName(user);
    return name.slice(0, 2).toUpperCase();
  }

  async function deleteUserPermanently(userId: string) {
    store.setLoading(true);
    store.setError(null);
    try {
      await api.delete(`/users/${userId}/permanent`);
      toast.add({
        title: t('common.success'),
        description: t('admin.userDeleted', 'User permanently deleted'),
        color: 'success',
      });
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to delete user';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  async function logoutUser(userId: string) {
    store.setLoading(true);
    store.setError(null);
    try {
      await api.post(`/users/${userId}/logout`);
      toast.add({
        title: t('common.success'),
        description: t('admin.userLoggedOut', 'User has been logged out'),
        color: 'success',
      });
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to logout user';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  return {
    users,
    currentUser,
    isLoading,
    error,
    pagination,
    totalCount,
    totalPages,
    fetchUsers,
    toggleAdminStatus,
    toggleBan,
    setFilter,
    clearFilter,
    setPage,
    getUserDisplayName,
    getUserInitials,
    fetchUserById,
    deleteUserPermanently,
    logoutUser,
  };
}
