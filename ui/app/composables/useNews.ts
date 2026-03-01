import { ref, computed } from 'vue';
import { logger } from '~/utils/logger';
import type { NewsItem, SearchNewsParams } from '~/types/news';
import { useCursorPagination } from './useCursorPagination';

const NEWS_LIMIT = 10;

export const useNews = () => {
  const api = useApi();
  const { user } = useAuth();
  const route = useRoute();
  const { t } = useI18n();
  const { executeAction } = useApiAction();
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
    await executeAction(
      async () => await cursorPagination.load({ ...params, pId }, isLoadMore),
      { silentErrors: false }
    );
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

    const [, res] = await executeAction(
      async () => await api.post<any>(`/projects/${pId}/news/${newsId}/content`, {
        force,
        contentLength: item.contentLength ?? 0,
        title: item.title,
        description: item.description,
        locale,
      }),
      { throwOnError: true }
    );

    if (!res) return null;

    return {
      title: res.title || res.item?.title,
      body: res.content || res.body || res.item?.content || res.item?.description,
      image: res.image || res.mainImageUrl || res.item?.mainImageUrl || res.item?.mainVideoUrl,
      date: res.date || res.savedAt || res.publishedAt || res.item?.date || res.item?.savedAt || res.item?._savedAt,
      url: res.url || res.item?.url,
      author: res.author || res.item?.publisher || res.item?._source,
      description: res.description || res.item?.description,
    };
  };

  const getQueries = async (customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    if (!pId) return [];
    const [, res] = await executeAction(async () => await api.get<any[]>(`/projects/${pId}/news-queries`), { silentErrors: true });
    return res || [];
  };

  const createQuery = async (query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    const [, res] = await executeAction(async () => await api.post(`/projects/${pId}/news-queries`, query));
    return res;
  };

  const updateQuery = async (id: string, query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    const [, res] = await executeAction(async () => await api.patch(`/projects/${pId}/news-queries/${id}`, query));
    return res;
  };

  const deleteQuery = async (id: string, customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    const [err] = await executeAction(async () => await api.delete(`/projects/${pId}/news-queries/${id}`));
    return !err;
  };

  const getDefaultQueries = async () => {
    const [, res] = await executeAction(async () => await api.get<any[]>('/news-queries/default'), { silentErrors: true });
    return res || [];
  };

  const updateNewsQueryOrder = async (order: string[]) => {
    if (!user.value) return false;
    const [err] = await executeAction(async () => {
      await api.patch('/users/me', { newsQueryOrder: order });
      if (user.value) user.value.newsQueryOrder = order;
    });
    return !err;
  };

  const reorderQueries = async (ids: string[], customProjectId?: string) => {
    const pId = customProjectId || projectId.value;
    if (!pId) return false;
    const [err] = await executeAction(async () => await api.patch(`/projects/${pId}/news-queries/reorder`, { ids }));
    return !err;
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
