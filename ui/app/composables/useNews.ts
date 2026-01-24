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
  since?: string
  source?: string
  limit?: number
  minScore?: number
}

export const useNews = () => {
  const api = useApi()
  const route = useRoute()
  const projectId = computed(() => route.params.id as string)

  const news = ref<NewsItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const searchNews = async (params: SearchNewsParams, customProjectId?: string) => {
    isLoading.value = true
    error.value = null

    const pId = customProjectId || projectId.value
    if (!pId) {
      error.value = 'Project ID is required'
      isLoading.value = false
      return
    }

    try {
      const res = await api.get<any>(
        `/projects/${pId}/news/search`,
        {
          params: {
            q: params.q,
            since: params.since,
            source: params.source,
            limit: params.limit,
            minScore: params.minScore
          }
        }
      )

      if (Array.isArray(res)) {
        news.value = res
      } else if (res && Array.isArray(res.items)) {
        news.value = res.items
      } else {
        // Fallback or empty
        news.value = []
      }
    } catch (err: any) {
      console.error('Failed to search news:', err)
      error.value = err.message || 'Failed to search news'
      news.value = []
    } finally {
      isLoading.value = false
    }
  }

  return {
    news,
    isLoading,
    error,
    searchNews,
  }
}
