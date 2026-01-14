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

    try {
      const response = await $fetch<LlmResponse>('/api/v1/llm/generate', {
        method: 'POST',
        body: {
          prompt,
          ...options,
        },
      })

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to generate content'
      console.error('LLM generation error:', err)
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
