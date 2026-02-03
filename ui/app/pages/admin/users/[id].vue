<script setup lang="ts">
import type { UserWithStats } from '~/stores/users'
import { FORM_STYLES } from '~/utils/design-tokens'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { t, d } = useI18n()
const route = useRoute()
const userId = route.params.id as string
const toast = useToast()

const {
  fetchUserById,
  toggleAdminStatus,
  toggleBan,
  getUserDisplayName,
} = useUsers()

const user = ref<UserWithStats | null>(null)
const isLoading = ref(true)
const isTogglingAdmin = ref(false)
const isTogglingBan = ref(false)

// Ban modal local state
const showBanModal = ref(false)
const banReason = ref('')

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

const authStore = useAuthStore()
const { user: currentUser } = storeToRefs(authStore)
const isSelf = computed(() => user.value?.id === currentUser.value?.id)

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
          <div class="flex items-start gap-4">
            <div class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-xl">
              <UIcon name="i-heroicons-user" class="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
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
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div class="flex items-center gap-2 text-gray-500">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  <span>{{ t('user.createdAt') }}: <b>{{ user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' }}</b></span>
                </div>
                <div class="flex items-center gap-2 text-gray-500">
                  <UIcon name="i-heroicons-identification" class="w-4 h-4" />
                  <span>ID: <b>{{ user.telegramId }}</b></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-3">
             <UButton
              v-if="!isSelf"
              :color="user.isAdmin ? 'warning' : 'success'"
              :variant="user.isAdmin ? 'outline' : 'solid'"
              :icon="user.isAdmin ? 'i-heroicons-user-minus' : 'i-heroicons-shield-check'"
              :loading="isTogglingAdmin"
              @click="handleToggleAdmin"
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
            >
              {{ user.isBanned ? t('admin.unban') : t('admin.ban') }}
            </UButton>
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
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('project.titlePlural') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ user.projectsCount || 0 }}</p>
          </div>
        </div>

        <div class="app-card p-6 flex items-center gap-4">
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-green-600 dark:text-green-400">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('post.titlePlural') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ user.publicationsCount || 0 }}</p>
          </div>
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
  </div>
</template>
