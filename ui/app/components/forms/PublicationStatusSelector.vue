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
    
    <CommonInfoTooltip :text="t('publication.changeStatusWarningReset')" />
  </div>
</template>
