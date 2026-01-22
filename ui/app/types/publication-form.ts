import type { PostType, PublicationStatus } from './posts'

/**
 * Source text item structure
 */
export interface SourceTextItem {
  content: string
  source: 'manual' | 'translation' | string
  order: number
  meta?: Record<string, any>
}

/**
 * Publication form data structure
 */
export interface PublicationFormData {
  title: string | null
  description: string | null
  content: string | null
  authorComment: string | null
  note: string | null
  tags: string | null
  language: string
  postType: PostType
  status: PublicationStatus
  meta: Record<string, any>
  postDate: string | null
  scheduledAt?: string
  sourceTexts: SourceTextItem[]
  channelIds: string[]
  translationGroupId?: string | null
}

/**
 * Validation error structure
 */
export interface ValidationError {
  channel: string
  message: string
}
