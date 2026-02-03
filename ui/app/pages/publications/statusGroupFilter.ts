import type { PublicationStatus } from '~/types/posts';

export type PublicationsStatusGroupFilter = 'active' | 'draft' | 'ready' | 'problematic' | PublicationStatus;

export function mapStatusGroupToApiStatus(
  group: PublicationsStatusGroupFilter,
): PublicationStatus | PublicationStatus[] {
  if (group === 'draft' || group === 'DRAFT') return 'DRAFT';
  if (group === 'ready' || group === 'READY') return 'READY';
  if (group === 'problematic') return ['FAILED', 'PARTIAL', 'EXPIRED'];
  if (group === 'active') return ['SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'PARTIAL', 'EXPIRED'];
  
  return group as PublicationStatus;
}
