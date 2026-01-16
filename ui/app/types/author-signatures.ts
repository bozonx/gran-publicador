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
  archivedAt: string | null
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
}
