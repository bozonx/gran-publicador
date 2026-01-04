import { storeToRefs } from 'pinia'
import { useUsersStore } from '~/stores/users'
import type { UserWithStats, UsersFilter } from '~/stores/users'

export function useUsers() {
    const api = useApi()
    const { t } = useI18n()
    const toast = useToast()

    const store = useUsersStore()
    const {
        users,
        currentUser,
        isLoading,
        error,
        filter,
        pagination,
        totalCount,
        totalPages,
    } = storeToRefs(store)

    async function fetchUsers() {
        store.setLoading(true)
        store.setError(null)

        try {
            const params = {
                page: pagination.value.page,
                perPage: pagination.value.perPage,
                ...filter.value,
            }

            const { data, meta } = await api.get<{ data: UserWithStats[]; meta: { total: number } }>('/users', {
                params,
            })

            store.setUsers(data)
            store.setTotalCount(meta.total)
        } catch (err: any) {
            const message = err.message || 'Failed to fetch users'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
        } finally {
            store.setLoading(false)
        }
    }

    async function toggleAdminStatus(userId: string) {
        try {
            // Find user locally to flip status optimistically or check current status
            const user = users.value.find(u => u.id === userId)
            if (!user) return

            const newStatus = !user.is_admin

            await api.patch(`/users/${userId}/admin`, { isAdmin: newStatus })

            toast.add({
                title: t('common.success'),
                description: t('admin.userUpdated'),
                color: 'success',
            })

            // Refresh list
            await fetchUsers()

        } catch (err: any) {
            const message = err.message || 'Failed to update user'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
        }
    }

    async function toggleBan(userId: string, isBanned: boolean, reason?: string) {
        try {
            if (isBanned) {
                await api.post(`/users/${userId}/ban`, { reason })
            } else {
                await api.post(`/users/${userId}/unban`)
            }

            toast.add({
                title: t('common.success'),
                description: isBanned ? t('admin.userBanned') : t('admin.userUnbanned'),
                color: 'success',
            })

            // Refresh list
            await fetchUsers()

        } catch (err: any) {
            const message = err.message || 'Failed to update user'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
        }
    }

    function setFilter(newFilter: UsersFilter) {
        store.setFilter(newFilter)
    }

    function clearFilter() {
        store.clearFilter()
    }

    function setPage(page: number) {
        store.setPage(page)
    }

    function getUserDisplayName(user: UserWithStats): string {
        return user.fullName || user.telegramUsername || user.full_name || user.telegram_username || 'User'
    }

    function getUserInitials(user: UserWithStats): string {
        const name = getUserDisplayName(user)
        return name.slice(0, 2).toUpperCase()
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
    }
}
