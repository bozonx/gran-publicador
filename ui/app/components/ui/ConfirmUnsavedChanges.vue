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
  <UiAppModal v-model:open="confirmModalState.isOpen" :title="t('form.unsavedChanges', 'Unsaved Changes')">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-exclamation-triangle" class="text-orange-500 w-6 h-6" />
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
          {{ t('form.unsavedChanges', 'Unsaved Changes') }}
        </h3>
      </div>
    </template>

    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ confirmModalState.description }}
    </p>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="handleCancel">
        {{ t('common.stay', 'Stay') }}
      </UButton>
      <UButton color="warning" class="px-6" @click="handleConfirm">
        {{ t('common.leave', 'Leave without saving') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
