<script setup lang="ts">
interface Props {
  loading?: boolean
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  label: undefined,
})

const { t } = useI18n()

type ButtonState = 'normal' | 'loading' | 'success' | 'error'
const state = ref<ButtonState>('normal')
const timeoutId = ref<NodeJS.Timeout | null>(null)

// Watch loading prop to update state
watch(() => props.loading, (isLoading) => {
  if (isLoading) {
    state.value = 'loading'
  } else if (state.value === 'loading') {
    state.value = 'normal'
  }
})

/**
 * Show success state for 3 seconds
 */
function showSuccess() {
  clearTimeout()
  state.value = 'success'
  timeoutId.value = setTimeout(() => {
    state.value = 'normal'
  }, 3000)
}

/**
 * Show error state for 3 seconds
 */
function showError() {
  clearTimeout()
  state.value = 'error'
  timeoutId.value = setTimeout(() => {
    state.value = 'normal'
  }, 3000)
}

function clearTimeout() {
  if (timeoutId.value) {
    globalThis.clearTimeout(timeoutId.value)
    timeoutId.value = null
  }
}

// Cleanup on unmount
onUnmounted(() => {
  clearTimeout()
})

// Expose methods to parent
defineExpose({
  showSuccess,
  showError,
})

const buttonClasses = computed(() => {
  const base = 'relative transition-all duration-300'
  
  switch (state.value) {
    case 'success':
      return `${base} !bg-green-500 dark:!bg-green-600 !text-white shadow-lg shadow-green-500/50 dark:shadow-green-600/50`
    case 'error':
      return `${base} !bg-orange-500 dark:!bg-orange-600 !text-white shadow-lg shadow-orange-500/50 dark:shadow-orange-600/50`
    default:
      return base
  }
})

const iconName = computed(() => {
  switch (state.value) {
    case 'success':
      return 'i-heroicons-check'
    case 'error':
      return 'i-heroicons-exclamation-circle'
    default:
      return undefined
  }
})

const isDisabled = computed(() => {
  return props.disabled || state.value === 'success' || state.value === 'error'
})

const displayLabel = computed(() => {
  return props.label || t('common.save')
})
</script>

<template>
  <UButton
    type="submit"
    color="primary"
    :loading="state === 'loading'"
    :disabled="isDisabled"
    :class="buttonClasses"
  >
    <template v-if="state === 'success' || state === 'error'" #leading>
      <UIcon 
        :name="iconName!" 
        class="w-5 h-5 animate-icon-in"
      />
    </template>
    {{ displayLabel }}
  </UButton>
</template>

<style scoped>
.animate-icon-in {
  animation: iconRotateIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes iconRotateIn {
  0% {
    transform: rotateZ(-180deg) scale(0);
    opacity: 0;
  }
  100% {
    transform: rotateZ(0) scale(1);
    opacity: 1;
  }
}
</style>
