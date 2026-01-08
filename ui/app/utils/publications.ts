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

export function getStatusClass(status: PublicationStatus): string {
  const color = getStatusColor(status)
  // Using !important to ensure override of default button styles if necessary, 
  // and ensuring the colors are picked up by Tailwind JIT by full string usage.
  switch (color) {
    case 'orange':
      return '!bg-orange-500 dark:!bg-orange-500 !text-white ring-1 ring-orange-500'
    case 'yellow':
      return '!bg-yellow-500 dark:!bg-yellow-500 !text-white ring-1 ring-yellow-500'
    case 'sky':
      return '!bg-sky-500 dark:!bg-sky-500 !text-white ring-1 ring-sky-500'
    case 'blue':
      return '!bg-blue-500 dark:!bg-blue-500 !text-white ring-1 ring-blue-500'
    case 'green':
      return '!bg-green-500 dark:!bg-green-500 !text-white ring-1 ring-green-500'
    case 'red':
      return '!bg-red-500 dark:!bg-red-500 !text-white ring-1 ring-red-500'
    default:
      return '!bg-gray-500 dark:!bg-gray-500 !text-white ring-1 ring-gray-500'
  }
}
