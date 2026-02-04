<script setup lang="ts">
const props = withDefaults(defineProps<{
  // Size of the spinner
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  // Color variant
  color?: 'gray' | 'primary'
  // Show text label
  label?: string
  // Center the spinner
  centered?: boolean
}>(), {
  size: 'md',
  color: 'gray',
  centered: false
})

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12'
}

const colorClasses = {
  gray: 'text-gray-400',
  primary: 'text-primary-500'
}

const iconClass = computed(() => {
  return `${sizeClasses[props.size]} ${colorClasses[props.color]} animate-spin`
})
</script>

<template>
  <div 
    :class="{ 
      'flex items-center justify-center': centered,
      'inline-flex items-center gap-2': !centered && label,
      'inline-block': !centered && !label
    }"
  >
    <UIcon name="i-heroicons-arrow-path" :class="iconClass" />
    <span v-if="label" class="text-gray-500 dark:text-gray-400">{{ label }}</span>
  </div>
</template>
