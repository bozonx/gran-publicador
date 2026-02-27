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

// Re-export for backward compatibility with existing imports
export type { PublicationWithRelations } from '~/types/publications';

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

  /**
   * Unified fetch method for both project-specific and user-wide publications.
   */
  async function fetchPublications(
    filters: PublicationsFilter = {},
    options: { append?: boolean } = {},
  ): Promise<PaginatedPublications> {
    isLoading.value = true;
    error.value = null;

    try {
      const params: Record<string, any> = {};
      
      if (filters.projectId) params.projectId = filters.projectId;
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.channelId) params.channelId = filters.channelId;
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
      logger.error('[usePublications] fetchPublications error', err);
      error.value = err.message || 'Failed to fetch publications';
      if (!options.append) {
        publications.value = [];
        totalCount.value = 0;
      }
      return {
        items: [],
        meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 },
      };
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * @deprecated Use fetchPublications
   */
  async function fetchUserPublications(filters: PublicationsFilter = {}, options: { append?: boolean } = {}) {
    return fetchPublications(filters, options);
  }

  /**
   * @deprecated Use fetchPublications
   */
  async function fetchPublicationsByProject(projectId: string, filters: PublicationsFilter = {}, options: { append?: boolean } = {}) {
    return fetchPublications({ ...filters, projectId }, options);
  }

  async function fetchPublication(id: string): Promise<PublicationWithRelations | null> {
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

  async function searchTags(q: string, options: { projectId?: string; limit?: number } = {}) {
    try {
      return await api.get<Array<{ name: string }>>('/publications/tags/search', {
        params: { q, ...options }
      });
    } catch (err) {
      logger.error('[usePublications] searchTags error', err);
      return [];
    }
  }

  async function createPublication(data: any): Promise<PublicationWithRelations> {
    isLoading.value = true;
    try {
      const result = await api.post<PublicationWithRelations>('/publications', data);
      const normalized = normalizePublication(result);
      publications.value.unshift(normalized);
      toast.add({
        title: t('common.success'),
        description: t('publication.createSuccess', 'Publication created successfully'),
        color: 'success',
      });
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] createPublication error', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updatePublication(id: string, data: any, options: { silent?: boolean } = {}): Promise<PublicationWithRelations> {
    if (!options.silent) isLoading.value = true;
    try {
      const result = await api.patch<PublicationWithRelations>(`/publications/${id}`, data);
      const normalized = normalizePublication(result);
      const index = publications.value.findIndex(p => p.id === id);
      if (index !== -1) publications.value[index] = normalized;
      if (currentPublication.value?.id === id) currentPublication.value = normalized;
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] updatePublication error', err);
      throw err;
    } finally {
      if (!options.silent) isLoading.value = false;
    }
  }

  async function deletePublication(id: string): Promise<boolean> {
    isLoading.value = true;
    try {
      await api.delete(`/publications/${id}`);
      publications.value = publications.value.filter(p => p.id !== id);
      if (currentPublication.value?.id === id) currentPublication.value = null;
      toast.add({ title: t('common.success'), color: 'success' });
      return true;
    } catch (err: any) {
      logger.error('[usePublications] deletePublication error', err);
      toast.add({ title: t('common.error'), description: err.message, color: 'error' });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function bulkOperation(ids: string[], operation: string, status?: string, targetProjectId?: string): Promise<boolean> {
    isLoading.value = true;
    try {
      const payload: any = { ids, operation, status, targetProjectId };
      Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
      await api.post('/publications/bulk', payload);
      toast.add({ title: t('common.success'), color: 'success' });
      return true;
    } catch (err: any) {
      logger.error('[usePublications] bulkOperation error', err);
      toast.add({ title: t('common.error'), description: err.message, color: 'error' });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function publicationLlmChat(publicationId: string, payload: PublicationLlmChatInput, options: any = {}) {
    return await api.post<PublicationLlmChatResponse>(`/publications/${publicationId}/llm/chat`, payload, options);
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
    try {
      const { id, ...body } = params;
      return await api.post(`/publications/${id}/posts`, body);
    } catch (err: any) {
      logger.error('[usePublications] createPostsFromPublication error', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleArchive(publicationId: string, isArchived: boolean) {
    if (isArchived) {
      await restoreEntity(ArchiveEntityType.PUBLICATION, publicationId);
    } else {
      await archiveEntity(ArchiveEntityType.PUBLICATION, publicationId);
    }
  }

  async function copyPublication(id: string, targetProjectId: string): Promise<PublicationWithRelations> {
    try {
      return await api.post<PublicationWithRelations>(`/publications/${id}/copy`, { targetProjectId });
    } catch (err: any) {
      logger.error('[usePublications] copyPublication error', err);
      throw err;
    }
  }

  async function applyLlmResult(id: string, data: any): Promise<PublicationWithRelations> {
    try {
      const result = await api.patch<PublicationWithRelations>(`/publications/${id}/apply-llm`, data);
      const normalized = normalizePublication(result);
      if (currentPublication.value?.id === id) currentPublication.value = normalized;
      return normalized;
    } catch (err: any) {
      logger.error('[usePublications] applyLlmResult error', err);
      throw err;
    }
  }

  /**
   * Enhanced problems detection including media validation
   */
  const { validatePostContent } = useSocialMediaValidation();
  function getEnhancedPublicationProblems(pub: PublicationWithRelations) {
    if (!pub) return [];
    const problems = getPublicationProblems(pub);
    
    // Linked platforms
    const platforms = [...new Set(pub.posts?.map((p: any) => p.channel?.socialMedia).filter(Boolean) || [])];
    
    // Media validation for publication-level media
    if (pub.media && pub.media.length > 0) {
        const mediaCount = pub.media.length;
        const mediaArray = pub.media.map(m => ({ type: m.media?.type || 'UNKNOWN' }));
        const postType = pub.postType;
        
        let hasMediaError = false;
        for (const platform of platforms) {
            const result = validatePostContent('', mediaCount, platform as any, mediaArray, postType);
            if (!result.isValid) {
                hasMediaError = true;
                break;
            }
        }
        
        if (hasMediaError) {
            problems.push({ type: 'critical', key: 'mediaValidation' });
        }
    }
    
    return problems;
  }

  const currentPublicationPlatforms = computed(() => {
    if (!currentPublication.value?.posts) return [];
    const platforms = currentPublication.value.posts.map((p: any) => p.channel?.socialMedia).filter(Boolean);
    return [...new Set(platforms)];
  });

  const currentPublicationProblems = computed(() => {
    if (!currentPublication.value) return [];
    return getEnhancedPublicationProblems(currentPublication.value);
  });

  return {
    publications,
    currentPublication,
    currentPublicationPlatforms,
    currentPublicationProblems,
    isLoading,
    error,
    totalCount,
    totalUnfilteredCount,
    statusOptions,
    fetchPublications,
    fetchUserPublications,
    fetchPublicationsByProject,
    fetchPublication,
    searchTags,
    createPublication,
    updatePublication,
    deletePublication,
    bulkOperation,
    publicationLlmChat,
    createPostsFromPublication,
    toggleArchive,
    copyPublication,
    applyLlmResult,
    getEnhancedPublicationProblems,
    getStatusDisplayName: (s: string) => utilGetStatusDisplayName(s, t),
    getStatusColor: (s: string) => utilGetStatusUiColor(s),
    getStatusIcon,
    getPublicationProblems,
    getPublicationProblemLevel,
    getPostProblemLevel,
  };
}
