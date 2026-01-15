<script setup lang="ts">
import type { PublicationStatus } from '~/types/posts'

interface Props {
  modelValue: PublicationStatus
  disabled?: boolean
  isContentMissing?: boolean
  isPersonal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isPersonal: false
})
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const options = computed(() => {
    const opts = [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') }
    ]
    if (!props.isPersonal) {
        opts.push({ value: 'SCHEDULED', label: t('publicationStatus.scheduled') })
    }
    return opts
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
    <div class="inline-flex -space-x-px rounded-lg shadow-sm isolate">
      <UButton
        v-for="option in options"
        :key="option.value"
        :label="option.label"
        size="sm"
        :color="modelValue === option.value ? 'primary' : 'neutral'"
        :variant="modelValue === option.value ? 'solid' : 'soft'"
        :disabled="disabled || (option.value === 'READY' && isContentMissing && modelValue === 'DRAFT')"
        class="focus:z-10 rounded-none! first:rounded-s-lg! last:rounded-e-lg!"
        @click="selectStatus(option.value)"
      />
    </div>
    
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
