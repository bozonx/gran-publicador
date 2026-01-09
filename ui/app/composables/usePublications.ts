import { ref, computed } from 'vue'
import { useApi } from './useApi'
import { useAuth } from './useAuth'
import { ArchiveEntityType } from '~/types/archive.types'
import type { PublicationStatus } from '~/types/posts'

export interface Publication {
    id: string
    projectId: string
    createdBy: string | null
    title: string | null
    description: string | null
    content: string | null
    tags: string | null
    status: PublicationStatus
    meta: string
    language: string
    postType: string
    translationGroupId?: string | null
    postDate: string | null
    createdAt: string
    updatedAt?: string | null
    archivedBy: string | null
    authorComment: string | null
    note: string | null
    archivedAt?: string | null
    scheduledAt?: string | null
}

export interface PublicationWithRelations extends Publication {
    creator?: {
        id: string
        fullName: string | null
        telegramUsername: string | null
        avatarUrl: string | null
    } | null
    project?: {
        id: string
        name: string
    } | null
    posts?: any[]
    translations?: { id: string; language: string; postType: string; title: string | null }[]
    media?: Array<{
        id: string
        order: number
        media?: {
            id: string
            type: string
            storageType: string
            storagePath: string
            filename?: string
            mimeType?: string
            sizeBytes?: number
        }
    }>
    _count?: {
        posts: number
    }
}

export interface PublicationsFilter {
    status?: PublicationStatus | PublicationStatus[] | null;
    channelId?: string | null
    limit?: number
    offset?: number
    includeArchived?: boolean
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    language?: string
    ownership?: 'own' | 'notOwn'
    issueType?: 'failed' | 'partial' | 'expired'
    socialMedia?: string
}

export interface PaginatedPublications {
    items: PublicationWithRelations[]
    meta: {
        total: number
        limit: number
        offset: number
    }
}

