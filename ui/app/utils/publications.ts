import { stripHtmlAndSpecialChars } from './text';
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
 * Internal mapping of status to semantic UI color and legacy Tailwind color
 */
const STATUS_UI_CONFIG: Record<string, { color: 'neutral' | 'warning' | 'info' | 'primary' | 'success' | 'error', tw: string, icon: string }> = {
  DRAFT: { color: 'neutral', tw: 'neutral', icon: 'i-heroicons-pencil-square' },
  READY: { color: 'warning', tw: 'amber', icon: 'i-heroicons-check' },
  SCHEDULED: { color: 'info', tw: 'sky', icon: 'i-heroicons-clock' },
  PROCESSING: { color: 'primary', tw: 'indigo', icon: 'i-heroicons-arrow-path' },
  PUBLISHED: { color: 'success', tw: 'emerald', icon: 'i-heroicons-check-circle' },
  PARTIAL: { color: 'error', tw: 'rose', icon: 'i-heroicons-exclamation-triangle' },
  FAILED: { color: 'error', tw: 'rose', icon: 'i-heroicons-exclamation-circle' },
  EXPIRED: { color: 'error', tw: 'rose', icon: 'i-heroicons-clock' },
}

/**
 * Get color for publication status based on Nuxt UI semantic colors
 */
export function getStatusUiColor(status: string): 'neutral' | 'warning' | 'info' | 'primary' | 'success' | 'error' {
  if (!status) return 'neutral'
  return STATUS_UI_CONFIG[status.toUpperCase()]?.color || 'neutral'
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
export function getStatusTailwindColor(status: string): string {
  if (!status) return 'neutral'
  return STATUS_UI_CONFIG[status.toUpperCase()]?.tw || 'neutral'
}

export function getStatusClass(status: string): string {
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

export function getStatusIcon(status: string): string {
  if (!status) return 'i-heroicons-check'
  return STATUS_UI_CONFIG[status.toUpperCase()]?.icon || 'i-heroicons-check'
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

export function getPublicationDisplayTitle(publication: any, t: (key: string) => string): string {
  if (publication.title) {
    return stripHtmlAndSpecialChars(publication.title);
  }
  if (publication.content) {
    const cleaned = stripHtmlAndSpecialChars(publication.content);
    if (cleaned) return cleaned;
  }
  return t('post.untitled');
}

export function getPublicationAuthorName(publication: any, t: (key: string) => string): string {
  const creator = publication.creator;
  if (!creator) return '';
  return creator.fullName || creator.telegramUsername || t('common.unknown');
}
