import { LlmErrorType } from '@gran/shared/llm'

export interface LlmContextTag {
  id: string
  label: string
  promptText: string
  kind: 'content' | 'media' | 'selection'
  enabled: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  contextTagIds?: string[]
  contextSnapshot?: Array<{
    id: string
    label: string
    promptText: string
    kind: 'content' | 'media' | 'selection'
    enabled?: boolean
  }>
}

export interface LlmError {
  type: LlmErrorType
  message: string
  originalError?: any
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
  metadata?: any;
  usage?: any;
}

export interface PostChannelInfo {
  channelId: string
  channelName: string
  language: string
  tags?: string[]
  socialMedia?: string
}

export interface ApplyData {
  publication?: {
    title?: string
    description?: string
    tags?: string
    content?: string
  }
  posts?: Array<{
    channelId: string
    content?: string
    tags?: string
  }>
  meta?: Record<string, any>
}
