<script setup lang="ts">
import type { ViewMode } from '~/composables/useViewMode'

const props = defineProps<{
  modelValue: ViewMode
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ViewMode): void
}>()

const { t } = useI18n()

function setMode(mode: ViewMode) {
  emit('update:modelValue', mode)
}
</script>

<template>
  <div class="flex -space-x-px">
    <UButton
      :color="modelValue === 'list' ? 'primary' : 'neutral'"
      :variant="modelValue === 'list' ? 'solid' : 'outline'"
      icon="i-heroicons-list-bullet"
      size="sm"
      class="rounded-r-none"
      :title="t('common.viewMode.list')"
      @click="setMode('list')"
    />
    <UButton
      :color="modelValue === 'cards' ? 'primary' : 'neutral'"
      :variant="modelValue === 'cards' ? 'solid' : 'outline'"
      icon="i-heroicons-squares-2x2"
      size="sm"
      class="rounded-l-none"
      :title="t('common.viewMode.cards')"
      @click="setMode('cards')"
    />
  </div>
</template>
