import { ref, computed } from 'vue'
import { ArchiveEntityType } from '~/types/archive.types'
import type { PostStatus, PostType, PublicationStatus } from '~/types/posts'
import {
    getPostStatusOptions,
    getPostTypeOptions,
    getPostStatusDisplayName,
    getPostTypeDisplayName,
    getPostStatusColor,
    getPostStatusIcon
} from '~/utils/posts'

export type { PostStatus, PostType } from '~/types/posts'

export interface Post {
  id: string
  channelId: string
  publicationId: string
  socialMedia: string
  tags: string | null  // Can override publication tags
  status: PostStatus  // Post-specific status
  scheduledAt: string | null
  publishedAt: string | null
  errorMessage: string | null
  meta: any
  template: any // Store template selection { id: string } or null
  content: string | null
  authorSignature: string | null
  platformOptions: any
  createdAt: string
  updatedAt: string
}

export interface PostWithRelations extends Post {
  channel?: {
    id: string
    name: string
    projectId: string
    socialMedia: string
    language: string
  } | null
  publication?: {
    id: string
    title: string | null
    description: string | null
    content: string
    authorComment: string | null
    tags: string | null // Fallback if post.tags is null
    mediaFiles: string
    meta: string
    postType: string
    postDate: string | null
    status: string // Publication status
    language: string
    createdBy: string | null
    scheduledAt: string | null
    archivedAt: string | null
  } | null
}

export interface PostCreateInput {
  channelId: string
  publicationId: string  // Required
  tags?: string | null  // Override publication tags
  status?: PostStatus | null
  scheduledAt?: string | null
  content?: string | null
  meta?: any // Additional metadata
  template?: any
  authorSignature?: string | null
  platformOptions?: any
}

export interface PostUpdateInput {
  tags?: string | null  // Update tags
  status?: PostStatus  // Update status
  scheduledAt?: string | null
  publishedAt?: string | null
  content?: string | null
  meta?: any // Update metadata
  template?: any
  authorSignature?: string | null
  platformOptions?: any
}

export interface PostsFilter {
    status?: PostStatus | null
    postType?: PostType | null
    createdBy?: string | null
    channelId?: string | null
    search?: string
    limit?: number
    page?: number
    includeArchived?: boolean
    publicationStatus?: PublicationStatus | PublicationStatus[] | null
}

