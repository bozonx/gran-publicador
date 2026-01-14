import { ref } from 'vue'

interface GenerateLlmOptions {
  temperature?: number
  max_tokens?: number
  model?: string
  tags?: string[]
}

interface LlmResponse {
  content: string
  metadata?: {
    provider: string
    model_name: string
    attempts: number
    fallback_used: boolean
  }
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export function useLlm() {
  const { post } = useApi()
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  /**
   * Generate content using LLM API.
   */
  async function generateContent(
    prompt: string,
    options?: GenerateLlmOptions
  ): Promise<LlmResponse | null> {
    isGenerating.value = true
    error.value = null
    console.log('LLM: Starting generation with prompt:', prompt)

    try {
      const response = await post<LlmResponse>('/llm/generate', {
        prompt,
        ...options,
      })
      console.log('LLM: Generation successful:', response)

      return response
    } catch (err: any) {
      const msg = err.data?.message || err.message || 'Failed to generate content'
      error.value = msg
      console.error('LLM: Generation error:', err)
      return null
    } finally {
      isGenerating.value = false
    }
  }

  return {
    isGenerating,
    error,
    generateContent,
  }
}
