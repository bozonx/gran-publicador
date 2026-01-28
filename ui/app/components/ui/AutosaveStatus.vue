<script setup lang="ts">
import type { SaveStatus } from '~/composables/useAutosave'

defineProps<{
  status: SaveStatus
  lastSavedAt?: Date | null
  error?: string | null
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2 text-sm h-9">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
      mode="out-in"
    >
      <div v-if="status === 'saved'" key="saved" class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500" />
        <span>{{ t('common.saved') || 'Сохранено' }}</span>
      </div>
      <div v-else-if="status === 'saving'" key="saving" class="flex items-center gap-2 text-blue-500">
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
        <span>{{ t('common.saving') || 'Сохранение...' }}</span>
      </div>
      <div v-else-if="status === 'error'" key="error" class="flex items-center gap-2 text-red-500">
        <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
        <UTooltip :text="error || t('common.saveError') || 'Ошибка сохранения'">
          <span class="cursor-help font-medium">{{ t('common.saveError') || 'Ошибка сохранения' }}</span>
        </UTooltip>
      </div>
    </Transition>
  </div>
</template>
