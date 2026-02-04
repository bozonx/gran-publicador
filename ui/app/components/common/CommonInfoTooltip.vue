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
  <UPopover :popper="{ placement }">
    <UIcon
      name="i-heroicons-information-circle"
      class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors"
    />
    <template #content>
      <div class="p-3 max-w-xs text-xs whitespace-pre-line">
        {{ text }}
      </div>
    </template>
  </UPopover>
</template>
