import { useApi, useApiAction, useI18n } from '#imports';
import { usePublicationState } from './usePublicationState';
import { normalizePublication } from './utils';
import { applyArchiveQueryFlags } from '~/utils/archive-query';
import { logger } from '~/utils/logger';
import type { 
  PublicationWithRelations, 
  PublicationsFilter, 
  PaginatedPublications,
  PublicationCreateInput,
  PublicationUpdateInput
} from '~/types/publications';

export function usePublicationCrud() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();
  const state = usePublicationState();

  async function fetchPublications(
    filters: PublicationsFilter = {},
    options: { append?: boolean } = {},
  ): Promise<PaginatedPublications> {
    const [, result] = await executeAction(
      async () => {
        const params: Record<string, string | number | boolean | undefined> = {};
        
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
          state.store.appendItems(normalizedItems);
        } else {
          state.store.setItems(normalizedItems);
        }

        state.store.setTotalCount(data.meta.total);
        state.store.setTotalUnfilteredCount(data.meta.totalUnfiltered || data.meta.total);
        return normalizedData;
      },
      { loadingRef: state.isLoading, errorRef: state.error, silentErrors: true }
    );

    if (!result) {
      if (!options.append) {
        state.store.setItems([]);
        state.store.setTotalCount(0);
      }
      return {
        items: [],
        meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 },
      };
    }
    
    return result;
  }

  async function fetchUserPublications(filters: PublicationsFilter = {}, options: { append?: boolean } = {}) {
    return fetchPublications(filters, options);
  }

  async function fetchPublicationsByProject(projectId: string, filters: PublicationsFilter = {}, options: { append?: boolean } = {}) {
    return fetchPublications({ ...filters, projectId }, options);
  }

  async function fetchPublication(id: string): Promise<PublicationWithRelations | null> {
    if (state.currentPublication.value?.id !== id) {
      state.store.setCurrentPublication(null);
    }

    const [, result] = await executeAction(
      async () => {
        const data = await api.get<PublicationWithRelations>(`/publications/${id}`);
        const normalized = normalizePublication(data);
        state.store.setCurrentPublication(normalized);
        return normalized;
      },
      { loadingRef: state.isLoading, errorRef: state.error, silentErrors: true }
    );
    
    return result;
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

  async function createPublication(data: PublicationCreateInput): Promise<PublicationWithRelations> {
    const [, result] = await executeAction(
      async () => {
        const res = await api.post<PublicationWithRelations>('/publications', data);
        const normalized = normalizePublication(res);
        state.store.setItems([normalized, ...state.publications.value]);
        return normalized;
      },
      { loadingRef: state.isLoading, successMessage: t('publication.createSuccess', 'Publication created successfully'), throwOnError: true }
    );
    return result as PublicationWithRelations;
  }

  async function updatePublication(id: string, data: PublicationUpdateInput, options: { silent?: boolean } = {}): Promise<PublicationWithRelations> {
    const [, result] = await executeAction(
      async () => {
        const res = await api.patch<PublicationWithRelations>(`/publications/${id}`, data);
        const normalized = normalizePublication(res);
        state.store.updatePublicationInList(id, normalized);
        return normalized;
      },
      { loadingRef: state.isLoading, silentErrors: options.silent, throwOnError: true }
    );
    return result as PublicationWithRelations;
  }

  async function deletePublication(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/publications/${id}`);
        state.store.setItems(state.publications.value.filter(p => p.id !== id));
        if (state.currentPublication.value?.id === id) state.store.setCurrentPublication(null);
      },
      { loadingRef: state.isLoading, successMessage: t('common.success') }
    );
    return !err;
  }

  return {
    fetchPublications,
    fetchUserPublications,
    fetchPublicationsByProject,
    fetchPublication,
    searchTags,
    createPublication,
    updatePublication,
    deletePublication,
  };
}
