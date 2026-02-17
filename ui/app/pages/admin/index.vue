<script setup lang="ts">
import type { UserWithStats } from '~/stores/users'
import type { TableColumn } from '@nuxt/ui'
import { FORM_STYLES } from '~/utils/design-tokens'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { t } = useI18n()
const toast = useToast()

// Collection management
const selectedCollection = ref('users')

const authStore = useAuthStore()
const { user: currentUser } = storeToRefs(authStore)

interface AdminCollection {
  key: string
  label: string
  icon: string
}

const collections = computed<AdminCollection[]>(() => [
  {
    key: 'users',
    label: t('admin.collections.users'),
    icon: 'i-heroicons-users',
  },
  {
    key: 'maintenance',
    label: t('admin.collections.maintenance'),
    icon: 'i-heroicons-wrench-screwdriver',
  },
])

const { runPublications, runNews, runMaintenance } = useAdminMaintenance()
const isRunningPublications = ref(false)
const isRunningNews = ref(false)
const isRunningMaintenance = ref(false)

async function handleRunPublications() {
  isRunningPublications.value = true
  try {
    await runPublications()
    toast.add({
      title: t('common.success'),
      description: t('admin.maintenance.publicationsSuccess'),
      color: 'success',
    })
  } finally {
    isRunningPublications.value = false
  }
}

async function handleRunNews() {
  isRunningNews.value = true
  try {
    await runNews()
    toast.add({
      title: t('common.success'),
      description: t('admin.maintenance.newsSuccess'),
      color: 'success',
    })
  } finally {
    isRunningNews.value = false
  }
}

async function handleRunMaintenance() {
  isRunningMaintenance.value = true
  try {
    await runMaintenance()
    toast.add({
      title: t('common.success'),
      description: t('admin.maintenance.runAllSuccess'),
      color: 'success',
    })
  } finally {
    isRunningMaintenance.value = false
  }
}

// Users management
const columns = computed<TableColumn<UserWithStats>[]>(() => [
  { accessorKey: 'user', header: t('user.username') },
  { accessorKey: 'stats', header: t('post.titlePlural') }, // Renamed to Posts
  { accessorKey: 'created_at', header: t('user.createdAt') },
  { accessorKey: 'actions', header: t('common.actions') }
])

const {
  users,
  isLoading,
  error,
  pagination,
  totalCount,
  totalPages,
  fetchUsers,
  toggleAdminStatus,
  setFilter,
  clearFilter,
  setPage,
  getUserDisplayName,
  getUserInitials,
  toggleBan,
} = useUsers()

// Filter state
const selectedAdminFilter = ref<string | null>(null)
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

// Confirmation modal state
const showConfirmModal = ref(false)
const userToToggle = ref<UserWithStats | null>(null)
const isToggling = ref(false)

// Ban modal state
const showBanModal = ref(false)
const userToBan = ref<UserWithStats | null>(null)
const banReason = ref('')
const isBanning = ref(false)

// Fetch users on mount
onMounted(() => {
  fetchUsers()
})

// Admin filter options
const adminFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  { value: 'true', label: t('admin.adminsOnly') },
  { value: 'false', label: t('admin.regularUsers') },
])

// Watch for filter changes
watch([selectedAdminFilter, debouncedSearch], () => {
  const isAdminValue =
    selectedAdminFilter.value === null ? null : selectedAdminFilter.value === 'true'

  setFilter({
    is_admin: isAdminValue,
    search: debouncedSearch.value || undefined,
  })
  fetchUsers()
})

// Watch for page changes
watch(
  () => pagination.value.page,
  () => {
    fetchUsers()
  }
)

/**
 * Open confirmation modal
 */
function confirmToggleAdmin(user: UserWithStats) {
  userToToggle.value = user
  showConfirmModal.value = true
}

/**
 * Handle admin toggle
 */
async function handleToggleAdmin() {
  if (!userToToggle.value) return

  isToggling.value = true
  await toggleAdminStatus(userToToggle.value.id)
  isToggling.value = false
  showConfirmModal.value = false
  userToToggle.value = null
}

function handleRowClick(row: any) {
    navigateTo(`/admin/users/${row.original.id}`)
}

/**
 * Cancel admin toggle
 */
function cancelToggle() {
  showConfirmModal.value = false
  userToToggle.value = null
}

/**
 * Open ban modal
 */
function confirmBan(user: UserWithStats) {
  userToBan.value = user
  banReason.value = ''
  showBanModal.value = true
}

/**
 * Handle ban action
 */
