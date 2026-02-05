<script setup lang="ts">
interface Props {
  text: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top'
})
</script>

<template>
  <UTooltip :text="text" :popper="{ placement }" class="inline-flex items-center align-middle ml-1">
    <UIcon
      name="i-heroicons-information-circle"
      class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors"
    />
  </UTooltip>
</template>
