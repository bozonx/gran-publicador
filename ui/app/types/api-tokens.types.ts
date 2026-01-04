// API Token types for user-generated API tokens

export interface ApiToken {
    id: string
    userId: string
    name: string
    plainToken: string // decrypted token
    scopeProjectIds: string[] // parsed from JSON
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface CreateApiTokenDto {
    name: string
    scopeProjectIds?: string[]
}

export interface UpdateApiTokenDto {
    name?: string
    scopeProjectIds?: string[]
}
