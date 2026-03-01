import { ref } from 'vue';
import { LlmErrorType } from '@gran/shared/llm';

interface GenerateLlmOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  tags?: string[];
  content?: string;
  useContent?: boolean;
  selectionText?: string;
  mediaDescriptions?: string[];
  contextLimitChars?: number;
  onlyRawResult?: boolean;
}

interface LlmResponse {
  content: string;
  metadata?: {
    provider: string;
    model_name: string;
    attempts: number;
    fallback_used: boolean;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LlmPublicationFieldsPostResult {
  channelId: string;
  content: string;
  tags: string[];
}

export interface LlmPublicationFieldsResult {
  publication: {
    title: string;
    description: string;
    content: string;
    tags: string[];
  };
  posts: LlmPublicationFieldsPostResult[];
  metadata?: LlmResponse['metadata'];
  usage?: LlmResponse['usage'];
}

export interface ChannelInfoForLlm {
  channelId: string;
  channelName: string;
  socialMedia?: string;
  tags?: string[];
  maxContentLength?: number;
}

export interface GeneratePublicationFieldsOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  tags?: string[];
}

export interface LlmError {
  type: LlmErrorType;
  message: string;
  originalError?: any;
}

// Re-export LlmErrorType for convenience
export { LlmErrorType };

export function useLlm() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const isGenerating = ref(false);
  const error = ref<LlmError | null>(null);
  const isAborted = ref(false);

  const activeController = ref<AbortController | null>(null);

  /**
   * Determines the error type from the error object.
   */
  function getErrorType(err: any): LlmErrorType {
    if (!err) return LlmErrorType.UNKNOWN;

    if (String(err.message || '').toLowerCase().includes('aborted')) {
      return LlmErrorType.ABORTED;
    }

    if (err.name === 'NetworkError' || err.message?.includes('network')) {
      return LlmErrorType.NETWORK;
    }

    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return LlmErrorType.TIMEOUT;
    }

    const statusCode = err.status ?? err.statusCode;
    if (statusCode === 429) return LlmErrorType.RATE_LIMIT;
    if (statusCode === 502 || statusCode === 504) return LlmErrorType.GATEWAY_ERROR;
    if (statusCode >= 500) return LlmErrorType.SERVER;

    return LlmErrorType.UNKNOWN;
  }

  async function generateContent(
    prompt: string,
    options?: GenerateLlmOptions,
  ): Promise<LlmResponse | null> {
    isAborted.value = false;
    activeController.value?.abort();
    activeController.value = api.createAbortController();

    const [err, response] = await executeAction(
      async () => await api.post<LlmResponse>(
        '/llm/generate',
        { prompt, ...options },
        { signal: activeController.value?.signal },
      ),
      { loadingRef: isGenerating, silentErrors: true }
    );

    if (err) {
      const errorType = getErrorType(err);
      if (errorType === LlmErrorType.ABORTED) isAborted.value = true;
      error.value = {
        type: errorType,
        message: (err as any).data?.message || err.message || 'Failed to generate content',
        originalError: err,
      };
      return null;
    }

    return response;
  }

  async function generatePublicationFields(
    prompt: string,
    publicationLanguage: string,
    channels: ChannelInfoForLlm[],
    options?: GeneratePublicationFieldsOptions,
  ): Promise<LlmPublicationFieldsResult | null> {
    isAborted.value = false;
    activeController.value?.abort();
    activeController.value = api.createAbortController();

    const [err, response] = await executeAction(
      async () => await api.post<LlmPublicationFieldsResult>(
        '/llm/generate-publication-fields',
        { prompt, publicationLanguage, channels, ...options },
        { signal: activeController.value?.signal },
      ),
      { loadingRef: isGenerating, silentErrors: true }
    );

    if (err) {
      const errorType = getErrorType(err);
      if (errorType === LlmErrorType.ABORTED) isAborted.value = true;
      error.value = {
        type: errorType,
        message: (err as any).data?.message || err.message || 'Failed to generate publication fields',
        originalError: err,
      };
      return null;
    }

    return response;
  }

  function stop() {
    activeController.value?.abort();
  }

  return {
    isGenerating,
    error,
    isAborted,
    generateContent,
    generatePublicationFields,
    estimateTokens: (text: string) => (!text ? 0 : Math.ceil(text.length / 4)),
    isRetryableError: (type: LlmErrorType) => ([
      LlmErrorType.NETWORK, 
      LlmErrorType.TIMEOUT, 
      LlmErrorType.GATEWAY_ERROR, 
      LlmErrorType.SERVER
    ] as string[]).includes(type),
    stop,
  };
}
