<script setup lang="ts">
import type { UserWithStats } from '~/stores/users'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { t, d } = useI18n()
const toast = useToast()

// Tab management
const selectedTab = ref('users')

interface AdminTab {
  key: string
  label: string
  icon: string
}

const tabs = computed<AdminTab[]>(() => [
  {
    key: 'users',
    label: t('admin.tabs.users'),
    icon: 'i-heroicons-users',
  },
  {
    key: 'config',
    label: t('admin.tabs.config', 'Configuration'),
    icon: 'i-heroicons-cog-6-tooth',
  },
])

const { fetchConfig, updateConfig, loading: configLoading, error: configError } = useConfig()
const yamlContent = ref('')
const isSaving = ref(false)

async function loadYamlConfig() {
  try {
    yamlContent.value = await fetchConfig()
  } catch (e) {
    console.error('Failed to load config', e)
  }
}

async function handleSaveConfig() {
  isSaving.value = true
  try {
    await updateConfig(yamlContent.value)
    toast.add({
      title: t('common.success'),
      description: t('admin.config.saved', 'Configuration saved and applied'),
      color: 'success',
    })
  } catch (e) {
    console.error('Failed to save config', e)
  } finally {
    isSaving.value = false
  }
}

watch(selectedTab, (newTab) => {
  if (newTab === 'config' && !yamlContent.value) {
    loadYamlConfig()
  }
})

// Users management
const columns = computed<TableColumn<UserWithStats>[]>(() => [
  { accessorKey: 'user', header: t('user.username') },

  { accessorKey: 'role', header: t('user.role') },
  { accessorKey: 'stats', header: t('admin.statistics') },
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
  { value: 'true', label: t('admin.adminsOnly', 'Admins only') },
  { value: 'false', label: t('admin.regularUsers', 'Regular users') },
])

