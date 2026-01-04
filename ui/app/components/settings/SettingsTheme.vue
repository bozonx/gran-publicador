<script setup lang="ts">
const colorMode = useColorMode()
const { t } = useI18n()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('settings.theme') }}
      </h2>
    </template>

    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {{ t('settings.themeDescription', 'Choose your preferred theme interface aesthetics.') }}
    </p>
    
    <ClientOnly>
      <div class="flex flex-wrap gap-3">
        <UButton
          v-for="theme in ['system', 'light', 'dark']"
          :key="theme"
          :color="colorMode.preference === theme ? 'primary' : 'neutral'"
          :variant="colorMode.preference === theme ? 'solid' : 'outline'"
          size="lg"
          :icon="
            theme === 'system' 
              ? 'i-heroicons-computer-desktop' 
              : theme === 'light' 
                ? 'i-heroicons-sun' 
                : 'i-heroicons-moon'
          "
          @click="colorMode.preference = theme"
        >
          <span class="capitalize">{{ t(`settings.${theme}Theme`, theme) }}</span>
        </UButton>
      </div>
      
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
  </UCard>
</template>
