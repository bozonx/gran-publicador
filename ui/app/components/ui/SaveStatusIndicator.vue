<script setup lang="ts">
import type { SaveStatus } from '~/composables/useAutosave'

const props = defineProps<{
  status: SaveStatus
  visible: boolean
  error?: string | null
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2 text-sm h-9">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-250 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
      mode="out-in"
    >
      <div v-if="visible" :key="status" class="flex items-center gap-2">
        <template v-if="status === 'unsaved'">
          <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-amber-500" />
          <span class="text-gray-500 dark:text-gray-400 font-medium">
            {{ t('common.unsavedChanges') }}
          </span>
        </template>

        <template v-else-if="status === 'saved'">
          <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500" />
          <span class="text-gray-500 dark:text-gray-400 font-medium">
            {{ t('common.saved') }}
          </span>
        </template>
        
        <template v-else-if="status === 'saving'">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-primary-500 animate-spin" />
          <span class="text-gray-500 dark:text-gray-400 font-medium">
            {{ t('common.saving') }}
          </span>
        </template>
        
        <template v-else-if="status === 'invalid'">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-amber-500" />
          <span class="text-amber-600 dark:text-amber-400 font-medium">
            {{ t('validation.invalidForAutosave') }}
          </span>
        </template>

        <template v-else-if="status === 'error'">
          <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 text-red-500" />
          <UTooltip :text="error || t('common.saveError')">
            <span class="text-red-500 font-medium cursor-help">
              {{ t('common.saveError') }}
            </span>
          </UTooltip>
        </template>
      </div>
    </Transition>
  </div>
</template>
