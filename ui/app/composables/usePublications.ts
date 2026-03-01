import { usePublicationState } from './publications/usePublicationState';
import { usePublicationCrud } from './publications/usePublicationCrud';
import { usePublicationBulk } from './publications/usePublicationBulk';
import { usePublicationActions } from './publications/usePublicationActions';
import { usePublicationLlm } from './publications/usePublicationLlm';
import { usePublicationValidation } from './publications/usePublicationValidation';
import { usePublicationUi } from './publications/usePublicationUi';

// Re-export for backward compatibility with existing imports
export type { PublicationWithRelations } from '~/types/publications';

export function usePublications() {
  return {
    ...usePublicationState(),
    ...usePublicationCrud(),
    ...usePublicationBulk(),
    ...usePublicationActions(),
    ...usePublicationLlm(),
    ...usePublicationValidation(),
    ...usePublicationUi()
  };
}
