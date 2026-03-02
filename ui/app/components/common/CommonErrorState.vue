<template>
  <div 
    class="flex flex-col items-center justify-center p-8 text-center app-card bg-error-50 dark:bg-error-950/20 border-error-200 dark:border-error-800"
    :class="{ 'min-h-[300px]': !compact, 'p-4': compact }"
  >
    <div 
      class="mb-4 p-3 rounded-full bg-error-100 dark:bg-error-900/50 text-error-600 dark:text-error-400"
      :class="{ 'p-2 mb-2': compact }"
    >
      <UIcon name="i-heroicons-exclamation-triangle" :class="compact ? 'size-6' : 'size-10'" />
    </div>

    <h3 
      class="font-semibold text-gray-900 dark:text-white"
      :class="compact ? 'text-sm' : 'text-lg mb-1'"
    >
      {{ title || t('common.errorOccurred') }}
    </h3>

    <p 
      v-if="error" 
      class="text-gray-600 dark:text-gray-400 mb-6 max-w-md"
      :class="compact ? 'text-xs mb-3 text-balance' : 'text-base'"
    >
      {{ errorMsg }}
    </p>

    <div v-if="showRetry" class="mt-2">
      <UButton
        icon="i-heroicons-arrow-path"
        :label="t('common.retry')"
        color="error"
        :variant="compact ? 'ghost' : 'solid'"
        :size="compact ? 'xs' : 'md'"
        :loading="loading"
        @click="$emit('retry')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface Props {
  error?: any
  title?: string
  showRetry?: boolean
  loading?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: true,
  loading: false,
  compact: false
})

defineEmits<{
  retry: []
}>()

const errorMsg = computed(() => {
  if (typeof props.error === 'string') return props.error
  if (props.error?.message) return props.error.message
  return t('common.unexpectedError')
})
</script>
