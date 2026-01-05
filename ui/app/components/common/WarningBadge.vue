<script setup lang="ts">
interface Props {
  /** Icon name */
  icon: string
  /** Warning text */
  text: string
  /** Color variant */
  variant?: 'warning' | 'error' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'warning',
})

const colorClasses = computed(() => {
  switch (props.variant) {
    case 'error':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100/50 dark:border-red-800/30'
    case 'info':
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100/50 dark:border-blue-800/30'
    case 'warning':
    default:
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100/50 dark:border-amber-800/30'
  }
})
</script>

<template>
  <div 
    class="flex items-center gap-1.5 text-[10px] sm:text-xs leading-none font-semibold px-2 py-1.5 rounded-md w-fit border"
    :class="colorClasses"
  >
    <UIcon :name="icon" class="w-3.5 h-3.5 shrink-0" />
    <span class="truncate">{{ text }}</span>
  </div>
</template>
