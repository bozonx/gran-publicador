<script setup lang="ts">
interface Props {
  count?: number | string | null
  title?: string
  color?: 'primary' | 'neutral' | 'warning' | 'success' | 'error' | 'secondary' | 'info'
  variant?: 'subtle' | 'solid' | 'outline' | 'soft'
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  title: undefined,
  color: 'primary',
  variant: 'subtle'
})

const displayCount = computed(() => props.count || 0)
const isSingleDigit = computed(() => String(displayCount.value).length === 1)
</script>

<template>
  <UBadge
    :variant="variant" 
    :color="color"
    :title="title"
    class="font-bold transition-all duration-200"
    :class="[
      'rounded-full', 
      isSingleDigit 
        ? 'w-6 h-6 flex items-center justify-center p-0' 
        : 'px-2',
      color === 'primary' && variant === 'subtle' ? 'border border-primary-200 dark:border-primary-800' : ''
    ]"
 
  >
    {{ displayCount }}
  </UBadge>
</template>
