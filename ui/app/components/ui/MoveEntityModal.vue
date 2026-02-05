<script setup lang="ts">
import { ArchiveEntityType } from '~/types/archive.types';

const props = defineProps<{
    entityType: ArchiveEntityType;
    entityId: string;
    currentParentId: string;
}>();

const emit = defineEmits(['moved']);

const isOpen = defineModel<boolean>('open', { required: true });

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
        isOpen.value = false;
    } catch (error) {
        // Error handled in useArchive
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <UiAppModal 
        v-model:open="isOpen"
        :title="t('archive.move_entity_title')"
    >
        <template #header>
            <div class="flex items-center gap-3 text-primary-600 dark:text-primary-400">
                <UIcon name="i-heroicons-arrows-right-left" class="w-8 h-8" />
                <h3 class="text-xl font-bold">{{ t('archive.move_entity_title') }}</h3>
            </div>
        </template>

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
                color="primary"
                :loading="loading"
                :disabled="!selectedTargetId"
                class="rounded-xl px-6 shadow-lg shadow-primary-500/20"
                @click="handleMove"
            >
                {{ t('archive.confirm_move') }}
            </UButton>
        </template>
    </UiAppModal>
</template>
