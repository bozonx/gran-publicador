<script setup lang="ts">
interface Props {
  errors: string[]
  entityType: 'publication' | 'post'
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

import { DialogTitle, DialogDescription } from 'reka-ui'

const isOpen = defineModel<boolean>('open', { required: true })

function handleConfirm() {
  emit('confirm')
  isOpen.value = false
}

function handleCancel() {
  emit('cancel')
  isOpen.value = false
}
</script>

<template>
  <UiAppModal 
    v-model:open="isOpen" 
    :title="t('validation.invalidContent')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-warning-500" />
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('validation.invalidContent') }}
        </DialogTitle>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('validation.validationWarningTitle')"
      />

      <DialogDescription class="text-sm text-gray-700 dark:text-gray-300">
        <p class="mb-3">
          {{ t(`validation.${entityType}ValidationWarning`) }}
        </p>
        
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p class="font-medium mb-2 text-gray-900 dark:text-white">{{ t('validation.errors') }}:</p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li v-for="(error, index) in errors" :key="index" class="text-error-600 dark:text-error-400">
              {{ error }}
            </li>
          </ul>
        </div>

        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {{ t('validation.failedStatusExplanation') }}
        </p>
      </DialogDescription>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        color="warning"
        @click="handleConfirm"
      >
        {{ t('validation.saveAnyway') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
