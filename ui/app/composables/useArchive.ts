import type { ArchiveEntityType, ArchiveStats, ArchivedEntity, MoveEntityDto } from '../types/archive.types';

export const useArchive = () => {
    const api = useApi();
    const toast = useToast();
    const { t } = useI18n();

    const stats = ref<ArchiveStats | null>(null);
    const loading = ref(false);

    const fetchStats = async () => {
        try {
            const response = await api.get<ArchiveStats>('/archive/stats');
            stats.value = response;
        } catch (error) {
            console.error('Failed to fetch archive stats:', error);
        }
    };

    const fetchArchivedEntities = async (type: ArchiveEntityType) => {
        loading.value = true;
        try {
            const response = await api.get<ArchivedEntity[]>(`/archive/${type}`);
            return response;
        } catch (error) {
            console.error(`Failed to fetch archived ${type}:`, error);
            return [];
        } finally {
            loading.value = false;
        }
    };

    const archiveEntity = async (type: ArchiveEntityType, id: string) => {
        try {
            await api.post(`/archive/${type}/${id}`);
            toast.add({
                title: t('archive.success_archived'),
                color: 'success',
            });
            await fetchStats();
        } catch (error) {
            toast.add({
                title: t('archive.error_archiving'),
                color: 'error',
            });
            throw error;
        }
    };

    const restoreEntity = async (type: ArchiveEntityType, id: string) => {
        try {
            await api.post(`/archive/${type}/${id}/restore`);
            toast.add({
                title: t('archive.success_restored'),
                color: 'success',
            });
            await fetchStats();
        } catch (error) {
            toast.add({
                title: t('archive.error_restoring'),
                color: 'error',
            });
            throw error;
        }
    };

    const deletePermanently = async (type: ArchiveEntityType, id: string) => {
        try {
            await api.delete(`/archive/${type}/${id}`);
            toast.add({
                title: t('archive.success_deleted'),
                color: 'success',
            });
            await fetchStats();
        } catch (error) {
            toast.add({
                title: t('archive.error_deleting'),
                color: 'error',
            });
            throw error;
        }
    };

    const moveEntity = async (type: ArchiveEntityType, id: string, targetParentId: string) => {
        try {
            await api.post(`/archive/${type}/${id}/move`, { targetParentId } as MoveEntityDto);
            toast.add({
                title: t('archive.success_moved'),
                color: 'success',
            });
        } catch (error) {
            toast.add({
                title: t('archive.error_moving'),
                color: 'error',
            });
            throw error;
        }
    };

    return {
        stats,
        loading,
        fetchStats,
        fetchArchivedEntities,
        archiveEntity,
        restoreEntity,
        deletePermanently,
        moveEntity,
    };
};
