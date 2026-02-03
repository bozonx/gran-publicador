<script setup lang="ts">
import type { UserWithStats } from '~/stores/users'
import { FORM_STYLES } from '~/utils/design-tokens'
import yaml from 'js-yaml'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { t, d } = useI18n()
const route = useRoute()
const userId = route.params.id as string
const toast = useToast()
const router = useRouter()

const {
  fetchUserById,
  toggleAdminStatus,
  toggleBan,
  deleteUserPermanently,
  logoutUser,
  getUserDisplayName,
} = useUsers()

const user = ref<UserWithStats | null>(null)
const isLoading = ref(true)
const isTogglingAdmin = ref(false)
const isTogglingBan = ref(false)
const isDeleting = ref(false)
const isLoggingOut = ref(false)

// Ban modal local state
const showBanModal = ref(false)
const banReason = ref('')

// Delete modal state
const showDeleteConfirm = ref(false)

// Logout modal state
const showLogoutConfirm = ref(false)

async function loadUser() {
  isLoading.value = true
  const data = await fetchUserById(userId)
  if (data) {
    user.value = data
  }
  isLoading.value = false
}

onMounted(() => {
  loadUser()
})

async function handleToggleAdmin() {
  if (!user.value) return
  isTogglingAdmin.value = true
  await toggleAdminStatus(user.value.id)
  await loadUser() // Refresh local data
  isTogglingAdmin.value = false
}

function confirmBan() {
  showBanModal.value = true
}

async function handleBan() {
  if (!user.value) return
  isTogglingBan.value = true
  const isBanningAction = !user.value.isBanned
  await toggleBan(user.value.id, isBanningAction, banReason.value)
  await loadUser() // Refresh local data
  isTogglingBan.value = false
  showBanModal.value = false
}

function confirmDelete() {
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (!user.value) return
  isDeleting.value = true
  const success = await deleteUserPermanently(user.value.id)
  isDeleting.value = false
  showDeleteConfirm.value = false
  
  if (success) {
    router.push('/admin')
  }
}

function confirmLogout() {
  showLogoutConfirm.value = true
}

async function handleLogout() {
  if (!user.value) return

  isLoggingOut.value = true
  await logoutUser(user.value.id)
  isLoggingOut.value = false
  showLogoutConfirm.value = false
}

const authStore = useAuthStore()
const { user: currentUser } = storeToRefs(authStore)
const isSelf = computed(() => user.value?.id === currentUser.value?.id)

const formattedPreferences = computed(() => {
    if (!user.value?.preferences) return null
    try {
        return yaml.dump(user.value.preferences)
    } catch {
        return JSON.stringify(user.value.preferences, null, 2)
    }
})

