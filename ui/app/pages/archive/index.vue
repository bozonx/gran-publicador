<script setup lang="ts">
import { ArchiveEntityType } from '~/types/archive.types';

definePageMeta({
    middleware: 'auth',
});

const { t } = useI18n();
const { stats, loading, fetchStats, fetchArchivedEntities, restoreEntity, deletePermanently } = useArchive();

const activeCollection = ref(ArchiveEntityType.PROJECT);
const entities = ref<any[]>([]);

const collections = computed(() => [
    { label: t('archive.projects'), value: ArchiveEntityType.PROJECT, count: stats.value?.projects || 0 },
    { label: t('archive.channels'), value: ArchiveEntityType.CHANNEL, count: stats.value?.channels || 0 },
    { label: t('archive.publications'), value: ArchiveEntityType.PUBLICATION, count: stats.value?.publications || 0 },
]);

const loadEntities = async () => {
    entities.value = await fetchArchivedEntities(activeCollection.value);
};

onMounted(async () => {
    await fetchStats();
    await loadEntities();
});

watch(activeCollection, loadEntities);

const isDeleteModalOpen = ref(false);
const deletingEntityId = ref<string | null>(null);
const deletingEntityName = ref('');

const handleRestore = async (id: string) => {
    await restoreEntity(activeCollection.value, id);
    await loadEntities();
};

const openDeleteConfirm = (entity: any) => {
    deletingEntityId.value = entity.id;
    deletingEntityName.value = getEntityName(entity);
    isDeleteModalOpen.value = true;
};

const handleDeleteConfirm = async () => {
    if (deletingEntityId.value) {
        await deletePermanently(activeCollection.value, deletingEntityId.value);
        await loadEntities();
        isDeleteModalOpen.value = false;
        deletingEntityId.value = null;
    }
};

const getEntityName = (entity: any) => {
    return entity.name || entity.title || entity.content?.substring(0, 30) || entity.id;
};

const columns = computed(() => [
    { key: 'name', label: t('archive.entity_name') },
    { key: 'archived_at', label: t('archive.archived_at') },
    { key: 'actions', label: '' },
]);
</script>

<template>
    <div class="p-6 max-w-7xl mx-auto space-y-6">
        <header class="flex justify-between items-center bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 backdrop-blur-xl bg-opacity-80">
            <div>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                    {{ t('archive.title') }}
                </h1>
                <p class="text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('archive.subtitle') }}
                </p>
            </div>
            <div v-if="stats" class="flex gap-4">
                <div class="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                    <span class="text-sm text-primary-600 dark:text-primary-400 font-medium">{{ t('archive.total_archived') }}:</span>
                    <span class="ml-2 text-lg font-bold text-primary-700 dark:text-primary-300">{{ stats.total }}</span>
                </div>
            </div>
        </header>

        <UContainer>
            <UCollections v-model="activeCollection" :items="collections" class="w-full">
                <template #default="{ item, index, selected }">
                    <div class="flex items-center gap-2 px-3 py-1.5 transition-all duration-200" :class="[selected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']">
                        <span>{{ item.label }}</span>
                        <UBadge v-if="item.count" size="xs" :color="selected ? 'primary' : 'gray'" variant="soft" class="rounded-full shadow-sm">
                            {{ item.count }}
                        </UBadge>
                    </div>
                </template>
            </UCollections>

            <div class="mt-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden min-h-[400px]">
                <UTable :loading="loading" :rows="entities" :columns="columns" class="w-full">
                    <template #name-data="{ row }">
                        <div class="flex items-center gap-3 py-2">
                            <UIcon 
                                :name="activeCollection === ArchiveEntityType.PROJECT ? 'i-heroicons-folder' : activeCollection === ArchiveEntityType.CHANNEL ? 'i-heroicons-megaphone' : activeCollection === ArchiveEntityType.PUBLICATION ? 'i-heroicons-document-text' : 'i-heroicons-chat-bubble-left-right'" 
                                class="w-5 h-5 text-primary-500 opacity-80"
                            />
                            <span class="font-medium text-gray-900 dark:text-white">{{ getEntityName(row) }}</span>
                        </div>
                    </template>

                    <template #archived_at-data="{ row }">
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            {{ new Date(row.archived_at).toLocaleString() }}
                        </div>
                    </template>

                    <template #actions-data="{ row }">
                        <div class="flex justify-end gap-2 pr-4">
                            <UButton
                                icon="i-heroicons-arrow-path"
                                size="sm"
                                color="primary"
                                variant="soft"
                                class="rounded-xl transition-all duration-200 hover:scale-105"
                                @click="handleRestore(row.id)"
                            >
                                {{ t('archive.restore') }}
                            </UButton>
                            <UButton
                                icon="i-heroicons-trash"
                                size="sm"
                                color="error"
                                variant="soft"
                                class="rounded-xl transition-all duration-200 hover:scale-105"
                                @click="openDeleteConfirm(row)"
                            >
                                {{ t('archive.delete_permanent') }}
                            </UButton>
                        </div>
                    </template>

                    <template #empty-state>
                        <div class="flex flex-col items-center justify-center py-24 space-y-4 opacity-70">
                            <div class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-full">
                                <UIcon name="i-heroicons-archive-box" class="w-16 h-16 text-gray-400" />
                            </div>
                            <p class="text-gray-500 text-lg font-medium">{{ t('archive.empty') }}</p>
                        </div>
                    </template>
                </UTable>
            </div>
        </UContainer>

        <ArchiveDeleteModal
            v-model:open="isDeleteModalOpen"
            :entity-name="deletingEntityName"
            @confirm="handleDeleteConfirm"
        />
    </div>
</template>

<style scoped>
.v-enter-active,
.v-leave-active {
    transition: opacity 0.3s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}
</style>
