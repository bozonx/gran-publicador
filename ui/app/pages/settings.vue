<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('settings.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.account') }}
      </p>
    </div>

    <SettingsProfile />
    <SettingsLanguage />
    <SettingsTheme />
    <SettingsApiTokens />
  </div>
</template>

