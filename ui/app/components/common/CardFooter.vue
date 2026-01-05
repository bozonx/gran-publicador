<script setup lang="ts">
interface Props {
  /** Whether to add top border */
  withBorder?: boolean
  /** Spacing variant */
  spacing?: 'compact' | 'normal' | 'spacious'
}

const props = withDefaults(defineProps<Props>(), {
  withBorder: true,
  spacing: 'normal',
})

const spacingClasses = computed(() => {
  switch (props.spacing) {
    case 'compact':
      return 'space-y-1'
    case 'spacious':
      return 'space-y-3'
    case 'normal':
    default:
      return 'space-y-2'
  }
})
</script>

<template>
  <div 
    class="mt-auto pt-3"
    :class="[
      spacingClasses,
      { 'border-t border-gray-100 dark:border-gray-700/50': withBorder }
    ]"
  >
    <slot />
  </div>
</template>
