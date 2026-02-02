import type { PublicationStatus } from '~/types/posts';

export type PublicationsStatusGroupFilter = 'active' | 'draft' | 'ready' | 'problematic';

export function mapStatusGroupToApiStatus(
  group: PublicationsStatusGroupFilter,
): PublicationStatus | PublicationStatus[] {
  if (group === 'draft') return 'DRAFT';
  if (group === 'ready') return 'READY';
  if (group === 'problematic') return ['FAILED', 'PARTIAL', 'EXPIRED'];
  return ['SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'PARTIAL', 'EXPIRED'];
}
