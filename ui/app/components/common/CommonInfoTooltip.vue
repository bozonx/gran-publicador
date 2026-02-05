<script setup lang="ts">
interface Props {
  text: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top'
})

const isOpen = ref(false)
</script>

<template>
  <UPopover v-model:open="isOpen" mode="click" :popper="{ placement }" class="inline-flex items-center align-middle">
    <button
      type="button"
      class="inline-flex items-center align-middle cursor-help"
      @mousedown.stop
      @click.stop
    >
      <UIcon
        name="i-heroicons-information-circle"
        class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      />
    </button>
    <template #content>
      <div class="p-3 max-w-xs text-xs whitespace-pre-line">
        {{ text }}
      </div>
    </template>
  </UPopover>
</template>
