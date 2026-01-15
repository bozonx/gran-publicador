import { ref } from 'vue'

export interface SourceText {
  content: string
  order?: number
  source?: string
}

interface GenerateLlmOptions {
  temperature?: number
  max_tokens?: number
  model?: string
  tags?: string[]
  content?: string
  sourceTexts?: SourceText[]
  useContent?: boolean
  selectedSourceIndexes?: number[]
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

export enum LlmErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

export interface LlmError {
  type: LlmErrorType
  message: string
  originalError?: any
}

export function useLlm() {
  const { post } = useApi()
  const isGenerating = ref(false)
  const error = ref<LlmError | null>(null)

  /**
   * Determines the error type from the error object.
   */
  function getErrorType(err: any): LlmErrorType {
    if (!err) return LlmErrorType.UNKNOWN

    // Network errors
    if (err.name === 'NetworkError' || err.message?.includes('network')) {
      return LlmErrorType.NETWORK
    }

    // Timeout errors
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return LlmErrorType.TIMEOUT
    }

    // Rate limit (429)
    if (err.status === 429 || err.statusCode === 429) {
      return LlmErrorType.RATE_LIMIT
    }

    // Server errors (5xx)
    if (err.status >= 500 || err.statusCode >= 500) {
      return LlmErrorType.SERVER
    }

    return LlmErrorType.UNKNOWN
  }

  /**
   * Generate content using LLM API.
   * Now supports sending raw context data to backend for processing.
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
      const errorType = getErrorType(err)
      const msg = err.data?.message || err.message || 'Failed to generate content'
      
      error.value = {
        type: errorType,
        message: msg,
        originalError: err,
      }
      
      console.error('LLM: Generation error:', err)
      return null
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Estimates the number of tokens in a text.
   * Simple heuristic: ~4 characters per token.
   */
  function estimateTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  return {
    isGenerating,
    error,
    generateContent,
    estimateTokens,
  }
}
