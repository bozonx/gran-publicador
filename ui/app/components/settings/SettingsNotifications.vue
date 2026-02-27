<script setup lang="ts">
import type { NotificationPreferences, NotificationType } from '~/types/notifications'

const { t } = useI18n()
const api = useApi()
const toast = useToast()

const isLoading = ref(true)
const isSaving = ref(false)
const preferences = ref<NotificationPreferences | null>(null)

// Notification types with their labels and descriptions
const notificationTypes: Array<{
  key: NotificationType
  label: string
  description: string
}> = [
  {
    key: 'PUBLICATION_FAILED',
    label: t('notifications.types.publicationFailed.label', 'Publication Failed'),
    description: t(
      'notifications.types.publicationFailed.description',
      'Issues during publication (failed/partial)',
    ),
  },
  {
    key: 'PROJECT_INVITE',
    label: t('notifications.types.projectInvite.label', 'Project Invite'),
    description: t('notifications.types.projectInvite.description', 'Invitation to a project'),
  },
  {
    key: 'SYSTEM',
    label: t('notifications.types.system.label', 'System'),
    description: t('notifications.types.system.description', 'System notifications'),
  },
  {
    key: 'NEW_NEWS',
    label: t('notifications.types.newNews.label', 'New News'),
    description: t(
      'notifications.types.newNews.description',
      'New news matching project query',
    ),
  },
]

// Load notification preferences
async function loadPreferences() {
  isLoading.value = true
  try {
    const response = await api.get<NotificationPreferences>('/users/me/notification-preferences')
    preferences.value = response
  }
  catch (error) {
    console.error('Failed to load notification preferences:', error)
    toast.add({
      title: t('common.error'),
      description: t('notifications.loadError', 'Failed to load notification settings'),
      color: 'error',
    })
  }
  finally {
    isLoading.value = false
  }
}

// Update notification preferences
async function updatePreferences(type: NotificationType, channel: 'telegram', value: boolean) {
  if (!preferences.value || typeof preferences.value !== 'object')
    return

  isSaving.value = true
  try {
    // Update local state
    if (!preferences.value[type]) {
      preferences.value[type] = { internal: true, telegram: false }
    }
    preferences.value[type][channel] = value

    // Save to backend
    await api.patch('/users/me/notification-preferences', preferences.value)

    toast.add({
      title: t('common.success'),
      description: t('notifications.saveSuccess', 'Notification settings saved'),
      color: 'success',
    })
  }
  catch (error) {
    console.error('Failed to update notification preferences:', error)
    toast.add({
      title: t('common.error'),
      description: t('notifications.saveError', 'Failed to save notification settings'),
      color: 'error',
    })
    // Reload preferences to revert local changes
    await loadPreferences()
  }
  finally {
    isSaving.value = false
  }
}

// Load preferences on mount
onMounted(() => {
  loadPreferences()
})
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('notifications.settings', 'Notification Settings') }}</h3>
    </template>
    <div v-if="isLoading" class="flex justify-center py-8">
      <UiLoadingSpinner />
    </div>

    <div v-else-if="preferences" class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800">
            <th class="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('notifications.type', 'Notification Type') }}
            </th>
            <th class="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              <div class="flex flex-col items-center gap-1">
                <UIcon name="i-heroicons-bell" class="w-5 h-5" />
                <span>{{ t('notifications.internal', 'Internal') }}</span>
              </div>
            </th>
            <th class="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              <div class="flex flex-col items-center gap-1">
                <UIcon name="i-simple-icons-telegram" class="w-5 h-5" />
                <span>{{ t('notifications.telegram', 'Telegram') }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="notif in notificationTypes"
            :key="notif.key"
            class="border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/50"
          >
            <td class="py-4 px-4">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ notif.label }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ notif.description }}
                </span>
              </div>
            </td>
            <td class="py-4 px-4 text-center">
              <UTooltip
                :text="t('notifications.internalAlwaysEnabled', 'Internal notifications are always enabled')"
              >
                <UIcon
                  name="i-heroicons-check-circle-solid"
                  class="w-6 h-6 text-green-500 inline-block"
                />
              </UTooltip>
            </td>
            <td class="py-4 px-4 text-center">
              <div class="flex justify-center">
                <USwitch
                  :model-value="preferences[notif.key]?.telegram ?? false"
                  :disabled="isSaving"
                  @update:model-value="(val) => updatePreferences(notif.key, 'telegram', val)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
      {{ t('notifications.noPreferences', 'No notification preferences found') }}
    </div>
  </UCard>
</template>
