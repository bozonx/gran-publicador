export interface AuthorSignature {
  id: string
  userId: string
  channelId: string
  name: string
  content: string
  isDefault: boolean
  order: number
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    fullName?: string
    telegramUsername?: string
  }
}

export interface PresetSignature {
  id: string
  nameKey: string
  contentKey: string
  order: number
}

export interface CreateAuthorSignatureInput {
  channelId: string
  name: string
  content: string
  isDefault?: boolean
}

export interface UpdateAuthorSignatureInput {
  name?: string
  content?: string
  isDefault?: boolean
  order?: number
}
