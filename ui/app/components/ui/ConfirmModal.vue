<script setup lang="ts">
// We define the specific colors supported by UButton to ensure type safety
// Adjust this list based on your actual theme config if needed
type ButtonColor = 'primary' | 'secondary' | 'neutral' | 'error' | 'warning' | 'success' | 'info';

const props = withDefaults(defineProps<{
    modelValue: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    color?: ButtonColor;
    icon?: string;
    loading?: boolean;
}>(), {
    color: 'primary',
    loading: false
});

const emit = defineEmits(['update:modelValue', 'confirm']);

const { t } = useI18n();

const handleConfirm = () => {
    emit('confirm');
};

const handleClose = () => {
    emit('update:modelValue', false);
};
</script>

<template>
  <UModal 
    :open="modelValue" 
    :title="title"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:modelValue', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div v-if="icon || description" class="flex gap-4">
            <div v-if="icon" class="shrink-0">
                <UIcon 
                    :name="icon" 
                    class="w-6 h-6" 
                    :class="{
                        'text-primary-500': color === 'primary',
                        'text-red-500': color === 'error',
                        'text-orange-500': color === 'warning',
                        'text-green-500': color === 'success',
                        'text-blue-500': color === 'info',
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
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
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
      </div>
    </template>
  </UModal>
</template>
