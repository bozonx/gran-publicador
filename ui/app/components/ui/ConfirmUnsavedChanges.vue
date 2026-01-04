<script setup lang="ts">
import { confirmModalState } from '~/composables/useDirtyFormsManager'

const { t } = useI18n()

function handleConfirm() {
  if (confirmModalState.value.resolve) {
    confirmModalState.value.resolve(true)
  }
}

function handleCancel() {
  if (confirmModalState.value.resolve) {
    confirmModalState.value.resolve(false)
  }
}
</script>

<template>
  <UModal v-model:open="confirmModalState.isOpen">
    <template #content>
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="text-orange-500 w-6 h-6" />
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('form.unsavedChanges', 'Unsaved Changes') }}
          </h3>
        </div>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {{ confirmModalState.description }}
        </p>

        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="handleCancel">
            {{ t('common.stay', 'Stay') }}
          </UButton>
          <UButton color="warning" @click="handleConfirm">
            {{ t('common.leave', 'Leave without saving') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
