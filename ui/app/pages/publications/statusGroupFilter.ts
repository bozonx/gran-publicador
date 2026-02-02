import type { PublicationStatus } from '~/types/posts'

export type PublicationsStatusGroupFilter = 'active' | 'draft' | 'ready' | 'problematic' | 'all'

export function mapStatusGroupToApiStatus(
  group: PublicationsStatusGroupFilter
): PublicationStatus | PublicationStatus[] | null {
  if (group === 'all') return null
  if (group === 'draft') return 'DRAFT'
  if (group === 'ready') return 'READY'
  if (group === 'problematic') return ['FAILED', 'PARTIAL', 'EXPIRED']
  return ['SCHEDULED', 'PUBLISHED', 'PROCESSING']
}
