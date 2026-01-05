<script setup lang="ts">
interface Props {
  /** Icon name for the metric */
  icon: string
  /** Label for the metric */
  label: string
  /** Metric value */
  value: string | number
}

defineProps<Props>()
</script>

<template>
  <div class="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
    <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-1">
      <UIcon :name="icon" class="w-3.5 h-3.5" />
      <span>{{ label }}</span>
    </div>
    <div class="text-base font-bold text-gray-900 dark:text-white">
      {{ value }}
    </div>
  </div>
</template>
