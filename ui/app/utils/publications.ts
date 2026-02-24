import type { PublicationStatus } from '~/types/posts'
import type { PublicationWithRelations, PublicationProblem } from '~/types/publications'

export interface StatusOption {
  value: string;
  label: string;
}

export function getUserSelectableStatuses(t: (key: string) => string): StatusOption[] {
  return [
    { value: 'DRAFT', label: t('publicationStatus.draft') },
    { value: 'READY', label: t('publicationStatus.ready') }
  ];
}

/**
 * Get color for publication status based on Nuxt UI semantic colors
 */
export function getStatusUiColor(status: string): 'neutral' | 'warning' | 'info' | 'primary' | 'success' | 'error' {
  if (!status) return 'neutral'
  
  const s = status.toUpperCase()
  switch (s) {
    case 'DRAFT':
      return 'neutral'
    case 'READY':
      return 'warning'
    case 'SCHEDULED':
      return 'info'
    case 'PROCESSING':
      return 'primary'
    case 'PUBLISHED':
      return 'success'
    case 'PARTIAL':
    case 'FAILED':
    case 'EXPIRED':
      return 'error'
    default:
      return 'neutral'
  }
}

/**
 * Get display name for status
 */
export function getStatusDisplayName(status: string, t: (key: string) => string): string {
  if (!status) return '-'
  return t(`publicationStatus.${status.toLowerCase()}`)
}

/**
 * Legacy/Custom Tailwind colors for specific UI elements
 */
export function getStatusTailwindColor(status: PublicationStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'READY':
      return 'amber'
    case 'SCHEDULED':
      return 'sky'
    case 'PROCESSING':
      return 'indigo'
    case 'PUBLISHED':
      return 'emerald'
    case 'PARTIAL':
    case 'FAILED':
    case 'EXPIRED':
      return 'rose'
    default:
      return 'neutral'
  }
}

export function getStatusClass(status: PublicationStatus): string {
  const color = getStatusTailwindColor(status)
  
  switch (color) {
    case 'neutral':
      return 'bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900 ring-0!'
    case 'amber':
      return 'bg-amber-500 text-white ring-0!'
    case 'sky':
      return 'bg-sky-500 text-white ring-0!'
    case 'indigo':
      return 'bg-indigo-600 text-white ring-0!'
    case 'emerald':
      return 'bg-emerald-500 text-white ring-0!'
    case 'rose':
      return 'bg-rose-500 text-white ring-0!'
    default:
      return 'bg-gray-500 text-white ring-0!'
  }
}

export function getStatusIcon(status: PublicationStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'i-heroicons-pencil-square'
    case 'READY':
      return 'i-heroicons-check'
    case 'SCHEDULED':
      return 'i-heroicons-clock'
    case 'PROCESSING':
      return 'i-heroicons-arrow-path'
    case 'PUBLISHED':
      return 'i-heroicons-check-circle'
    case 'PARTIAL':
      return 'i-heroicons-exclamation-triangle'
    case 'FAILED':
      return 'i-heroicons-exclamation-circle'
    case 'EXPIRED':
      return 'i-heroicons-clock'
    default:
      return 'i-heroicons-check'
  }
}

/**
 * Detect problems for a publication
 */
export function getPublicationProblems(publication: PublicationWithRelations): PublicationProblem[] {
  const problems: PublicationProblem[] = []

  // Skip if no posts array
  if (!publication.posts) return problems

  // Check if any post failed regardless of publication status
  const failedPostsCount = publication.posts.filter((p: any) => p.status === 'FAILED').length
  
  if (
    failedPostsCount > 0 &&
    publication.status !== 'FAILED' &&
    publication.status !== 'PARTIAL'
  ) {
    problems.push({ type: 'warning', key: 'postsHaveErrors', count: failedPostsCount })
  }

  // Check publication status
  if (publication.status === 'EXPIRED') {
    problems.push({ type: 'warning', key: 'publicationExpired' })
  }

  if (publication.status === 'PARTIAL') {
    const failedCount = publication.posts.filter((p: any) => p.status === 'FAILED').length
    problems.push({ type: 'warning', key: 'somePostsFailed', count: failedCount })
  }

  if (publication.status === 'FAILED') {
    problems.push({ type: 'critical', key: 'allPostsFailed' })
  }

  return problems
}

/**
 * Get overall problem level
 */
export function getPublicationProblemLevel(
  publication: PublicationWithRelations,
): 'critical' | 'warning' | null {
  const problems = getPublicationProblems(publication)
  if (problems.some(p => p.type === 'critical')) return 'critical'
  if (problems.some(p => p.type === 'warning')) return 'warning'
  return null
}

/**
 * Get problem level for a single post
 */
export function getPostProblemLevel(post: any): 'critical' | 'warning' | null {
  if (post.status === 'FAILED') {
    return 'critical'
  }
  return null
}