export function usePublications() {
    const api = useApi()
    const { user } = useAuth()
    const { t } = useI18n()
    const toast = useToast()
    const { archiveEntity, restoreEntity } = useArchive()

    const publications = ref<PublicationWithRelations[]>([])
    const currentPublication = ref<PublicationWithRelations | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const totalCount = ref(0)

    const statusOptions = computed(() => [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') },
        { value: 'SCHEDULED', label: t('publicationStatus.scheduled') },
        { value: 'PROCESSING', label: t('publicationStatus.processing') },
        { value: 'PUBLISHED', label: t('publicationStatus.published') },
        { value: 'PARTIAL', label: t('publicationStatus.partial') },
        { value: 'FAILED', label: t('publicationStatus.failed') },
        { value: 'EXPIRED', label: t('publicationStatus.expired') },
    ])

    async function fetchPublicationsByProject(
        projectId: string,
        filters: PublicationsFilter = {}
    ): Promise<PaginatedPublications> {
        isLoading.value = true
        error.value = null

        try {
            const params: Record<string, any> = { projectId }
            if (filters.status) {
                params.status = Array.isArray(filters.status) 
                    ? filters.status.join(',') 
                    : filters.status
            }
            if (filters.limit) params.limit = filters.limit
            if (filters.offset) params.offset = filters.offset
            if (filters.includeArchived) params.includeArchived = true
            if (filters.sortBy) params.sortBy = filters.sortBy
            if (filters.sortOrder) params.sortOrder = filters.sortOrder
            if (filters.search) params.search = filters.search
            if (filters.language) params.language = filters.language
            if (filters.ownership) params.ownership = filters.ownership
            if (filters.issueType) params.issueType = filters.issueType
            if (filters.socialMedia) params.socialMedia = filters.socialMedia

            const data = await api.get<PaginatedPublications>('/publications', { params })
            publications.value = data.items
            totalCount.value = data.meta.total
            return data
        } catch (err: any) {
            console.error('[usePublications] fetchPublicationsByProject error:', err)
            error.value = err.message || 'Failed to fetch publications'
            publications.value = []
            totalCount.value = 0
            return { items: [], meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 } }
        } finally {
            isLoading.value = false
        }
    }

    async function fetchUserPublications(
        filters: PublicationsFilter = {}
    ): Promise<PaginatedPublications> {
        isLoading.value = true
        error.value = null

        try {
            const params: Record<string, any> = {}
            if (filters.status) {
                params.status = Array.isArray(filters.status) 
                    ? filters.status.join(',') 
                    : filters.status
            }
            if (filters.channelId) params.channelId = filters.channelId
            if (filters.limit) params.limit = filters.limit
            if (filters.offset) params.offset = filters.offset
            if (filters.includeArchived) params.includeArchived = true
            if (filters.sortBy) params.sortBy = filters.sortBy
            if (filters.sortOrder) params.sortOrder = filters.sortOrder
            if (filters.search) params.search = filters.search
            if (filters.language) params.language = filters.language
            if (filters.ownership) params.ownership = filters.ownership
            if (filters.issueType) params.issueType = filters.issueType
            if (filters.socialMedia) params.socialMedia = filters.socialMedia

            const data = await api.get<PaginatedPublications>('/publications', { params })
            publications.value = data.items
            totalCount.value = data.meta.total
            return data
        } catch (err: any) {
            console.error('[usePublications] fetchUserPublications error:', err)
            error.value = err.message || 'Failed to fetch publications'
            publications.value = []
            totalCount.value = 0
            return { items: [], meta: { total: 0, limit: filters.limit || 50, offset: filters.offset || 0 } }
        } finally {
            isLoading.value = false
        }
    }

    async function fetchPublication(id: string): Promise<PublicationWithRelations | null> {
        isLoading.value = true
        error.value = null

        try {
            const data = await api.get<PublicationWithRelations>(`/publications/${id}`)
            currentPublication.value = data
            return data
        } catch (err: any) {
            console.error('[usePublications] fetchPublication error:', err)
            error.value = err.message || 'Failed to fetch publication'
            return null
        } finally {
            isLoading.value = false
        }
    }

    function getStatusDisplayName(status: string): string {
        if (!status) return '-'
        return t(`publicationStatus.${status.toLowerCase()}`)
    }

    function getStatusColor(status: string): string {
        if (!status) return 'neutral'
        const colors: Record<string, string> = {
            draft: 'neutral',
            ready: 'warning',
            scheduled: 'info',
            processing: 'primary',
            published: 'success',
            partial: 'error',
            failed: 'error',
            expired: 'error',
        }
        return colors[status.toLowerCase()] || 'neutral'
    }

    async function createPublication(data: any): Promise<PublicationWithRelations> {
        isLoading.value = true
        error.value = null

        try {
            const result = await api.post<PublicationWithRelations>('/publications', data)
            publications.value.unshift(result)
            return result
        } catch (err: any) {
            console.error('[usePublications] createPublication error:', err)
            error.value = err.message || 'Failed to create publication'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function updatePublication(id: string, data: any): Promise<PublicationWithRelations> {
        isLoading.value = true
        error.value = null

        try {
            const result = await api.patch<PublicationWithRelations>(`/publications/${id}`, data)
            const index = publications.value.findIndex(p => p.id === id)
            if (index !== -1) {
                publications.value[index] = result
            }
            if (currentPublication.value?.id === id) {
                currentPublication.value = result
            }
            return result
        } catch (err: any) {
            console.error('[usePublications] updatePublication error:', err)
            error.value = err.message || 'Failed to update publication'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function deletePublication(id: string): Promise<boolean> {
        isLoading.value = true
        error.value = null

        try {
            await api.delete(`/publications/${id}`)
            publications.value = publications.value.filter(p => p.id !== id)
            if (currentPublication.value?.id === id) {
                currentPublication.value = null
            }
            toast.add({
                title: t('common.success'),
                description: t('publication.deleted', 'Publication deleted successfully'),
                color: 'success'
            })
            return true
        } catch (err: any) {
            console.error('[usePublications] deletePublication error:', err)
            error.value = err.message || 'Failed to delete publication'
            toast.add({
                title: t('common.error'),
                description: error.value || 'Failed to delete publication',
                color: 'error'
            })
            return false
        } finally {
            isLoading.value = false
        }
    }

    async function createPostsFromPublication(id: string, channelIds: string[], scheduledAt?: string): Promise<any> {
        isLoading.value = true
        error.value = null

        try {
            const result = await api.post(`/publications/${id}/posts`, {
                channelIds,
                scheduledAt
            })
            return result
        } catch (err: any) {
            console.error('[usePublications] createPostsFromPublication error:', err)
            error.value = err.message || 'Failed to create posts'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function toggleArchive(publicationId: string, isArchived: boolean) {
        isLoading.value = true
        try {
            if (isArchived) {
                await restoreEntity(ArchiveEntityType.PUBLICATION, publicationId)
            } else {
                await archiveEntity(ArchiveEntityType.PUBLICATION, publicationId)
            }
            // Refresh
            if (currentPublication.value?.id === publicationId) {
                await fetchPublication(publicationId)
            } else {
                // If in list, refresh list? Or just update local item if possible?
                // Re-fetch is safest for now as we don't know filtering context perfectly
                // access projectId from current view? We don't have it here.
                // But we can check if the publication is in the `publications` list
                const idx = publications.value.findIndex(p => p.id === publicationId)
                if (idx !== -1) {
                    const pub = publications.value[idx]
                    if (pub) {
                        await fetchPublicationsByProject(pub.projectId, { includeArchived: true })
                    }
                }
            }
        } catch (e) {
            // handled by useArchive
        } finally {
            isLoading.value = false
        }
    }

    // Problem detection functions
    function hasFailedPosts(publication: PublicationWithRelations): boolean {
        if (!publication.posts || publication.posts.length === 0) return false
        return publication.posts.some((post: any) => post.status === 'FAILED')
    }

    function hasChannelProblems(publication: PublicationWithRelations): boolean {
        if (!publication.posts || publication.posts.length === 0) return false
        return publication.posts.some((post: any) => {
            const channel = post.channel
            if (!channel) return false
            
            const hasNoCredentials = !channel.credentials || Object.keys(channel.credentials).length === 0
            const isStale = channel.isStale === true
            const isInactive = channel.isActive === false
            
            return hasNoCredentials || isStale || isInactive
        })
    }

    function getPublicationProblems(publication: PublicationWithRelations) {
        const problems: Array<{ type: 'critical' | 'warning', key: string, count?: number }> = []
        
        // Check publication status
        if (publication.status === 'FAILED') {
            problems.push({ type: 'critical', key: 'allPostsFailed' })
        }
        
        if (publication.status === 'PARTIAL') {
            const failedCount = publication.posts?.filter((p: any) => p.status === 'FAILED').length || 0
            problems.push({ type: 'warning', key: 'somePostsFailed', count: failedCount })
        }
        
        if (publication.status === 'EXPIRED') {
            problems.push({ type: 'warning', key: 'publicationExpired' })
        }

        // Check if any post failed regardless of publication status
        const failedPostsCount = publication.posts?.filter((p: any) => p.status === 'FAILED').length || 0
        if (failedPostsCount > 0 && publication.status !== 'FAILED' && publication.status !== 'PARTIAL') {
            problems.push({ type: 'warning', key: 'postsHaveErrors', count: failedPostsCount })
        }

        // Check for channel problems (missing credentials, inactive, etc)
        if (hasChannelProblems(publication)) {
            problems.push({ type: 'critical', key: 'channelProblems' })
        }
        
        return problems
    }

    function getPublicationProblemLevel(publication: PublicationWithRelations): 'critical' | 'warning' | null {
        const problems = getPublicationProblems(publication)
        if (problems.some(p => p.type === 'critical')) return 'critical'
        if (problems.some(p => p.type === 'warning')) return 'warning'
        return null
    }

    function getPostProblemLevel(post: any): 'critical' | 'warning' | null {
        // Check post status
        if (post.status === 'FAILED') {
            return 'critical'
        }
        
        // Check channel problems
        const channel = post.channel
        if (channel) {
            const hasNoCredentials = !channel.credentials || Object.keys(channel.credentials).length === 0
            if (hasNoCredentials) return 'critical'
            
            const isStale = channel.isStale === true
            const isInactive = channel.isActive === false
            if (isStale || isInactive) return 'warning'
        }
        
        return null
    }

    return {
        publications,
        currentPublication,
        isLoading,
        error,
        totalCount,
        statusOptions,
        fetchPublicationsByProject,
        fetchUserPublications,
        fetchPublication,
        createPublication,
        updatePublication,
        deletePublication,
        createPostsFromPublication,
        getStatusDisplayName,
        getStatusColor,
        toggleArchive,
        // Problem detection
        hasFailedPosts,
        hasChannelProblems,
        getPublicationProblems,
        getPublicationProblemLevel,
        getPostProblemLevel,
    }
}

