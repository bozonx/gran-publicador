<template>
  <div
    class="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6"
  >
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-yellow-200 dark:bg-yellow-800 rounded-full">
          <UIcon
            name="i-heroicons-archive-box"
            class="w-5 h-5 text-yellow-600 dark:text-yellow-400"
          />
        </div>
        <div>
          <p class="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
            {{ title }}
          </p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
            {{ description }}
          </p>
        </div>
      </div>
      
      <!-- Use UiArchiveButton if entity props provided -->
      <UiArchiveButton
        v-if="entityType && entityId"
        :entity-type="entityType"
        :entity-id="entityId"
        :is-archived="true"
        variant="solid"
        size="sm"
        @toggle="$emit('restore')"
      />

      <!-- Fallback to manual button -->
      <UButton
        v-else-if="buttonLabel && buttonAction"
        size="sm"
        color="warning"
        variant="solid"
        icon="i-heroicons-archive-box-arrow-down"
        :loading="isLoading"
        @click="buttonAction"
      >
        {{ buttonLabel }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArchiveEntityType } from '~/types/archive.types'

// Use a type definition or 'any' if import fails, but Nuxt usually handles imports fine.
// To be safe in simple script setup:

defineProps<{
  title: string
  description: string
  
  // New props for automatic handling
  entityType?: ArchiveEntityType
  entityId?: string
  
  // Legacy props
  buttonLabel?: string
  buttonAction?: () => void
  isLoading?: boolean
}>()

defineEmits<{
  restore: []
}>()
</script>
