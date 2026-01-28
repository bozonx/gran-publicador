import { ref, computed } from 'vue'

export interface NewsItem {
  _id: string
  _shortId: string
  _source: string
  _batchId: string
  _taskId: string
  _savedAt: string
  _uniqueKey: string
  _dataset: string
  url: string
  title: string
  description: string
  date: string
  _score: number
}

export interface SearchNewsParams {
  q: string
  mode?: 'text' | 'vector' | 'hybrid'
  since?: string
  source?: string
  sourceTags?: string
  newsTags?: string
  lang?: string
  offset?: number
  minScore?: number
}

const NEWS_LIMIT = 20

export const useNews = () => {
  const api = useApi()
  const route = useRoute()
  const toast = useToast()
  const projectId = computed(() => route.params.id as string)

  const news = ref<NewsItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Pagination state
  const offset = ref(0)
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

    const currentOffset = isLoadMore ? offset.value : 0

    try {
      const res = await api.get<any>(
        `/projects/${pId}/news/search`,
        {
          params: {
            q: params.q,
            mode: params.mode,
            since: params.since,
            source: params.source,
            sourceTags: params.sourceTags,
            newsTags: params.newsTags,
            lang: params.lang,
            offset: currentOffset,
            limit: NEWS_LIMIT,
            minScore: params.minScore
          }
        }
      )

      let newItems: NewsItem[] = []
      let total = 0
      
      if (Array.isArray(res)) {
        newItems = res
        // If legacy array response, assume more if we got a full page
        hasMore.value = newItems.length >= NEWS_LIMIT
      } else if (res && Array.isArray(res.items)) {
        newItems = res.items
        total = res.meta?.total || 0
        
        // Check if we have more pages
        if (res.meta && typeof res.meta.total === 'number') {
            hasMore.value = (currentOffset + newItems.length) < total
        } else {
            hasMore.value = newItems.length >= NEWS_LIMIT
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
      
      // Update offset pointer for next load
      offset.value = currentOffset + newItems.length
      
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
    return await api.put(`/projects/${pId}/news-queries/${id}`, query)
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
    offset,
    getQueries,
    createQuery,
    updateQuery,
    deleteQuery,
    getDefaultQueries
  }
}
