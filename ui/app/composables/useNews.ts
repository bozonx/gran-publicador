import { ref, computed } from 'vue'

export interface NewsItem {
  id: string
  shortId: string
  source: string
  batchId: string
  taskId: string
  savedAt: string
  uniqueKey: string
  dataset: string
  url: string
  title: string
  description: string
  date: string
  _score: number
  locale?: string
  type?: string
  mainImageUrl?: string
  mainVideoUrl?: string
  content?: string
  tags?: string[]
  publishedAt?: string
  publisher?: string
  _source?: string
  _savedAt?: string
  contentLength?: number
}

export interface SearchNewsParams {
  q: string
  mode?: 'text' | 'vector' | 'hybrid'
  savedFrom?: string
  savedTo?: string
  afterSavedAt?: string
  afterId?: string
  cursor?: string
  source?: string
  sourceTags?: string
  lang?: string
  minScore?: number
  includeContent?: boolean
  orderBy?: 'relevance' | 'savedAt'
}

const NEWS_LIMIT = 10

export const useNews = () => {
  const api = useApi()
  const route = useRoute()
  const toast = useToast()
  const projectId = computed(() => route.params.id as string)

  const news = ref<NewsItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Pagination state
  const cursor = ref<string | undefined>(undefined)
  const hasMore = ref(false)

  const searchNews = async (params: SearchNewsParams, customProjectId?: string, isLoadMore = false) => {
    isLoading.value = true
    error.value = null

    const pId = customProjectId || projectId.value
    if (!pId) {
      error.value = 'Project ID is required'
      isLoading.value = false
      return
    }

    // Reset pagination on new search
    if (!isLoadMore) {
      cursor.value = undefined
    }

    try {
      const queryParams: any = {
        q: params.q,
        mode: params.mode,
        savedFrom: params.savedFrom,
        savedTo: params.savedTo,
        afterSavedAt: params.afterSavedAt,
        afterId: params.afterId,
        cursor: isLoadMore ? cursor.value : params.cursor,
        source: params.source,
        sourceTags: params.sourceTags,
        lang: params.lang,
        limit: NEWS_LIMIT,
        minScore: params.minScore,
        includeContent: params.includeContent,
        orderBy: params.orderBy
      }

      // Filter out undefined, null, or empty string values
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
          delete queryParams[key]
        }
      })

      const res = await api.get<any>(
        `/projects/${pId}/news/search`,
        { params: queryParams }
      )

      let newItems: NewsItem[] = []
      
      if (Array.isArray(res)) {
        newItems = res
        // If legacy array response, assume more if we got a full page
        hasMore.value = newItems.length >= NEWS_LIMIT
      } else if (res && Array.isArray(res.items)) {
        newItems = res.items
        
        // Update cursor for next page if available
        if (res.nextCursor) {
           cursor.value = res.nextCursor
           hasMore.value = true
        } else {
           hasMore.value = false
        }
      } else {
        newItems = []
        hasMore.value = false
      }

      if (isLoadMore) {
        news.value.push(...newItems)
      } else {
        news.value = newItems
      }
      
    } catch (err: any) {
      console.error('Failed to search news:', err)
      const msg = err.message || 'Failed to search news'
      error.value = msg
      
      toast.add({
        title: 'News Search Error',
        description: msg,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle'
      })
      
      if (!isLoadMore) news.value = []
    } finally {
      isLoading.value = false
    }
  }

  const fetchNewsContent = async (item: NewsItem, customProjectId?: string, force = false): Promise<{ title: string, body: string, image?: string, date?: string, url?: string, author?: string, description?: string } | null> => {
    const newsId = item.id
    const pId = customProjectId || projectId.value
    if (!pId) throw new Error('Project ID is required')

    try {
      const res = await api.post<any>(`/projects/${pId}/news/${newsId}/content`, { 
        force,
        contentLength: item.contentLength ?? 0,
        title: item.title,
        description: item.description
      })
      return {
        title: res.title,
        body: res.content || res.body,
        image: res.image || res.mainImageUrl,
        date: res.date || res.savedAt || res.publishedAt,
        url: res.url,
        author: res.author,
        description: res.description
      }
    } catch (err: any) {
       console.error('Failed to fetch news content:', err)
       throw err
    }
  }

  const getQueries = async (customProjectId?: string) => {
    const pId = customProjectId || projectId.value
    if (!pId) return []
    return await api.get<any[]>(`/projects/${pId}/news-queries`)
  }

  const createQuery = async (query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value
    return await api.post(`/projects/${pId}/news-queries`, query)
  }

  const updateQuery = async (id: string, query: any, customProjectId?: string) => {
    const pId = customProjectId || projectId.value
    return await api.patch(`/projects/${pId}/news-queries/${id}`, query)
  }

  const deleteQuery = async (id: string, customProjectId?: string) => {
    const pId = customProjectId || projectId.value
    return await api.delete(`/projects/${pId}/news-queries/${id}`)
  }

  const getDefaultQueries = async () => {
    return await api.get<any[]>('/news-queries/default')
  }

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
    getDefaultQueries
  }
}