export function usePosts() {
    const api = useApi()
    const { user } = useAuth()
    const { t } = useI18n()
    const toast = useToast()
    const { archiveEntity, restoreEntity } = useArchive()

    const posts = ref<PostWithRelations[]>([])
    const currentPost = ref<PostWithRelations | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const filter = ref<PostsFilter>({})
    const totalCount = ref(0)

    async function fetchPostsByProject(projectId: string, options?: Partial<PostsFilter>): Promise<PostWithRelations[]> {
        isLoading.value = true
        error.value = null

        try {
            const params: Record<string, any> = { ...options }

            if (filter.value.channelId) {
                params.channelId = filter.value.channelId
            } else {
                params.projectId = projectId
            }

            if (filter.value.status) params.status = filter.value.status
            if (filter.value.postType) params.postType = filter.value.postType
            if (filter.value.search) params.search = filter.value.search
            if (filter.value.createdBy) params.createdBy = filter.value.createdBy
            if (filter.value.limit) params.limit = filter.value.limit
            if (filter.value.page) params.page = filter.value.page
            if (filter.value.includeArchived) params.includeArchived = true
            if (filter.value.publicationStatus) params.publicationStatus = filter.value.publicationStatus

            const data = await api.get<PostWithRelations[]>('/posts', { params })
            posts.value = data
            return data
        } catch (err: any) {
            console.error('[usePosts] fetchPostsByProject error:', err)
            posts.value = []
            return []
        } finally {
            isLoading.value = false
        }
    }

    async function fetchUserPosts(options?: Partial<PostsFilter>): Promise<PostWithRelations[]> {
        isLoading.value = true
        error.value = null

        try {
            const params: Record<string, any> = { ...options }

            if (filter.value.status) params.status = filter.value.status
            if (filter.value.postType) params.postType = filter.value.postType
            if (filter.value.search) params.search = filter.value.search
            if (filter.value.createdBy) params.createdBy = filter.value.createdBy
            if (filter.value.limit) params.limit = filter.value.limit
            if (filter.value.page) params.page = filter.value.page
            if (filter.value.includeArchived) params.includeArchived = true
            if (filter.value.publicationStatus) params.publicationStatus = filter.value.publicationStatus

            const data = await api.get<PostWithRelations[]>('/posts', { params })
            posts.value = data
            totalCount.value = data.length // Crude total count for now
            return data
        } catch (err: any) {
            console.error('[usePosts] fetchUserPosts error:', err)
            posts.value = []
            return []
        } finally {
            isLoading.value = false
        }
    }

    async function fetchPost(postId: string): Promise<PostWithRelations | null> {
        isLoading.value = true
        error.value = null

        try {
            const data = await api.get<PostWithRelations>(`/posts/${postId}`)
            currentPost.value = data
            return data
        } catch (err: any) {
            console.error('[usePosts] fetchPost error:', err)
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function createPost(data: PostCreateInput, options?: { silent?: boolean }): Promise<Post | null> {
        isLoading.value = true
        error.value = null

        try {
            // Transform tags if they are an array
            const payload = { ...data }
            if (Array.isArray(payload.tags)) {
                payload.tags = payload.tags.join(', ')
            }

            const post = await api.post<Post>('/posts', payload)
            
            if (!options?.silent) {
                toast.add({
                    title: t('common.success'),
                    description: t('post.createSuccess'),
                    color: 'success',
                })
            }
            return post
        } catch (err: any) {
            const message = err.message || 'Failed to create post'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function updatePost(postId: string, data: PostUpdateInput, options?: { silent?: boolean }): Promise<Post | null> {
        isLoading.value = true
        error.value = null

        try {
            // Transform tags if they are an array
            const payload = { ...data }
            if (Array.isArray(payload.tags)) {
                payload.tags = payload.tags.join(', ')
            }

            const post = await api.patch<Post>(`/posts/${postId}`, payload)
            
            if (!options?.silent) {
                toast.add({
                    title: t('common.success'),
                    description: t('post.updateSuccess'),
                    color: 'success',
                })
            }
            return post
        } catch (err: any) {
            const message = err.message || 'Failed to update post'
            if (!options?.silent) {
                toast.add({
                    title: t('common.error'),
                    description: message,
                    color: 'error',
                })
            }
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function deletePost(postId: string): Promise<boolean> {
        isLoading.value = true
        error.value = null

        try {
            await api.delete(`/posts/${postId}`)
            toast.add({
                title: t('common.success'),
                description: t('post.deleteSuccess'),
                color: 'success',
            })
            return true
        } catch (err: any) {
            const message = err.message || 'Failed to delete post'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return false
        } finally {
            isLoading.value = false
        }
    }

    // Pagination
    const pagination = ref({
        page: 1,
        limit: 10,
    })
    const totalPages = computed(() => Math.ceil(totalCount.value / pagination.value.limit))

    function setPage(page: number) {
        pagination.value.page = page
    }

    // Filters
    function setFilter(newFilter: Partial<PostsFilter>) {
        filter.value = { ...filter.value, ...newFilter }
        pagination.value.page = 1 // Reset to first page on filter change
    }

    function clearFilter() {
        filter.value = {}
        pagination.value.page = 1
    }

    // Constants
    const statusOptions = computed(() => getPostStatusOptions(t))
    const typeOptions = computed(() => getPostTypeOptions(t))

    function canDelete(post: PostWithRelations): boolean {
        if (!user.value) return false
        // Allow deleting if user is author of the parent publication or if user is owner/admin of the project (logic can be refined)
        return post.publication?.createdBy === user.value.id
    }

    function canEdit(post: PostWithRelations): boolean {
        // Same logic as delete for now
        return canDelete(post)
    }

    function clearCurrentPost() {
        currentPost.value = null
        error.value = null
    }

    return {
        posts,
        currentPost,
        isLoading,
        error,
        filter,
        totalCount,
        pagination,
        totalPages,
        statusOptions,
        typeOptions,
        fetchPostsByProject,
        fetchUserPosts,
        fetchPost,
        createPost,
        updatePost,
        deletePost,
        setFilter,
        clearFilter,
        setPage,
        getStatusDisplayName: (status: string) => getPostStatusDisplayName(status, t),
        getTypeDisplayName: (type: string) => getPostTypeDisplayName(type, t),
        getStatusColor: getPostStatusColor,
        getStatusIcon: getPostStatusIcon,
        canDelete,
        canEdit,
        clearCurrentPost,
    }
}

// Utility functions to access publication data from post
export function getPostTitle(post: PostWithRelations): string | null {
  return post.publication?.title ?? null
}

export function getPostContent(post: PostWithRelations): string {
  return post.content ?? post.publication?.content ?? ''
}

export function getPostTags(post: PostWithRelations): string | null {
  // Priority: post tags > publication tags
  return post.tags ?? post.publication?.tags ?? null
}

export function getPostDescription(post: PostWithRelations): string | null {
  return post.publication?.description ?? null
}

export function getPostType(post: PostWithRelations): string {
  return post.publication?.postType ?? 'POST'
}

export function getPostLanguage(post: PostWithRelations): string {
  return post.publication?.language ?? 'en-US'
}

export function getPostScheduledAt(post: PostWithRelations): string | null {
  // Priority: post scheduledAt > publication scheduledAt
  return post.scheduledAt ?? post.publication?.scheduledAt ?? null
}
