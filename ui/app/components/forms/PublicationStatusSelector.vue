<script setup lang="ts">
import type { PublicationStatus } from '~/types/posts'

interface Props {
  modelValue: PublicationStatus
  disabled?: boolean
  isContentMissing?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const options = computed(() => {
    return [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') },
        { value: 'SCHEDULED', label: t('publicationStatus.scheduled') }
    ]
})

function selectStatus(status: string) {
  if (status === 'READY' && props.isContentMissing && props.modelValue === 'DRAFT') {
    return
  }
  emit('update:modelValue', status as PublicationStatus)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UiAppButtonGroup
      :model-value="modelValue"
      :options="options.map(opt => ({
        ...opt,
        disabled: disabled || (opt.value === 'READY' && isContentMissing && modelValue === 'DRAFT')
      }))"
      @update:model-value="selectStatus"
    />
    
    <UPopover :popper="{ placement: 'top' }">
      <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
      <template #content>
        <div class="p-3 max-w-xs text-xs whitespace-pre-line">
          {{ t('publication.changeStatusWarningReset') }}
        </div>
      </template>
    </UPopover>
  </div>
</template>
