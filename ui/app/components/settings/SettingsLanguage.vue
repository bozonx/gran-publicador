<script setup lang="ts">
const { t, locale, setLocale, availableLocales } = useI18n()
const toast = useToast()

// Language options
const languageOptions = computed(() =>
  availableLocales.map((loc: string) => ({
    value: loc,
    label: loc === 'ru-RU' ? 'Russian' : 'English',
  }))
)

const { refreshUser } = useAuth()
const api = useApi()

/**
 * Change language
 */
async function changeLanguage(newLocale: string) {
  try {
    // Update local i18n
    setLocale(newLocale as any)
    
    // Save to DB
    await api.patch('/users/me', { language: newLocale })
    
    // Refresh user in store
    await refreshUser()

    toast.add({
      title: t('common.success'),
      description: t('settings.languageChanged', 'Language changed'),
      color: 'success',
    })
  } catch (err) {
    console.error('Failed to change language:', err)
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
    
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {{ t('settings.selectLanguage', 'Select your preferred language for the interface') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <UButton
        v-for="lang in languageOptions"
        :key="lang.value"
        :color="locale === lang.value ? 'primary' : 'neutral'"
        :variant="locale === lang.value ? 'solid' : 'outline'"
        size="lg"
        @click="changeLanguage(lang.value)"
      >
        {{ lang.label }}
      </UButton>
    </div>
  </UiAppCard>
</template>
