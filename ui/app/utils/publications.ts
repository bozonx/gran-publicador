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
      return 'orange'
    case 'READY':
      return 'yellow'
    case 'SCHEDULED':
      return 'sky'
    case 'PROCESSING':
      return 'blue'
    case 'PUBLISHED':
      return 'green'
    case 'PARTIAL':
    case 'FAILED':
    case 'EXPIRED':
      return 'red'
    default:
      return 'neutral'
  }
}
