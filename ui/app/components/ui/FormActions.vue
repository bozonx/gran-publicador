<script setup lang="ts">
/**
 * Form actions component with Save and Reset buttons
 * Shows reset button only when form has unsaved changes
 */

interface Props {
  /** Whether the form is currently loading/submitting */
  loading?: boolean
  /** Whether the save button should be disabled */
  disabled?: boolean
  /** Whether the form has unsaved changes */
  isDirty?: boolean
  /** Label for save button */
  saveLabel?: string
  /** Label for reset button */
  resetLabel?: string
  /** Whether to hide cancel button */
  hideCancel?: boolean
  /** Label for cancel button */
  cancelLabel?: string
  /** Whether to show border top */
  showBorder?: boolean
}

interface Emits {
  (e: 'reset'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  isDirty: false,
  saveLabel: undefined,
  resetLabel: undefined,
  hideCancel: false,
  cancelLabel: undefined,
  showBorder: true,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const saveButtonRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

function handleReset() {
  emit('reset')
}

function handleCancel() {
  emit('cancel')
}

// Expose methods to parent component
defineExpose({
  showSuccess: () => saveButtonRef.value?.showSuccess(),
  showError: () => saveButtonRef.value?.showError(),
})
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 pt-6"
    :class="[showBorder ? 'border-t border-gray-200 dark:border-gray-700' : '']"
  >
    <!-- Left side: Reset button (only when dirty) -->
    <div class="flex-1">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div v-if="isDirty" class="flex items-center gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-heroicons-arrow-path"
            :disabled="loading"
            @click="handleReset"
          >
            {{ resetLabel || t('common.reset', 'Reset') }}
          </UButton>
          <span class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
            {{ t('form.unsavedChanges', 'Unsaved changes') }}
          </span>
        </div>
      </Transition>
    </div>

    <!-- Right side: Cancel and Save buttons -->
    <div class="flex items-center gap-3">
      <UButton
        v-if="!hideCancel"
        type="button"
        color="neutral"
        variant="ghost"
        :disabled="loading"
        @click="handleCancel"
      >
        {{ cancelLabel || t('common.cancel') }}
      </UButton>
      <UiSaveButton
        ref="saveButtonRef"
        :loading="loading"
        :disabled="disabled"
        :label="saveLabel || t('common.save')"
      />
    </div>
  </div>
</template>
