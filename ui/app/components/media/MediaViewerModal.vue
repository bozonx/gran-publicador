<script setup lang="ts">
interface Props {
  title?: string
  counterText?: string
  preventClose?: boolean
  ui?: {
    content?: string
    body?: string
    header?: string
    footer?: string
    [key: string]: unknown
  }
}

const props = withDefaults(defineProps<Props>(), {
  preventClose: false,
  ui: () => ({})
})

const isOpen = defineModel<boolean>('open', { default: false })

interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const mergedUi = computed(() => {
  const content = props.ui?.content || 'w-[92vw] sm:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]'
  const body = props.ui?.body || 'p-0'

  return {
    ...props.ui,
    content,
    body
  }
})

const { t } = useI18n()

function handleClose() {
  isOpen.value = false
  emit('close')
}

</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="props.title || t('media.preview', 'Media Preview')"
    :close-button="false"
    :prevent-close="props.preventClose"
    :ui="mergedUi"
  >
    <template #header>
      <div class="flex items-center justify-between gap-4 w-full">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0">
          {{ props.title || t('media.preview', 'Media Preview') }}
        </h2>
        <div class="sr-only">
          {{ t('media.preview', 'Media Preview') }}
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="props.counterText" class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {{ props.counterText }}
          </span>
          <slot name="header-right" />
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="handleClose"
          />
        </div>
      </div>
    </template>

    <div class="w-full">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UiAppModal>
</template>
