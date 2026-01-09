import type { SocialMedia } from './socialMedia'

export interface ChannelFooter {
    id: string
    name: string
    content: string
    isDefault: boolean
}

export interface Channel {
    id: string
    projectId: string
    socialMedia: SocialMedia
    name: string
    description?: string | null
    channelIdentifier: string
    language: string
    preferences?: {
        staleChannelsDays?: number
        footers?: ChannelFooter[]
    }
    coordinates?: string
    credentials?: Record<string, any>
    isActive: boolean
    archivedAt?: string | null
    createdAt: string
    updatedAt: string
    tags?: string | null
}

export interface ChannelWithProject extends Channel {
    project?: {
        id: string
        name: string
        archivedAt?: string | null
        ownerId?: string
    } | null
    role?: string
    isStale?: boolean
    postsCount?: number
    failedPostsCount?: number
    lastPostAt?: string
    lastPostId?: string | null
    lastPublicationId?: string | null
}

export interface ChannelCreateInput {
    projectId: string
    name: string
    description?: string
    socialMedia: SocialMedia
    channelIdentifier: string
    language: string
    isActive?: boolean
    credentials?: Record<string, any>
    preferences?: {
        staleChannelsDays?: number
        footers?: ChannelFooter[]
    }
    tags?: string | null
}

export interface ChannelUpdateInput {
    name?: string
    description?: string
    channelIdentifier?: string
    credentials?: Record<string, any>
    preferences?: {
        staleChannelsDays?: number
        footers?: ChannelFooter[]
    }
    isActive?: boolean
    tags?: string | null
}

export interface ChannelsFilter {
    projectId?: string
    socialMedia?: SocialMedia | null
    isActive?: boolean | null
    search?: string
    includeArchived?: boolean
}
