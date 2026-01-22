import { ref } from 'vue'

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
  const config = useRuntimeConfig()
  const newsServiceUrl = config.public.newsServiceUrl || ''

  const news = ref<NewsItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const searchNews = async (params: SearchNewsParams) => {
    if (!newsServiceUrl) {
      error.value = 'News service URL is not configured'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      queryParams.append('q', params.q)
      
      if (params.since) queryParams.append('since', params.since)
      if (params.source) queryParams.append('source', params.source)
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.minScore !== undefined) queryParams.append('minScore', params.minScore.toString())

      const response = await $fetch<NewsItem[]>(
        `${newsServiceUrl}/data/search?${queryParams.toString()}`
      )

      news.value = response
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