async function handleBan() {
  if (!userToBan.value) return

  isBanning.value = true
  // If user is already banned, we are unbanning (toggle logic handled here or pass explicit bool)
  // toggleBan(id, isBanned, reason) -> if passing true, we are banning.
  
  const isBanningAction = !userToBan.value.isBanned
  await toggleBan(userToBan.value.id, isBanningAction, banReason.value)
  
  isBanning.value = false
  showBanModal.value = false
  userToBan.value = null
}

/**
 * Cancel ban
 */
function cancelBan() {
  showBanModal.value = false
  userToBan.value = null
  banReason.value = ''
}

/**
 * Reset all filters
 */
function resetFilters() {
  selectedAdminFilter.value = null
  searchQuery.value = ''
  clearFilter()
  fetchUsers()
}

/**
 * Check if any filter is active
 */
const hasActiveFilters = computed(() => {
  return selectedAdminFilter.value !== null || searchQuery.value
})
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('admin.panel.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('admin.panel.description') }}
      </p>
    </div>

    <!-- Collections -->
    <div class="mb-6">
      <nav class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          v-for="collection in collections"
          :key="collection.key"
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="[
            selectedCollection === collection.key
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
          @click="selectedCollection = collection.key"
        >
          <UIcon :name="collection.icon" class="w-5 h-5" />
          <span>{{ collection.label }}</span>
        </button>
      </nav>
    </div>

    <!-- Users Collection -->
    <div v-if="selectedCollection === 'users'">
      <!-- Collection header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ t('admin.userManagement') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ totalCount }} {{ t('navigation.users').toLowerCase() }}
          </p>
        </div>
      </div>

      <!-- Filters -->
      <div class="app-card p-4 mb-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Search -->
          <CommonSearchInput
            v-model="searchQuery"
            :placeholder="t('admin.searchUsers')"
            class="sm:col-span-2"
            :loading="isLoading && searchQuery !== debouncedSearch"
          />

          <!-- Admin filter -->
          <USelectMenu
            v-model="selectedAdminFilter"
            :items="adminFilterOptions"
            value-key="value"
            label-key="label"
            :placeholder="t('admin.filterByRole')"
          />
        </div>

        <!-- Reset filters button -->
        <div v-if="hasActiveFilters" class="mt-4">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-heroicons-x-mark"
            @click="resetFilters"
          >
            {{ t('common.reset') }}
          </UButton>
        </div>
      </div>

      <!-- Error state -->
      <div
        v-if="error"
        class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="w-5 h-5 text-red-600 dark:text-red-400"
          />
          <p class="text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>

      <!-- Loading state -->
      <div v-else-if="isLoading && users.length === 0" class="flex items-center justify-center py-12">
        <div class="text-center">
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
          />
          <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="users.length === 0"
        class="app-card p-12 text-center"
      >
        <UIcon
          name="i-heroicons-users"
          class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
        />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('admin.noUsersFound') }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          {{
            hasActiveFilters
              ? t('admin.noUsersFiltered')
              : t('admin.noUsersDescription')
          }}
        </p>
      </div>

      <!-- Users table -->
      <div v-else class="app-card overflow-hidden">
        <UTable
          :data="users"
          :columns="columns"
          :loading="isLoading"
          :ui="{ tr: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' }"
        >
          <!-- User info column -->
          <template #user-cell="{ row }">
            <div 
              class="flex items-center gap-3 w-full h-full py-2" 
              @click="handleRowClick(row)"
            >
              <!-- Avatar removed as requested -->
              <div>
                <div class="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <UIcon v-if="row.original.isAdmin" name="i-heroicons-shield-check" class="w-4 h-4 text-primary" />
                    {{ row.original.fullName || '-' }}
                </div>
                <div 
                  class="text-sm"
                  :class="[
                      (row.original.id === currentUser?.id) 
                        ? 'text-green-500 font-medium' 
                        : 'text-gray-500'
                  ]"
                >
                  {{ row.original.telegramUsername ? `@${row.original.telegramUsername}` : `#${row.original.telegramId || row.original.telegram_id}` }}
                </div>
              </div>
            </div>
          </template>

          <!-- Role column removed -->

          <!-- Statistics column (Posts count only) -->
          <template #stats-cell="{ row }">
            <div 
              class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 w-full h-full py-2"
              @click="handleRowClick(row)"
            >
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                {{ row.original.publicationsCount || 0 }} {{ t('post.titlePlural').toLowerCase() }}
              </span>
            </div>
          </template>

          <!-- Created at column -->
          <template #created_at-cell="{ row }">
            <div 
              class="w-full h-full py-2"
              @click="handleRowClick(row)"
            >
              {{ row.original.createdAt ? new Date(row.original.createdAt!).toLocaleDateString() : '-' }}
            </div>
          </template>

          <!-- Actions column -->
          <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2" @click.stop>
                <!-- Ban toggle button -->
                <UButton
                  :color="row.original.isBanned ? 'error' : 'success'"
                  variant="ghost"
                  size="sm"
                  :icon="row.original.isBanned ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
                  :title="row.original.isBanned ? t('admin.unban') : t('admin.ban')"
                  @click="confirmBan(row.original)"
                />
              </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
        <UButton
          :disabled="pagination.page <= 1"
          variant="outline"
          color="neutral"
          icon="i-heroicons-chevron-left"
          size="sm"
          @click="setPage(pagination.page - 1)"
        />

        <span class="text-sm text-gray-600 dark:text-gray-400 px-4">
          {{ pagination.page }} / {{ totalPages }}
        </span>

        <UButton
          :disabled="pagination.page >= totalPages"
          variant="outline"
          color="neutral"
          icon="i-heroicons-chevron-right"
          size="sm"
          @click="setPage(pagination.page + 1)"
        />
      </div>
    </div>

    <!-- Maintenance Collection -->
    <div v-if="selectedCollection === 'maintenance'">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('admin.collections.maintenance') }}
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('admin.maintenance.description') }}
        </p>
      </div>

      <div class="app-card p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UButton
            color="primary"
            variant="soft"
            icon="i-heroicons-paper-airplane"
            :loading="isRunningPublications"
            @click="handleRunPublications"
          >
            {{ t('admin.maintenance.runPublications') }}
          </UButton>

          <UButton
            color="primary"
            variant="soft"
            icon="i-heroicons-bell-alert"
            :loading="isRunningNews"
            @click="handleRunNews"
          >
            {{ t('admin.maintenance.runNewsNotifications') }}
          </UButton>

          <UButton
            color="warning"
            icon="i-heroicons-wrench-screwdriver"
            :loading="isRunningMaintenance"
            @click="handleRunMaintenance"
          >
            {{ t('admin.maintenance.runAll') }}
          </UButton>

          <p class="text-sm text-gray-500 dark:text-gray-400 md:col-span-2">
            {{ t('admin.maintenance.runAllHint') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Confirm toggle admin modal -->
    <UiConfirmModal
      v-if="showConfirmModal"
      v-model:open="showConfirmModal"
      :title="userToToggle?.isAdmin ? t('admin.revokeAdmin') : t('admin.grantAdmin')"
      :description="userToToggle?.isAdmin ? t('admin.revokeAdminConfirm') : t('admin.grantAdminConfirm')"
      :confirm-text="userToToggle?.isAdmin ? t('admin.revokeAdmin') : t('admin.grantAdmin')"
      :color="userToToggle?.isAdmin ? 'warning' : 'success'"
      :icon="userToToggle?.isAdmin ? 'i-heroicons-shield-exclamation' : 'i-heroicons-shield-check'"
      :loading="isToggling"
      @confirm="handleToggleAdmin"
    >
      <div
        v-if="userToToggle"
        class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
      >
        <UAvatar
          :src="userToToggle.avatarUrl ?? undefined"
          :alt="getUserDisplayName(userToToggle)"
          size="sm"
        />
        <div>
          <div class="font-medium text-gray-900 dark:text-white">
            {{ getUserDisplayName(userToToggle) }}
          </div>
          <div class="text-sm text-gray-500">
            {{ userToToggle.telegramUsername }}
          </div>
        </div>
      </div>
    </UiConfirmModal>

    <!-- Ban user modal -->
    <UiAppModal
      v-if="showBanModal"
      v-model:open="showBanModal"
      :title="userToBan?.isBanned ? t('admin.unbanUser') : t('admin.banUser')"
    >
      <div v-if="!userToBan?.isBanned" class="mb-4">
         <UTextarea
           v-model="banReason"
           :placeholder="t('admin.banReason')"
           :rows="FORM_STYLES.textareaRows"
           autoresize
         />
      </div>

      <p class="text-gray-600 dark:text-gray-400">
        {{
          userToBan?.isBanned
            ? t(
                'admin.unbanConfirm',
                'Are you sure you want to unban this user? They will regain access to the platform.'
              )
            : t(
                'admin.banConfirm',
                'Are you sure you want to ban this user? They will lose access to the platform immediately.'
              )
        }}
      </p>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="isBanning"
          @click="cancelBan"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          :color="userToBan?.isBanned ? 'primary' : 'error'"
          :loading="isBanning"
          @click="handleBan"
        >
          {{
            userToBan?.isBanned
              ? t('admin.unban')
              : t('admin.ban')
          }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
