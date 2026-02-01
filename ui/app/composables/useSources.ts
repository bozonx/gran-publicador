import { ref } from 'vue'
import type { Source, SourceResponse } from '~/types/source'

export interface FetchSourcesParams {
  q?: string
  tags?: string
  limit?: number
  offset?: number
  orderBy?: 'name' | 'itemCount' | 'lastUpdated'
  order?: 'asc' | 'desc'
}

export const useSources = () => {
  const api = useApi()
  const sources = ref<Source[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchSources = async (params: FetchSourcesParams = {}) => {
    isLoading.value = true
    error.value = null

    try {
      const res = await api.get<SourceResponse>('/sources', { params })
      sources.value = res.items
      return res
    } catch (err: any) {
      console.error('Failed to fetch sources:', err)
      error.value = err.message || 'Failed to fetch sources'
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    sources,
    isLoading,
    error,
    fetchSources
  }
}
