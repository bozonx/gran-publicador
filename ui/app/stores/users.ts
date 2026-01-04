import type { Database } from '~/types/database.types'

type User = Database['public']['Tables']['users']['Row']

export interface UserWithStats extends User {
  projectsCount?: number
  postsCount?: number
  isBanned?: boolean
  banReason?: string | null
  fullName?: string | null
  telegramUsername?: string | null
}

export interface UsersFilter {
  is_admin?: boolean | null
  search?: string
}

export interface UsersPaginationOptions {
  page: number
  perPage: number
}

export const useUsersStore = defineStore('users', () => {
  const users = shallowRef<UserWithStats[]>([])
  const currentUser = shallowRef<UserWithStats | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<UsersFilter>({})
  const pagination = ref<UsersPaginationOptions>({ page: 1, perPage: 20 })
  const totalCount = ref(0)

  const totalPages = computed(() => Math.ceil(totalCount.value / pagination.value.perPage))

  function setUsers(newUsers: UserWithStats[]) {
    users.value = newUsers
  }

  function setCurrentUser(user: UserWithStats | null) {
    currentUser.value = user
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setError(err: string | null) {
    error.value = err
  }

  function setFilter(newFilter: UsersFilter) {
    filter.value = { ...filter.value, ...newFilter }
    pagination.value.page = 1
  }

  function clearFilter() {
    filter.value = {}
    pagination.value.page = 1
  }

  function setPage(page: number) {
    pagination.value.page = page
  }

  function setTotalCount(count: number) {
    totalCount.value = count
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
  }
})
