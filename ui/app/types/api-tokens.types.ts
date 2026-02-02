// API Token types for user-generated API tokens

export interface ApiToken {
    id: string
    userId: string
    name: string
    plainToken: string // decrypted token
    allProjects: boolean
    projectIds: string[] // parsed from JSON
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface CreateApiTokenDto {
    name: string
    allProjects?: boolean
    projectIds?: string[]
}

export interface UpdateApiTokenDto {
    name?: string
    allProjects?: boolean
    projectIds?: string[]
}
