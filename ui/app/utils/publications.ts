import type { PublicationStatus } from '~/types/posts'

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
 * Get color for publication status
 * DRAFT - orange
 * READY - yellow
 * SCHEDULED - sky (light blue)
 * PROCESSING - blue
 * PUBLISHED - green
 * PARTIAL, FAILED, EXPIRED - red
 */
export function getStatusColor(status: PublicationStatus): string {
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
  const color = getStatusColor(status)
  
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
