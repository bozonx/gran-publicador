<script setup lang="ts">
const colorMode = useColorMode()
const { t } = useI18n()
</script>

<template>
  <UiAppCard :title="t('settings.theme')" title-class="text-lg font-medium text-gray-900 dark:text-white">

    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {{ t('settings.themeDescription', 'Choose your preferred theme interface aesthetics.') }}
    </p>
    
    <ClientOnly>
      <UiAppButtonGroup
        :model-value="colorMode.preference"
        :options="[
          { value: 'system', label: t('settings.systemTheme', 'system'), icon: 'i-heroicons-computer-desktop' },
          { value: 'light', label: t('settings.lightTheme', 'light'), icon: 'i-heroicons-sun' },
          { value: 'dark', label: t('settings.darkTheme', 'dark'), icon: 'i-heroicons-moon' }
        ]"
        size="lg"
        variant="outline"
        active-variant="solid"
        @update:model-value="(val: any) => colorMode.preference = val"
      />
      
      <template #fallback>
        <div class="flex flex-wrap gap-3">
          <USkeleton class="h-10 w-24" />
          <USkeleton class="h-10 w-24" />
          <USkeleton class="h-10 w-24" />
        </div>
      </template>
    </ClientOnly>

    <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">
      {{
        t(
          'settings.themeNote',
          'System theme will automatically adapt to your device settings.'
        )
      }}
    </p>
  </UiAppCard>
</template>
