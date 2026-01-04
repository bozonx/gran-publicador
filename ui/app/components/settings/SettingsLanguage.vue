<script setup lang="ts">
const { t, locale, setLocale, availableLocales } = useI18n()
const toast = useToast()

// Language options
const languageOptions = computed(() =>
  availableLocales.map((loc: string) => ({
    value: loc,
    label: loc === 'ru-RU' ? 'Русский' : 'English',
  }))
)

/**
 * Change language
 */
function changeLanguage(newLocale: string) {
  setLocale(newLocale as any)
  // Save to localStorage for persistence
  localStorage.setItem('locale', newLocale)
  toast.add({
    title: t('common.success'),
    description: t('settings.languageChanged', 'Language changed'),
    color: 'success',
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('settings.language') }}
      </h2>
    </template>
    
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
  </UCard>
</template>
