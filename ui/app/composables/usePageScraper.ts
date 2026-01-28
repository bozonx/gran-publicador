export interface ScrapedPage {
  url: string
  title: string
  description: string
  author?: string
  date?: string
  image?: string
  favicon?: string
  type?: string
  source?: string
  body?: string
  links?: Array<{ href: string; text: string }>
  ttr?: number
  meta?: {
    lang?: string
    readTimeMin?: number
    rawBody?: boolean
  }
}

export interface PageScraperOptions {
  mode?: 'extractor' | 'playwright'
  rawBody?: boolean
  taskTimeoutSecs?: number
  fingerprint?: {
    generate?: boolean
    userAgent?: string
    locale?: string
    timezoneId?: string
    rotateOnAntiBot?: boolean
    blockTrackers?: boolean
    blockHeavyResources?: boolean
    operatingSystems?: string[]
    devices?: string[]
  }
}

import { ref } from 'vue'

export const usePageScraper = () => {
  const api = useApi()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const scrapePage = async (url: string, projectId: string, options: PageScraperOptions = {}): Promise<ScrapedPage | null> => {
    isLoading.value = true
    error.value = null

    try {
      // Use api.post which should automatically prepend /api/v1 if configured in useApi
      const response = await api.post<ScrapedPage>(`/projects/${projectId}/scrape-page`, {
        url,
        mode: 'extractor', // Default to extractor
        ...options
      })
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to scrape page'
      console.error('Page scrape error:', e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    scrapePage,
    isLoading,
    error
  }
}
