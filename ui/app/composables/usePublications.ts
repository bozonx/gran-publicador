import { ref, computed } from 'vue';
import { ArchiveEntityType } from '~/types/archive.types';
import { logger } from '~/utils/logger';
import { 
  getStatusIcon, 
  getPublicationProblems, 
  getPublicationProblemLevel, 
  getPostProblemLevel,
  getStatusDisplayName as utilGetStatusDisplayName,
  getStatusUiColor as utilGetStatusUiColor
} from '~/utils/publications';
import { applyArchiveQueryFlags } from '~/utils/archive-query';
import { normalizeTags, parseTags } from '~/utils/tags';
import type { 
  PublicationWithRelations, 
  PublicationsFilter, 
  PaginatedPublications,
  PublicationLlmChatInput,
  PublicationLlmChatResponse
} from '~/types/publications';

function resolvePublicationTags(publication: PublicationWithRelations): string[] {
  const rawTags = (publication as { tags?: unknown }).tags;

  if (Array.isArray(rawTags)) {
    return normalizeTags(rawTags.map(tag => String(tag ?? '')));
  }

  if (typeof rawTags === 'string') {
    return normalizeTags(parseTags(rawTags));
  }

  if (Array.isArray(publication.tagObjects)) {
    return normalizeTags(publication.tagObjects.map(tag => tag.name));
  }

  return [];
}

function normalizePublication(publication: PublicationWithRelations): PublicationWithRelations {
  return {
    ...publication,
    tags: resolvePublicationTags(publication),
  };
}

