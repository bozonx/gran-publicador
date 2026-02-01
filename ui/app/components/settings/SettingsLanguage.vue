<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { user, refreshUser } = useAuth()
const api = useApi()

/**
 * Change content language
 */
async function changeContentLanguage(newLocale: string) {
  if (!newLocale) return
  await updateProfile({ language: newLocale })
}

/**
 * Change interface language
 */
async function changeUiLanguage(newLocale: string) {
  if (!newLocale) return
  await updateProfile({ uiLanguage: newLocale })
}

async function updateProfile(data: any) {
  try {
    await api.patch('/users/me', data)
    await refreshUser()
    toast.add({
      title: t('common.success'),
      description: t('settings.languageChanged', 'Language changed'),
      color: 'success',
    })
  } catch (err) {
    console.error('Failed to update language setting:', err)
    toast.add({
      title: t('common.error'),
      description: t('settings.syncError', 'Failed to save settings'),
      color: 'error',
    })
  }
}
</script>

<template>
  <UiAppCard :title="t('settings.language')" title-class="text-lg font-medium text-gray-900 dark:text-white">
    <div class="space-y-6">
      <!-- Interface Language -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('settings.uiLanguage', 'Interface Language') }}
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {{ t('settings.uiLanguageHelp', 'Language of buttons, menus and notifications.') }}
        </p>
        <div class="max-w-xs">
          <CommonLanguageSelect
            :model-value="user?.uiLanguage"
            mode="ui"
            @update:model-value="changeUiLanguage"
          />
        </div>
      </div>

      <!-- Content Language -->
      <div>
        <div class="flex items-center gap-1 mb-1">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.contentLanguage', 'Content Language') }}
          </label>
          <UTooltip :text="t('settings.contentLanguageDetails')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400" />
          </UTooltip>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {{ t('settings.contentLanguageHelp', 'Preferred language for news, search and publications.') }}
        </p>
        <div class="max-w-xs">
          <CommonLanguageSelect
            :model-value="user?.language"
            mode="all"
            searchable
            @update:model-value="changeContentLanguage"
          />
        </div>
      </div>
    </div>
  </UiAppCard>
</template>
