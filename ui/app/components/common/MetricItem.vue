<script setup lang="ts">
interface Props {
  /** Icon name for the metric */
  icon: string
  /** Label for the metric */
  label: string
  /** Metric value */
  value: string | number
  /** Optional color variant */
  variant?: 'default' | 'error' | 'warning' | 'success'
  /** Whether to make the value bold */
  bold?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  bold: false,
})

const colorClasses = computed(() => {
  switch (props.variant) {
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-orange-600 dark:text-orange-400'
    case 'success':
      return 'text-green-600 dark:text-green-400'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
})
</script>

<template>
  <div 
    class="flex items-center gap-1.5"
    :class="[colorClasses, { 'font-bold': bold, 'font-normal': !bold }]"
    :title="label"
  >
    <UIcon :name="icon" class="w-4 h-4 shrink-0" />
    <span>{{ value }}</span>
  </div>
</template>
