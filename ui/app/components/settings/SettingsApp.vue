<script setup lang="ts">
const { t } = useI18n()
const { user, refreshUser } = useAuth()
const api = useApi()
const toast = useToast()

const videoAutoplay = ref(user.value?.videoAutoplay ?? true)

watch(() => user.value?.videoAutoplay, (newVal) => {
  if (newVal !== undefined) {
    videoAutoplay.value = newVal
  }
})

async function updatePreference(key: string, value: any) {
  try {
    await api.patch('/users/me', { [key]: value })
    await refreshUser()
    toast.add({
      title: t('common.success'),
      description: t('settings.preferencesUpdated', 'Preferences updated'),
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (err) {
    console.error('Failed to update preference:', err)
    toast.add({
      title: t('common.error'),
      description: t('settings.syncError', 'Failed to save settings'),
      color: 'error',
    })
    // Revert local state on error
    if (key === 'videoAutoplay') {
      videoAutoplay.value = user.value?.videoAutoplay ?? true
    }
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('settings.appSettings', 'App Settings') }}</h3>
    </template>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.videoAutoplay', 'Auto-play videos') }}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('settings.videoAutoplayHelp', 'Automatically start playing videos when opening media preview') }}
          </span>
        </div>
        <USwitch
          v-model="videoAutoplay"
          @update:model-value="(val) => updatePreference('videoAutoplay', val)"
        />
      </div>
    </div>
  </UCard>
</template>
