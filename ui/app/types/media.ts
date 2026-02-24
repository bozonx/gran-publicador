export interface MediaItem {
  id: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  storageType: 'TELEGRAM' | 'STORAGE'
  storagePath: string
  filename?: string
  alt?: string
  description?: string
  mimeType?: string
  sizeBytes?: number | string
  meta?: Record<string, any>
  fullMediaMeta?: Record<string, any>
  publicToken?: string
  createdAt?: string
  updatedAt?: string
}

export interface MediaLinkItem {
  id?: string
  media?: MediaItem
  order: number
  hasSpoiler?: boolean
}
