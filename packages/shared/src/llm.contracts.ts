export interface GenerateContentRequest {
  prompt: string;
  selectionText?: string;
  mediaDescriptions?: string[];
  contextLimitChars?: number;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  tags?: string[];
  content?: string;
  useContent?: boolean;
  onlyRawResult?: boolean;
}

export interface LlmResponseMetadata {
  provider: string;
  model_name: string;
  attempts: number;
  fallback_used: boolean;
}

export interface LlmResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GenerateContentResponse {
  content: string;
  metadata?: LlmResponseMetadata;
  usage?: LlmResponseUsage;
}

export interface ChannelInfoForLlm {
  channelId: string;
  channelName: string;
  socialMedia?: string;
  tags?: string[];
}

export interface GeneratePublicationFieldsRequest {
  prompt: string;
  publicationLanguage: string;
  channels: ChannelInfoForLlm[];
  temperature?: number;
  max_tokens?: number;
  model?: string;
  tags?: string[];
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
  metadata?: LlmResponseMetadata;
  usage?: LlmResponseUsage;
}

export const LlmErrorType = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  ABORTED: 'aborted',
  SERVER: 'server',
  RATE_LIMIT: 'rate_limit',
  GATEWAY_ERROR: 'gateway_error',
  UNKNOWN: 'unknown',
} as const;

export type LlmErrorType = (typeof LlmErrorType)[keyof typeof LlmErrorType];
