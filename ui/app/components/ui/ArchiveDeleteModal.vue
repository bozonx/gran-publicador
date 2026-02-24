<script setup lang="ts">
const props = defineProps<{
    entityName: string;
}>();

const emit = defineEmits(['confirm']);

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();


const handleConfirm = () => {
    emit('confirm');
    isOpen.value = false;
};
</script>

<template>
    <UiAppModal 
        v-model:open="isOpen"
        :title="t('archive.delete_permanent_title')"
    >
        <template #header>
            <div class="flex items-center gap-3 text-error-600 dark:text-error-400">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8" />
                <h2 class="text-xl font-bold">{{ t('archive.delete_permanent_title') }}</h2>
            </div>
        </template>
        
        <div class="space-y-4">
            <div class="text-gray-600 dark:text-gray-400">
                {{ t('archive.delete_permanent_description', { name: entityName }) }}
            </div>
            
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
                class="rounded-xl"
                @click="isOpen = false"
            >
                {{ t('common.cancel') }}
            </UButton>
            <UButton
                color="error"
                icon="i-heroicons-trash"
                class="rounded-xl shadow-lg shadow-error-500/20"
                @click="handleConfirm"
            >
                {{ t('archive.confirm_delete') }}
            </UButton>
        </template>
    </UiAppModal>
</template>