export function usePublications() {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const { archiveEntity, restoreEntity } = useArchive();

  const publications = ref<PublicationWithRelations[]>([]);
  const currentPublication = useState<PublicationWithRelations | null>(
    'usePublications.currentPublication',
    () => null,
  );
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const totalUnfilteredCount = ref(0);

  const statusOptions = computed(() => [
    { value: 'DRAFT', label: t('publicationStatus.draft') },
    { value: 'READY', label: t('publicationStatus.ready') },
    { value: 'SCHEDULED', label: t('publicationStatus.scheduled') },
    { value: 'PROCESSING', label: t('publicationStatus.processing') },
    { value: 'PUBLISHED', label: t('publicationStatus.published') },
    { value: 'PARTIAL', label: t('publicationStatus.partial') },
    { value: 'FAILED', label: t('publicationStatus.failed') },
    { value: 'EXPIRED', label: t('publicationStatus.expired') },
  ]);

  async function fetchPublicationsByProject(
    projectId: string,
    filters: PublicationsFilter = {},
    options: { append?: boolean } = {},
  ): Promise<PaginatedPublications> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: Record<string, any> = { projectId };
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;
      applyArchiveQueryFlags(params, {
        includeArchived: filters.includeArchived,
        archivedOnly: filters.archivedOnly,
      });
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.search) params.search = filters.search;
      if (filters.language) params.language = filters.language;
      if (filters.ownership && filters.ownership !== 'all') params.ownership = filters.ownership;
      if (filters.issueType && filters.issueType !== 'all') params.issueType = filters.issueType;
      if (filters.socialMedia) params.socialMedia = filters.socialMedia;
      if (filters.publishedAfter) params.publishedAfter = filters.publishedAfter;
      if (filters.tags) params.tags = filters.tags;

      const data = await api.get<PaginatedPublications>('/publications', { params });
      const normalizedItems = data.items.map(normalizePublication);
      const normalizedData = { ...data, items: normalizedItems };

      if (options.append) {
        publications.value = [...publications.value, ...normalizedItems];
      } else {
        publications.value = normalizedItems;
      }

      totalCount.value = data.meta.total;
      totalUnfilteredCount.value = data.meta.totalUnfiltered || data.meta.total;
      return normalizedData;
    } catch (err: any) {
      logger.error('[usePublications] fetchPublicationsByProject error', err);
      error.value = err.message || 'Failed to fetch publications';
      publications.value = [];
      totalCount.value = 0;
      return {
        items: [],
        meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 },
      };
    } finally {
      isLoading.value = false;
    }
  }

  async function publicationLlmChat(
    publicationId: string,
    payload: PublicationLlmChatInput,
    options: Parameters<typeof api.post>[2] = {},
  ): Promise<PublicationLlmChatResponse> {
    return await api.post<PublicationLlmChatResponse>(
      `/publications/${publicationId}/llm/chat`,
      payload,
      options,
    );
  }

  async function fetchUserPublications(
    filters: PublicationsFilter = {},
    options: { append?: boolean } = {},
  ): Promise<PaginatedPublications> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: Record<string, any> = {};
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.channelId) params.channelId = filters.channelId;
      if (filters.projectId) params.projectId = filters.projectId;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;
      applyArchiveQueryFlags(params, {
        includeArchived: filters.includeArchived,
        archivedOnly: filters.archivedOnly,
      });
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.search) params.search = filters.search;
      if (filters.language) params.language = filters.language;
      if (filters.ownership && filters.ownership !== 'all') params.ownership = filters.ownership;
      if (filters.issueType && filters.issueType !== 'all') params.issueType = filters.issueType;
      if (filters.socialMedia) params.socialMedia = filters.socialMedia;
      if (filters.publishedAfter) params.publishedAfter = filters.publishedAfter;
      if (filters.tags) params.tags = filters.tags;

      const data = await api.get<PaginatedPublications>('/publications', { params });
      const normalizedItems = data.items.map(normalizePublication);
      const normalizedData = { ...data, items: normalizedItems };

      if (options.append) {
        publications.value = [...publications.value, ...normalizedItems];
      } else {
        publications.value = normalizedItems;
      }

      totalCount.value = data.meta.total;
      totalUnfilteredCount.value = data.meta.totalUnfiltered || data.meta.total;
      return normalizedData;
    } catch (err: any) {
      logger.error('[usePublications] fetchUserPublications error', err);
      error.value = err.message || 'Failed to fetch publications';
      publications.value = [];
      totalCount.value = 0;
      return {
        items: [],
        meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 },
      };
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPublication(id: string): Promise<PublicationWithRelations | null> {
    // Clear current publication if ID is different to prevent state leakage
    if (currentPublication.value?.id !== id) {
      currentPublication.value = null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await api.get<PublicationWithRelations>(`/publications/${id}`);
      const normalized = normalizePublication(data);
      currentPublication.value = normalized;
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] fetchPublication error', err);
      error.value = err.message || 'Failed to fetch publication';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  function getStatusDisplayName(status: string): string {
    return utilGetStatusDisplayName(status, t);
  }

  function getStatusColor(status: string) {
    return utilGetStatusUiColor(status);
  }

  async function createPublication(data: any): Promise<PublicationWithRelations> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await api.post<PublicationWithRelations>('/publications', data);
      const normalized = normalizePublication(result);
      publications.value.unshift(normalized);
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] createPublication error', err);
      error.value = err.message || 'Failed to create publication';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updatePublication(
    id: string,
    data: any,
    options: { silent?: boolean } = {},
  ): Promise<PublicationWithRelations> {
    if (!options.silent) {
      isLoading.value = true;
    }
    error.value = null;

    try {
      const result = await api.patch<PublicationWithRelations>(`/publications/${id}`, data);
      const normalized = normalizePublication(result);
      const index = publications.value.findIndex((p: PublicationWithRelations) => p.id === id);
      if (index !== -1) {
        publications.value[index] = normalized;
      }
      if (currentPublication.value?.id === id) {
        currentPublication.value = normalized;
      }
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] updatePublication error', err);
      error.value = err.message || 'Failed to update publication';
      throw err;
    } finally {
      if (!options.silent) {
        isLoading.value = false;
      }
    }
  }

  async function deletePublication(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await api.delete(`/publications/${id}`);
      publications.value = publications.value.filter((p: PublicationWithRelations) => p.id !== id);
      if (currentPublication.value?.id === id) {
        currentPublication.value = null;
      }
      toast.add({
        title: t('common.success'),
        description: t('publication.deleted', 'Publication deleted successfully'),
        color: 'success',
      });
      return true;
    } catch (err: any) {
      logger.error('[usePublications] deletePublication error', err);
      error.value = err.message || 'Failed to delete publication';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to delete publication',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function bulkOperation(
    ids: string[],
    operation: string,
    status?: string,
    targetProjectId?: string,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const payload: any = { ids, operation, status, targetProjectId };
      // Remove undefined/null values to avoid issues with whitelist: true, forbidNonWhitelisted: true
      Object.keys(payload).forEach(
        key =>
          (payload[key] === undefined ||
            payload[key] === null) &&
          delete payload[key],
      );

      await api.post('/publications/bulk', payload);

      toast.add({
        title: t('common.success'),
        description: t(`publication.bulk.${operation}Success`, { count: ids.length }),
        color: 'success',
      });
      return true;
    } catch (err: any) {
      logger.error('[usePublications] bulkOperation error', err);
      error.value = err.message || 'Bulk operation failed';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Bulk operation failed',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function createPostsFromPublication(params: {
    id: string;
    channelIds: string[];
    scheduledAt?: string;
    authorSignatureId?: string;
    authorSignatureOverrides?: Record<string, string>;
    projectTemplateId?: string;
  }): Promise<any> {
    isLoading.value = true;
    error.value = null;

    try {
      const { id, ...body } = params;
      const result = await api.post(`/publications/${id}/posts`, body);
      return result;
    } catch (err: any) {
      logger.error('[usePublications] createPostsFromPublication error', err);
      error.value = err.message || 'Failed to create posts';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleArchive(publicationId: string, isArchived: boolean) {
    isLoading.value = true;
    try {
      if (isArchived) {
        await restoreEntity(ArchiveEntityType.PUBLICATION, publicationId);
      } else {
        await archiveEntity(ArchiveEntityType.PUBLICATION, publicationId);
      }
      // Refresh
      if (currentPublication.value?.id === publicationId) {
        await fetchPublication(publicationId);
      } else {
        const idx = publications.value.findIndex(
          (p: PublicationWithRelations) => p.id === publicationId,
        );
        if (idx !== -1) {
          const pub = publications.value[idx];
          if (pub && pub.projectId) {
            await fetchPublicationsByProject(pub.projectId, { includeArchived: true });
          }
        }
      }
    } catch (e) {
      // handled by useArchive
    } finally {
      isLoading.value = false;
    }
  }

  function hasFailedPosts(publication: PublicationWithRelations): boolean {
    if (!publication.posts || publication.posts.length === 0) return false;
    return publication.posts.some((post: any) => post.status === 'FAILED');
  }

  async function copyPublication(
    id: string,
    projectId: string | null,
  ): Promise<PublicationWithRelations> {
    isLoading.value = true;
    error.value = null;

    try {
      const payload: { projectId?: string } = {};
      if (projectId) payload.projectId = projectId;

      const result = await api.post<PublicationWithRelations>(`/publications/${id}/copy`, payload);
      return result;
    } catch (err: any) {
      logger.error('[usePublications] copyPublication error', err);
      error.value = err.message || 'Failed to copy publication';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    publications,
    currentPublication,
    isLoading,
    error,
    totalCount,
    totalUnfilteredCount,
    statusOptions,
    fetchPublicationsByProject,
    fetchUserPublications,
    fetchPublication,
    createPublication,
    updatePublication,
    copyPublication,
    publicationLlmChat,
    deletePublication,
    bulkOperation,
    createPostsFromPublication,
    getStatusDisplayName,
    getStatusColor,
    getStatusIcon,
    toggleArchive,
    // Problem detection
    hasFailedPosts,

    getPublicationProblems,
    getPublicationProblemLevel,
    getPostProblemLevel,
  };
}
