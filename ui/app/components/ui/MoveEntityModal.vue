<script setup lang="ts">
import { ArchiveEntityType } from '~/types/archive.types';

const props = defineProps<{
    modelValue: boolean;
    entityType: ArchiveEntityType;
    entityId: string;
    currentParentId: string;
}>();

const emit = defineEmits(['update:modelValue', 'moved']);

const { t } = useI18n();
const { moveEntity } = useArchive();
const { projects, fetchProjects } = useProjects();
const { channels, fetchChannels } = useChannels();

const selectedTargetId = ref('');
const loading = ref(false);

const targetOptions = computed(() => {
    if (props.entityType === ArchiveEntityType.CHANNEL || props.entityType === ArchiveEntityType.PUBLICATION) {
        return projects.value
            .filter(p => p.id !== props.currentParentId)
            .map(p => ({ label: p.name, value: p.id }));
    }
    return [];
});

onMounted(async () => {
    if (props.entityType === ArchiveEntityType.CHANNEL || props.entityType === ArchiveEntityType.PUBLICATION) {
        await fetchProjects();
    }
});

const handleMove = async () => {
    if (!selectedTargetId.value) return;
    
    loading.value = true;
    try {
        await moveEntity(props.entityType, props.entityId, selectedTargetId.value);
        emit('moved');
        emit('update:modelValue', false);
    } catch (error) {
        // Error handled in useArchive
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <UModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
        <template #content>
            <div class="p-6 space-y-6">
                <div class="flex items-center gap-3 text-primary-600 dark:text-primary-400">
                    <UIcon name="i-heroicons-arrows-right-left" class="w-8 h-8" />
                    <h3 class="text-xl font-bold">{{ t('archive.move_entity_title') }}</h3>
                </div>

                <div class="space-y-4">
                    <p class="text-gray-600 dark:text-gray-400 text-sm">
                        {{ t('archive.move_entity_description', { type: t(`archive.type_${entityType}`) }) }}
                    </p>

                    <UFormField :label="t('archive.target_parent')" required>
                        <USelectMenu
                            v-model="selectedTargetId"
                            :items="targetOptions"
                            value-key="value"
                            label-key="label"
                            :placeholder="t('archive.select_target')"
                            class="w-full"
                            size="lg"
                        />
                    </UFormField>
                </div>

                <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <UButton
                        color="neutral"
                        variant="ghost"
                        @click="emit('update:modelValue', false)"
                        class="rounded-xl"
                    >
                        {{ t('common.cancel') }}
                    </UButton>
                    <UButton
                        color="primary"
                        :loading="loading"
                        :disabled="!selectedTargetId"
                        @click="handleMove"
                        class="rounded-xl px-6 shadow-lg shadow-primary-500/20"
                    >
                        {{ t('archive.confirm_move') }}
                    </UButton>
                </div>
            </div>
        </template>
    </UModal>
</template>
