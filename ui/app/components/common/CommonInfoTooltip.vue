<script setup lang="ts">
interface Props {
  text: string
}

defineProps<Props>()
</script>

<template>
  <UTooltip :text="text">
    <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 hover:text-gray-500 cursor-help" />
  </UTooltip>
</template>
