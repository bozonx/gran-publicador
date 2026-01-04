import type { PostStatus, PostType } from '~/types/posts'

export const POST_STATUS_COLORS: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
    pending: 'neutral',
    published: 'success',
    failed: 'error',
}

export function getPostStatusColor(status: string | undefined | null): 'neutral' | 'warning' | 'success' | 'error' {
    if (!status) return 'neutral'
    return POST_STATUS_COLORS[status.toLowerCase()] || 'neutral'
}

export function getPostStatusOptions(t: (key: string) => string) {
    return [
        { value: 'PENDING', label: t('postStatus.pending') },
        { value: 'PUBLISHED', label: t('postStatus.published') },
        { value: 'FAILED', label: t('postStatus.failed') },
    ]
}

export function getPostTypeOptions(t: (key: string) => string) {
    return [
        { value: 'POST', label: t('postType.post') },
        { value: 'ARTICLE', label: t('postType.article') },
        { value: 'NEWS', label: t('postType.news') },
        { value: 'VIDEO', label: t('postType.video') },
        { value: 'SHORT', label: t('postType.short') },
    ]
}

export function getPostStatusDisplayName(status: string | undefined | null, t: (key: string) => string): string {
    if (!status) return '-'
    return t(`postStatus.${status.toLowerCase()}`)
}

export function getPostTypeDisplayName(type: string | undefined | null, t: (key: string) => string): string {
    if (!type) return '-'
    return t(`postType.${type.toLowerCase()}`)
}
