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
  ui?: {
    content?: string
    body?: string
    header?: string
    footer?: string
    [key: string]: unknown
  }
}

const props = withDefaults(defineProps<Props>(), {
  closeButton: true,
  preventClose: false,
  ui: () => ({})
})

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()


const modalUi = computed(() => {
  return props.ui || {}
})

const headerClass = computed(() => {
  return props.ui?.header
})

const bodyClass = computed(() => {
  return props.ui?.body
})

const footerClass = computed(() => {
  return props.ui?.footer
})

function handleClose(close?: () => void) {
  if (close) {
    close()
    return
  }
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="!props.preventClose"
    :title="props.title || 'Modal'"
    :description="props.description"
    :ui="modalUi"
  >
    <!-- Custom header slot if provided -->
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <!-- Body content -->
    <template #body>
      <div class="custom-scrollbar" :class="bodyClass">
        <slot />
      </div>
    </template>

    <!-- Footer content -->
    <template v-if="$slots.footer" #footer>
      <div class="flex justify-end gap-3 w-full" :class="footerClass">
        <slot name="footer" />
      </div>
    </template>
  </UModal>

</template>

<style scoped>
@reference "~/assets/css/main.css";

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
