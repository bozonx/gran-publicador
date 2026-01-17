<script setup lang="ts">
// We define the specific colors supported by UButton to ensure type safety
type ButtonColor = 'primary' | 'secondary' | 'neutral' | 'error' | 'warning' | 'success' | 'info';

const {
    title,
    description,
    confirmText,
    cancelText,
    color = 'primary',
    icon,
    loading = false
} = defineProps<{
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    color?: ButtonColor;
    icon?: string;
    loading?: boolean;
}>();

const emit = defineEmits(['confirm']);

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const handleConfirm = () => {
    emit('confirm');
};

const handleClose = () => {
    isOpen.value = false;
};
</script>

<template>
  <UiAppModal 
    v-model:open="isOpen"
    :title="title"
    :description="description"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <div class="flex flex-col gap-4">
      <div v-if="icon || description" class="flex gap-4">
          <div v-if="icon" class="shrink-0">
              <UIcon 
                  :name="icon" 
                  class="w-6 h-6" 
                  :class="{
                      'text-primary-500': color === 'primary',
                      'text-error-500': color === 'error',
                      'text-warning-500': color === 'warning',
                      'text-success-500': color === 'success',
                      'text-info-500': color === 'info',
                      'text-gray-500': color === 'neutral' || color === 'secondary'
                  }"
              />
          </div>
          <div class="flex-1">
              <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400">
                  {{ description }}
              </p>
              <slot v-else />
          </div>
      </div>
      <div v-else>
           <slot />
      </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="handleClose"
      >
        {{ cancelText || t('common.cancel') }}
      </UButton>
      <UButton
        :color="color"
        :loading="loading"
        @click="handleConfirm"
      >
        {{ confirmText || t('common.confirm') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
