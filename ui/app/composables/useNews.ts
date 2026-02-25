import { ref, computed } from 'vue';
import { logger } from '~/utils/logger';

export interface NewsItem {
  id: string;
  shortId: string;
  source: string;
  batchId: string;
  taskId: string;
  savedAt: string;
  uniqueKey: string;
  dataset: string;
  url: string;
  title: string;
  description: string;
  date: string;
  _score: number;
  locale?: string;
  type?: string;
  mainImageUrl?: string;
  mainVideoUrl?: string;
  content?: string;
  tags?: string[];
  publishedAt?: string;
  publisher?: string;
  _source?: string;
  _savedAt?: string;
  contentLength?: number;
}

export interface SearchNewsParams {
  q: string;
  mode?: 'text' | 'vector' | 'hybrid' | 'all';
  savedFrom?: string;
  savedTo?: string;
  afterSavedAt?: string;
  afterId?: string;
  cursor?: string;
  source?: string;
  sourceTags?: string;
  lang?: string;
  minScore?: number;
  includeContent?: boolean;
  orderBy?: 'relevance' | 'savedAt';
  sources?: string;
}

const NEWS_LIMIT = 10;

export const useNews = () => {
  const api = useApi();
  const { user } = useAuth();
  const route = useRoute();
  const toast = useToast();
  const { t } = useI18n();
  const projectId = computed(() => route.params.id as string);

  const news = ref<NewsItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Pagination state
  const cursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);

  const searchNews = async (
    params: SearchNewsParams,
    customProjectId?: string,
    isLoadMore = false,
  ) => {
    isLoading.value = true;
    error.value = null;

    const pId = customProjectId || projectId.value;
    if (!pId) {
      error.value = 'Project ID is required';
      isLoading.value = false;
      return;
    }

    // Reset pagination on new search
    if (!isLoadMore) {
      cursor.value = undefined;
    }

    try {
      const sanitizeParams = (p: SearchNewsParams) => {
        const queryParams: any = {
          q: p.q,
          mode: p.mode === 'all' ? 'hybrid' : p.mode,
          savedFrom: p.savedFrom,
          savedTo: p.savedTo,
          afterSavedAt: p.afterSavedAt,
          afterId: p.afterId,
          cursor: isLoadMore ? cursor.value : p.cursor,
          source: p.source,
          sourceTags: Array.isArray(p.sourceTags) ? p.sourceTags.join(',') : p.sourceTags,
          lang: p.lang,
          limit: NEWS_LIMIT,
          minScore: p.minScore,
          includeContent: p.includeContent,
          orderBy: p.orderBy,
          sources: Array.isArray(p.sources) ? p.sources.join(',') : p.sources,
        };

        // Filter out undefined, null, or empty string values
        Object.keys(queryParams).forEach(key => {
          if (
            queryParams[key] === undefined ||
            queryParams[key] === null ||
            queryParams[key] === ''
          ) {
            delete queryParams[key];
          }
        });

        return queryParams;
      };

      const queryParams = sanitizeParams(params);
      const res = await api.get<any>(`/projects/${pId}/news/search`, { params: queryParams });

      let newItems: NewsItem[] = [];
      if (res && Array.isArray(res.items)) {
        newItems = res.items.map((it: any) => ({
          ...it,
          id: it.id || it._id || it.shortId,
        }));

        // Update cursor for next page if available
        if (res.nextCursor) {
          cursor.value = res.nextCursor;
          hasMore.value = true;
        } else {
          hasMore.value = false;
        }
      } else if (Array.isArray(res)) {
        newItems = res.map((it: any) => ({
          ...it,
          id: it.id || it._id || it.shortId,
        }));
        // If legacy array response, assume more if we got a full page
        hasMore.value = newItems.length >= NEWS_LIMIT;
      } else {
        newItems = [];
        hasMore.value = false;
      }

      if (isLoadMore) {
        news.value.push(...newItems);
      } else {
        news.value = newItems;
      }
    } catch (err: any) {
      logger.error('Failed to search news', err);
      const msg = err.message || 'Failed to search news';
      error.value = msg;

      toast.add({
        title: t('news.searchErrorTitle'),
        description: msg,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
      });

      if (!isLoadMore) news.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const fetchNewsContent = async (
    item: NewsItem,
    customProjectId?: string,
    force = false,
    locale?: string,
  ): Promise<{
    title: string;
    body: string;
    image?: string;
    date?: string;
    url?: string;
    author?: string;
    description?: string;
  } | null> => {
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
        date:
          res.date ||
          res.savedAt ||
          res.publishedAt ||
          res.item?.date ||
          res.item?.savedAt ||
          res.item?._savedAt,
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
      if (user.value) {
        user.value.newsQueryOrder = order;
      }
      return true;
    } catch (err: any) {
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
    } catch (err: any) {
      logger.error('Failed to reorder news queries', err);
      return false;
    }
  };

  return {
    news,
    isLoading,
    error,
    hasMore,
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
