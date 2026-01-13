<script setup lang="ts">
/**
 * Unified Modal Component
 * 
 * Provides a consistent layout with header, body, and footer across the application.
 * Wraps @nuxt/ui's UModal and provides standard padding and styling.
 */

interface Props {
  /** Title of the modal */
  title?: string
  /** Optional description text below the title */
  description?: string
  /** Whether to show the close button in the top right corner */
  closeButton?: boolean
  /** Whether to prevent closing when clicking outside or pressing ESC */
  preventClose?: boolean
  /** Nuxt UI modal configuration */
  ui?: any
}

const props = withDefaults(defineProps<Props>(), {
  closeButton: true,
  preventClose: false,
  ui: () => ({})
})

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

function handleClose() {
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :prevent-close="preventClose"
    :ui="ui"
  >
    <div 
      class="bg-white dark:bg-gray-900 shadow-xl overflow-hidden sm:rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] min-h-0 w-full sm:max-w-lg mx-auto"
      :class="ui?.content"
    >
      <!-- Header -->
      <div v-if="title || $slots.header || closeButton" class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div class="min-w-0 flex-1">
          <slot name="header">
            <h3 v-if="title" class="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {{ title }}
            </h3>
            <p v-if="description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ description }}
            </p>
          </slot>
        </div>
        
        <UButton
          v-if="closeButton"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          class="-mr-2 ml-4"
          size="md"
          @click="handleClose"
          :aria-label="t('common.close')"
        />
      </div>

      <!-- Body -->
      <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="$slots.footer" class="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
        <slot name="footer" />
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-200 dark:bg-gray-700 rounded-full;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-300 dark:bg-gray-600;
}
</style>
