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
  <UiAppButtonGroup
    :model-value="modelValue"
    :options="[
      { value: 'list', icon: 'i-heroicons-list-bullet', title: t('common.viewMode.list') },
      { value: 'cards', icon: 'i-heroicons-squares-2x2', title: t('common.viewMode.cards') }
    ]"
    active-variant="solid"
    variant="outline"
    @update:model-value="setMode"
  />
</template>