// Watch for filter changes
watch([selectedAdminFilter, searchQuery], () => {
  const isAdminValue =
    selectedAdminFilter.value === null ? null : selectedAdminFilter.value === 'true'

  setFilter({
    is_admin: isAdminValue,
    search: searchQuery.value || undefined,
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

    <!-- Tabs -->
    <div class="mb-6">
      <nav class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="[
            selectedTab === tab.key
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
          @click="selectedTab = tab.key"
        >
          <UIcon :name="tab.icon" class="w-5 h-5" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </div>

    <!-- Users Tab -->
    <div v-if="selectedTab === 'users'">
      <!-- Tab header -->
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
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Search -->
          <UInput
            v-model="searchQuery"
            :placeholder="t('admin.searchUsers', 'Search by name or username')"
            icon="i-heroicons-magnifying-glass"
            class="sm:col-span-2"
          />

          <!-- Admin filter -->
          <USelectMenu
            v-model="selectedAdminFilter"
            :items="adminFilterOptions"
            value-key="value"
            label-key="label"
            :placeholder="t('admin.filterByRole', 'Filter by role')"
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
        class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center"
      >
        <UIcon
          name="i-heroicons-users"
          class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
        />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('admin.noUsersFound', 'No users found') }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          {{
            hasActiveFilters
              ? t('admin.noUsersFiltered', 'No users match your filters')
              : t('admin.noUsersDescription', 'There are no users in the system yet')
          }}
        </p>
      </div>

      <!-- Users table -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <UTable
          :data="users"
          :columns="columns"
          :loading="isLoading"
        >
          <!-- User info column -->
          <template #user-cell="{ row }">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="row.original.avatar_url ?? undefined"
                :alt="getUserDisplayName(row.original)"
                size="sm"
              >
                <template #fallback>
                  <span class="text-xs">{{ getUserInitials(row.original) }}</span>
                </template>
              </UAvatar>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ row.original.full_name || '-' }}
                </div>
                <div class="text-sm text-gray-500">@{{ row.original.telegram_username || 'no-username' }}</div>
              </div>
            </div>
          </template>

          <!-- Role column -->
          <template #role-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <UBadge
                :color="row.original.is_admin ? 'primary' : 'neutral'"
                :variant="row.original.is_admin ? 'solid' : 'outline'"
                size="sm"
              >
                {{ row.original.is_admin ? t('user.isAdmin') : t('admin.regularUser') }}
              </UBadge>
              <UBadge
                v-if="row.original.isBanned"
                color="error"
                variant="solid"
                size="sm"
              >
                {{ t('admin.banned', 'BANNED') }}
              </UBadge>
            </div>
          </template>

          <!-- Statistics column -->
          <template #stats-cell="{ row }">
            <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
                {{ row.original.projectsCount || 0 }} {{ t('project.titlePlural').toLowerCase() }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                {{ row.original.postsCount || 0 }} {{ t('post.titlePlural').toLowerCase() }}
              </span>
            </div>
          </template>

          <!-- Created at column -->
          <template #created_at-cell="{ row }">
            {{ row.original.created_at ? d(new Date(row.original.created_at!), 'long') : '-' }}
          </template>

          <!-- Actions column -->
          <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  :color="row.original.is_admin ? 'warning' : 'success'"
                  variant="ghost"
                  size="sm"
                  :icon="row.original.is_admin ? 'i-heroicons-shield-exclamation' : 'i-heroicons-shield-check'"
                  :title="row.original.is_admin ? t('admin.revokeAdmin') : t('admin.grantAdmin')"
                  @click="confirmToggleAdmin(row.original)"
                />
                <UButton
                  :color="row.original.isBanned ? 'primary' : 'error'"
                  variant="ghost"
                  size="sm"
                  :icon="row.original.isBanned ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'"
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

    <!-- Config Tab -->
    <div v-if="selectedTab === 'config'">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('admin.tabs.config') }}
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('admin.config.description', 'Edit application configuration (app-config.yaml). Changes are applied immediately.') }}
        </p>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div v-if="configLoading && !yamlContent" class="flex items-center justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
        </div>
        
        <div v-else>
          <div v-if="configError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-red-700 dark:text-red-300">{{ configError }}</p>
          </div>

          <div class="mb-4">
            <UTextarea
              v-model="yamlContent"
              :rows="20"
              class="font-mono text-sm w-full"
              :placeholder="t('admin.config.placeholder', 'Paste your YAML config here...')"
            />
          </div>

          <div class="flex justify-end">
            <UButton
              color="primary"
              :loading="isSaving"
              icon="i-heroicons-check-circle"
              @click="handleSaveConfig"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm toggle admin modal -->
    <UModal v-model:open="showConfirmModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="p-2 rounded-lg"
              :class="
                userToToggle?.is_admin
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
              "
            >
              <UIcon
                :name="
                  userToToggle?.is_admin
                    ? 'i-heroicons-shield-exclamation'
                    : 'i-heroicons-shield-check'
                "
                class="w-6 h-6"
                :class="
                  userToToggle?.is_admin
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
                "
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{
                userToToggle?.is_admin
                  ? t('admin.revokeAdmin', 'Revoke admin')
                  : t('admin.grantAdmin', 'Grant admin')
              }}
            </h3>
          </div>

          <p class="text-gray-600 dark:text-gray-400 mb-2">
            {{
              userToToggle?.is_admin
                ? t(
                    'admin.revokeAdminConfirm',
                    'Are you sure you want to revoke admin rights from this user?'
                  )
                : t(
                    'admin.grantAdminConfirm',
                    'Are you sure you want to grant admin rights to this user?'
                  )
            }}
          </p>

          <div
            v-if="userToToggle"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-6"
          >
            <UAvatar
              :src="userToToggle.avatar_url ?? undefined"
              :alt="getUserDisplayName(userToToggle)"
              size="sm"
            />
            <div>
              <div class="font-medium text-gray-900 dark:text-white">
                {{ getUserDisplayName(userToToggle) }}
              </div>
              <div class="text-sm text-gray-500">
                {{ userToToggle.telegram_username }}
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="isToggling"
              @click="cancelToggle"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="userToToggle?.is_admin ? 'warning' : 'success'"
              :loading="isToggling"
              @click="handleToggleAdmin"
            >
              {{
                userToToggle?.is_admin
                  ? t('admin.revokeAdmin', 'Revoke admin')
                  : t('admin.grantAdmin', 'Grant admin')
              }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Ban user modal -->
    <UModal v-model:open="showBanModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="p-2 rounded-lg"
              :class="
                userToBan?.isBanned
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              "
            >
              <UIcon
                :name="
                  userToBan?.isBanned
                    ? 'i-heroicons-lock-open'
                    : 'i-heroicons-lock-closed'
                "
                class="w-6 h-6"
                :class="
                  userToBan?.isBanned
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                "
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{
                userToBan?.isBanned
                  ? t('admin.unbanUser', 'Unban User')
                  : t('admin.banUser', 'Ban User')
              }}
            </h3>
          </div>

          <div v-if="!userToBan?.isBanned" class="mb-4">
             <UTextarea
               v-model="banReason"
               :placeholder="t('admin.banReason', 'Reason for blocking (optional)...')"
               :rows="3"
             />
          </div>

          <p class="text-gray-600 dark:text-gray-400 mb-6">
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

          <div class="flex justify-end gap-3">
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
                  ? t('admin.unban', 'Unban')
                  : t('admin.ban', 'Ban')
              }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
