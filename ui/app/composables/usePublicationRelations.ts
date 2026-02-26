import { ref } from 'vue';
import { logger } from '~/utils/logger';

export interface RelationGroup {
  id: string;
  type: 'SERIES' | 'LOCALIZATION';
  projectId: string;
  items: RelationGroupItem[];
}

export interface RelationGroupItem {
  id: string;
  order: number;
  publication: {
    id: string;
    title: string | null;
    language: string;
    postType: string;
    status: string;
    archivedAt: string | null;
    posts?: Array<{
      channel: {
        id: string;
        name: string;
        isActive: boolean;
        archivedAt: string | null;
        project: { id: string; archivedAt: string | null };
      };
    }>;
  };
}

export function usePublicationRelations() {
  const relations = ref<RelationGroup[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const api = useApi();

  /**
   * Fetch all relation groups for a publication.
   */
  async function fetchRelations(publicationId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await api.get<RelationGroup[]>(`/publications/${publicationId}/relations`);
      relations.value = data || [];
    } catch (e: any) {
      logger.error('Failed to fetch relations', e);
      error.value = e.message || 'Failed to fetch relations';
      relations.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Link current publication to another via a relation group.
   */
  async function linkPublication(
    publicationId: string,
    targetPublicationId: string,
    type: 'SERIES' | 'LOCALIZATION',
  ) {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await api.post<{ groupId: string }>(
        `/publications/${publicationId}/relations/link`,
        { targetPublicationId, type },
      );
      await fetchRelations(publicationId);
      return result;
    } catch (e: any) {
      logger.error('Failed to link publication', e);
      error.value = e.data?.message || e.message || 'Failed to link';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Unlink current publication from a relation group.
   */
  async function unlinkPublication(publicationId: string, groupId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await api.post(`/publications/${publicationId}/relations/unlink`, { groupId });
      await fetchRelations(publicationId);
    } catch (e: any) {
      logger.error('Failed to unlink publication', e);
      error.value = e.data?.message || e.message || 'Failed to unlink';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new related publication and link it.
   */
  async function createRelated(
    publicationId: string,
    type: 'SERIES' | 'LOCALIZATION',
    options?: { title?: string; language?: string },
  ) {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await api.post<{ publicationId: string; groupId: string }>(
        `/publications/${publicationId}/relations/create-related`,
        { type, ...options },
      );
      await fetchRelations(publicationId);
      return result;
    } catch (e: any) {
      logger.error('Failed to create related publication', e);
      error.value = e.data?.message || e.message || 'Failed to create related';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Reorder items within a relation group.
   */
  async function reorderGroup(
    publicationId: string,
    groupId: string,
    items: Array<{ publicationId: string; order: number }>,
  ) {
    isLoading.value = true;
    error.value = null;
    try {
      await api.patch(`/publications/relation-groups/${groupId}/reorder`, { items });
      await fetchRelations(publicationId);
    } catch (e: any) {
      logger.error('Failed to reorder group', e);
      error.value = e.data?.message || e.message || 'Failed to reorder';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get total count of relations across all groups.
   */
  const relationsCount = computed(() => {
    return relations.value.reduce((sum, g) => sum + g.items.length - 1, 0);
  });

  /**
   * Check if publication has any relations.
   */
  const hasRelations = computed(() => relations.value.length > 0);

  return {
    relations,
    isLoading,
    error,
    relationsCount,
    hasRelations,
    fetchRelations,
    linkPublication,
    unlinkPublication,
    createRelated,
    reorderGroup,
  };
}
