import { ref, computed } from 'vue';
import { logger } from '~/utils/logger';
import type { NewsItem, SearchNewsParams } from '~/types/news';
import { useCursorPagination } from './useCursorPagination';

const NEWS_LIMIT = 10;

export const useNews = () => {
  const api = useApi();
  const { user } = useAuth();
  const route = useRoute();
  const toast = useToast();
  const { t } = useI18n();
  const projectId = computed(() => route.params.id as string);

  const cursorPagination = useCursorPagination<NewsItem, SearchNewsParams & { pId: string }>({
    limit: NEWS_LIMIT,
    initialParams: { q: '', pId: projectId.value || '' },
    fetchFn: async (params, cursor) => {
      const { pId, ...rest } = params;
      if (!pId) throw new Error('Project ID is required');

      const queryParams: any = {
        ...rest,
        mode: rest.mode === 'all' ? 'hybrid' : rest.mode,
        sourceTags: Array.isArray(rest.sourceTags) ? rest.sourceTags.join(',') : rest.sourceTags,
        sources: Array.isArray(rest.sources) ? rest.sources.join(',') : rest.sources,
        cursor,
        limit: NEWS_LIMIT,
      };

      // Clean undefined/null/empty strings
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
          delete queryParams[key];
        }
      });

      const res = await api.get<any>(`/projects/${pId}/news/search`, { params: queryParams });

      let items: NewsItem[] = [];
      let nextCursor: string | undefined;

      if (res && Array.isArray(res.items)) {
        items = res.items.map((it: any) => ({
          ...it,
          id: it.id || it._id || it.shortId,
        }));
        nextCursor = res.nextCursor;
      } else if (Array.isArray(res)) {
        items = res.map((it: any) => ({
          ...it,
          id: it.id || it._id || it.shortId,
        }));
        if (items.length >= NEWS_LIMIT) {
           // We don't have a cursor in legacy array response, but we can't reliably guess next page here
        }
      }

      return { items, nextCursor };
    }
  });

  const searchNews = async (
    params: SearchNewsParams,
    customProjectId?: string,
    isLoadMore = false,
  ) => {
    const pId = customProjectId || projectId.value;
    try {
      await cursorPagination.load({ ...params, pId }, isLoadMore);
    } catch (err: any) {
      logger.error('Failed to search news', err);
      toast.add({
        title: t('news.searchErrorTitle'),
        description: err.message || 'Failed to search news',
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
      });
    }
  };

  const fetchNewsContent = async (
    item: NewsItem,
    customProjectId?: string,
    force = false,
    locale?: string,
  ) => {
    const newsId = item.id;
    const pId = customProjectId || projectId.value;
    if (!pId) throw new Error('Project ID is required');

    try {
      const res = await api.post<any>(`/projects/${pId}/news/${newsId}/content`, {
        force,
        contentLength: item.contentLength ?? 0,
        title: item.title,
        description: item.description,
        locale,
      });
      return {
        title: res.title || res.item?.title,
        body: res.content || res.body || res.item?.content || res.item?.description,
        image: res.image || res.mainImageUrl || res.item?.mainImageUrl || res.item?.mainVideoUrl,
        date: res.date || res.savedAt || res.publishedAt || res.item?.date || res.item?.savedAt || res.item?._savedAt,
        url: res.url || res.item?.url,
        author: res.author || res.item?.publisher || res.item?._source,
        description: res.description || res.item?.description,
      };
    } catch (err: any) {
      logger.error('Failed to fetch news content', err);
      throw err;
    }
  };

  const getQueries = async (customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    if (!pId) return [];
    return await api.get<any[]>(`/projects/${pId}/news-queries`);
  };

  const createQuery = async (query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    return await api.post(`/projects/${pId}/news-queries`, query);
  };

  const updateQuery = async (id: string, query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    return await api.patch(`/projects/${pId}/news-queries/${id}`, query);
  };

  const deleteQuery = async (id: string, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    return await api.delete(`/projects/${pId}/news-queries/${id}`);
  };

  const getDefaultQueries = async () => {
    return await api.get<any[]>('/news-queries/default');
  };

  const updateNewsQueryOrder = async (order: string[]) => {
    if (!user.value) return false;
    try {
      await api.patch('/users/me', { newsQueryOrder: order });
      if (user.value) user.value.newsQueryOrder = order;
      return true;
    } catch (err) {
      logger.error('Failed to update news query order', err);
      return false;
    }
  };

  const reorderQueries = async (ids: string[], customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    if (!pId) return false;
    try {
      await api.patch(`/projects/${pId}/news-queries/reorder`, { ids });
      return true;
    } catch (err) {
      logger.error('Failed to reorder news queries', err);
      return false;
    }
  };

  return {
    news: cursorPagination.items,
    isLoading: cursorPagination.isLoading,
    error: cursorPagination.error,
    hasMore: cursorPagination.hasMore,
    searchNews,
    fetchNewsContent,
    getQueries,
    createQuery,
    updateQuery,
    deleteQuery,
    getDefaultQueries,
    updateNewsQueryOrder,
    reorderQueries,
  };
};
