<script setup lang="ts">
const props = defineProps<{
    modelValue: boolean;
    entityName: string;
}>();

const emit = defineEmits(['update:modelValue', 'confirm']);

const { t } = useI18n();

const handleConfirm = () => {
    emit('confirm');
    emit('update:modelValue', false);
};
</script>

<template>
    <AppModal 
        :open="modelValue" 
        @update:open="emit('update:modelValue', $event)"
        :title="t('archive.delete_permanent_title')"
    >
        <template #header>
            <div class="flex items-center gap-3 text-error-600 dark:text-error-400">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8" />
                <h3 class="text-xl font-bold">{{ t('archive.delete_permanent_title') }}</h3>
            </div>
        </template>
        
        <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-400">
                {{ t('archive.delete_permanent_description', { name: entityName }) }}
            </p>
            
            <div class="bg-error-50 dark:bg-error-900/20 p-4 rounded-xl border border-error-100 dark:border-error-800">
                <p class="text-sm text-error-700 dark:text-error-300 font-medium">
                    {{ t('archive.delete_permanent_warning') }}
                </p>
            </div>
        </div>

        <template #footer>
            <UButton
                color="neutral"
                variant="ghost"
                @click="emit('update:modelValue', false)"
                class="rounded-xl"
            >
                {{ t('common.cancel') }}
            </UButton>
            <UButton
                color="error"
                icon="i-heroicons-trash"
                @click="handleConfirm"
                class="rounded-xl shadow-lg shadow-error-500/20"
            >
                {{ t('archive.confirm_delete') }}
            </UButton>
        </template>
    </AppModal>
</template>
