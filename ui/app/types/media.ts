export interface MediaItem {
  id: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  storageType: 'TELEGRAM' | 'STORAGE'
  storagePath: string
  filename?: string;
  mimeType?: string;
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
  alt?: string
  description?: string
}

export interface MediaItemLike {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | string;
  storageType?: 'TELEGRAM' | 'STORAGE' | string;
  storagePath: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number | string;
  meta?: Record<string, any>;
}

export interface CreateMediaInput {
  id?: string;
  type?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  storageType?: 'TELEGRAM' | 'STORAGE';
  storagePath?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number | string;
  meta?: Record<string, any>;
}

export interface MediaThumbData {
  src: string | null;
  srcset: string | null;
  isVideo: boolean;
  placeholderIcon: string;
  placeholderText: string;
}
