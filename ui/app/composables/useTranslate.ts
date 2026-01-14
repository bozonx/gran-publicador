import { ref } from 'vue'

export interface TranslateParams {
  text: string
  targetLang: string
  sourceLang?: string
  provider?: string
  model?: string
  timeoutSec?: number
  maxChunkLength?: number
  splitter?: 'paragraph' | 'markdown' | 'sentence' | 'off'
}

export interface TranslateResponse {
  translatedText: string
  provider: string
  model?: string
  detectedSourceLang?: string
}

export function useTranslate() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const translateText = async (params: TranslateParams): Promise<TranslateResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<TranslateResponse>('/api/v1/translate', {
        method: 'POST',
        body: params,
      })
      return response
    } catch (err: any) {
      const msg = err.data?.message || err.message || 'Translation failed'
      error.value = msg
      throw new Error(msg)
    } finally {
      isLoading.value = false
    }
  }

  return {
    translateText,
    isLoading,
    error,
  }
}