</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <UButton
          to="/admin"
          icon="i-heroicons-arrow-left"
          variant="ghost"
          color="neutral"
        >
          {{ t('common.back') }}
        </UButton>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('admin.userDetails', 'User Details') }}
        </h1>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="!user" class="app-card p-12 text-center">
      <p class="text-gray-500">{{ t('admin.userNotFound', 'User not found') }}</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Main Info Card -->
      <div class="app-card p-6">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div class="flex items-start gap-4 flex-1">
             <UAvatar
                :src="user.avatarUrl || undefined"
                :alt="user.fullName || user.telegramUsername || undefined"
                size="3xl"
                class="ring-4 ring-white dark:ring-gray-900"
            />
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ user.fullName || '-' }}
                </h2>
                <UIcon v-if="user.isAdmin" name="i-heroicons-shield-check" class="w-5 h-5 text-primary" v-tooltip="t('user.isAdmin')" />
              </div>
              <p 
                class="text-lg font-medium"
                :class="[isSelf ? 'text-green-500' : 'text-gray-500']"
              >
                {{ user.telegramUsername ? `@${user.telegramUsername}` : `#${user.telegramId}` }}
              </p>
              
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                <div class="flex items-center gap-2 text-gray-500">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  <span>{{ t('user.createdAt') }}: <b>{{ user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' }}</b></span>
                </div>
                <div class="flex items-center gap-2 text-gray-500">
                  <UIcon name="i-heroicons-identification" class="w-4 h-4" />
                  <span>ID: <b>{{ user.telegramId }}</b></span>
                </div>
                <div class="flex items-center gap-2 text-gray-500">
                    <UIcon name="i-heroicons-language" class="w-4 h-4" />
                    <span>Lang: <b>{{ user.language || '-' }}</b></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2 justify-end">
             <UButton
              v-if="!isSelf"
              :color="user.isAdmin ? 'warning' : 'success'"
              :variant="user.isAdmin ? 'outline' : 'solid'"
              :icon="user.isAdmin ? 'i-heroicons-user-minus' : 'i-heroicons-shield-check'"
              :loading="isTogglingAdmin"
              @click="handleToggleAdmin"
              size="sm"
            >
              {{ user.isAdmin ? t('admin.revokeAdmin') : t('admin.grantAdmin') }}
            </UButton>

            <UButton
              v-if="!isSelf"
              :color="user.isBanned ? 'success' : 'error'"
              :variant="user.isBanned ? 'outline' : 'solid'"
              :icon="user.isBanned ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              :loading="isTogglingBan"
              @click="confirmBan"
              size="sm"
            >
              {{ user.isBanned ? t('admin.unban') : t('admin.ban') }}
            </UButton>
            
            <UDropdownMenu
             :items="[
                 [{
                     label: t('auth.logout', 'Logout user'),
                     icon: 'i-heroicons-arrow-right-start-on-rectangle',
                     onSelect: confirmLogout
                 }],
                 [{
                     label: t('common.delete', 'Delete permanently'),
                     icon: 'i-heroicons-trash',
                     class: 'text-red-500 dark:text-red-400',
                     onSelect: confirmDelete
                 }]
             ]"
            >
                <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-ellipsis-vertical"
                />
            </UDropdownMenu>
          </div>
        </div>

        <div v-if="user.isBanned && user.banReason" class="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg">
           <p class="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">{{ t('admin.banReason') }}:</p>
           <p class="text-sm text-red-600 dark:text-red-300">{{ user.banReason }}</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="app-card p-6 flex items-center gap-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-blue-600 dark:text-blue-400">
            <UIcon name="i-heroicons-briefcase" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('project.personalProjects', 'Private projects') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ user.projectsCount || 0 }}</p>
          </div>
        </div>

        <div class="app-card p-6 flex items-center gap-4">
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-green-600 dark:text-green-400">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('publication.personalPublications', 'Private publications') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ user.publicationsCount || 0 }}</p>
          </div>
        </div>
      </div>
      
      <!-- Preferences -->
      <div v-if="user.preferences" class="app-card p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-gray-500" />
              {{ t('user.preferences', 'Preferences') }}
          </h3>
          <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{{ formattedPreferences }}</pre>
          </div>
      </div>
    </div>

    <!-- Ban user modal -->
    <UiAppModal
      v-if="showBanModal"
      v-model:open="showBanModal"
      :title="user?.isBanned ? t('admin.unbanUser', 'Unban User') : t('admin.banUser', 'Ban User')"
    >
      <div v-if="!user?.isBanned" class="mb-4">
         <UTextarea
           v-model="banReason"
           :placeholder="t('admin.banReason', 'Reason for blocking (optional)...')"
           :rows="FORM_STYLES.textareaRows"
           autoresize
         />
      </div>

      <p class="text-gray-600 dark:text-gray-400">
        {{
          user?.isBanned
            ? t('admin.unbanConfirm', 'Are you sure you want to unban this user?')
            : t('admin.banConfirm', 'Are you sure you want to ban this user?')
        }}
      </p>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="isTogglingBan"
          @click="showBanModal = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          :color="user?.isBanned ? 'primary' : 'error'"
          :loading="isTogglingBan"
          @click="handleBan"
        >
          {{ user?.isBanned ? t('admin.unban') : t('admin.ban') }}
        </UButton>
      </template>
    </UiAppModal>
    
    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
        v-if="showDeleteConfirm"
        v-model:open="showDeleteConfirm"
        :title="t('admin.deleteUserTitle', 'Delete user permanently?')"
        :description="t('admin.deleteUserConfirm', 'This action cannot be undone. Checks related to projects and content will be removed.')"
        :confirm-text="t('common.delete')"
        color="error"
        icon="i-heroicons-exclamation-triangle"
        :loading="isDeleting"
        @confirm="handleDelete"
    />

    <UiConfirmModal
        v-if="showLogoutConfirm"
        v-model:open="showLogoutConfirm"
        :title="t('admin.logoutUserTitle', 'Logout user?')"
        :description="t('admin.logoutUserConfirm', 'User will be logged out from all active sessions.')"
        :confirm-text="t('auth.logout', 'Logout')"
        color="warning"
        icon="i-heroicons-arrow-right-start-on-rectangle"
        :loading="isLoggingOut"
        @confirm="handleLogout"
    />
  </div>
</template>
