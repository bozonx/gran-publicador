<script setup lang="ts">
const { t } = useI18n()
const { user, displayName, authMode, refreshUser } = useAuth()
const toast = useToast()
const api = useApi()

const isSyncing = ref(false)

function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString()
}

/**
 * Sync name from Telegram or fallbacks and update in backend
 */
async function syncName() {
  isSyncing.value = true
  
  try {
    let nameToSave = ''
    let avatarToSave = ''

    // Try to get from Telegram WebApp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
    
    if (tgUser) {
      const first = tgUser.first_name || ''
      const last = tgUser.last_name || ''
      const full = [first, last].filter(Boolean).join(' ')
      if (full) {
        nameToSave = full
      } else if (tgUser.username) {
        nameToSave = tgUser.username
      }
      
      if (tgUser.photo_url) {
        avatarToSave = tgUser.photo_url
      }
    }
    
    // Fallback if no Telegram WebApp data found (dev mode or just missing)
    if (!nameToSave) {
      // Fallback to existing username
      if (user.value?.telegramUsername) {
        nameToSave = user.value.telegramUsername
      } 
      // Fallback to ID
      else if (user.value?.id) {
        nameToSave = user.value.id
      }
    }

    if (!nameToSave) {
        toast.add({
            title: t('common.warning'),
            description: t('settings.noNameFound', 'Could not determine name from Telegram'),
            color: 'warning',
        })
        return
    }

    // Call API to update profile
    await api.patch('/users/me', { 
        fullName: nameToSave,
        ...(avatarToSave && { avatarUrl: avatarToSave })
    })
    
    // Refresh user data locally
    await refreshUser()
    
    toast.add({
      title: t('common.success'),
      description: t('settings.syncedSuccess', 'Profile synced with Telegram'),
      color: 'success',
    })
  } catch (err) {
    console.error('Failed to sync name:', err)
    toast.add({
      title: t('common.error'),
      description: t('settings.syncError', 'Failed to sync name'),
      color: 'error',
    })
  } finally {
    isSyncing.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('auth.profile') }}
      </h2>
    </template>
    
    <!-- Avatar and basic info -->
    <div class="flex items-start gap-4 mb-6">
      <UAvatar
        :src="user?.avatarUrl || undefined"
        :alt="displayName"
        size="xl"
        :ui="{
          fallback:
            'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300',
        }"
      />
      <div class="flex-1 min-w-0">
        <!-- Name display & Sync Button -->
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ displayName }}
          </h3>
          
          <UTooltip :text="t('settings.syncName', 'Sync name from Telegram')">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-heroicons-arrow-path"
              :loading="isSyncing"
              @click="syncName"
            />
          </UTooltip>
        </div>

        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ user?.telegramId ? `Telegram ID: ${user.telegramId}` : '' }}
        </p>
      </div>
    </div>

    <!-- Profile details -->
    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ t('user.username') }}
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-white">
          {{ user?.telegramUsername ? `@${user.telegramUsername}` : '—' }}
        </dd>
      </div>

      <div v-if="user?.telegramId">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ t('user.telegramId') }}
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-white">
          {{ user.telegramId }}
        </dd>
      </div>
      <!-- Auth Mode -->
      <div>
        <div class="flex items-center gap-1">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ t('auth.authMode') }}
          </dt>
          <UTooltip :text="t('auth.authModeHelp')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400" />
          </UTooltip>
        </div>
        <dd class="mt-1 text-sm text-gray-900 dark:text-white capitalize">
          {{ t(`auth.${authMode}Mode`) }}
        </dd>
      </div>


      <!-- Admin Status -->
      <div v-if="user?.isAdmin">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ t('user.adminStatus') }}
        </dt>
        <dd class="mt-1">
          <UBadge
            color="primary"
            variant="solid"
            size="sm"
          >
            {{ t('user.isAdmin') }}
          </UBadge>
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ t('user.createdAt') }}
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-white">
          {{ formatDate(user?.createdAt) }}
        </dd>
      </div>
    </dl>
  </UCard>
</template>
