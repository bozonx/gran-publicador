import { useState } from '#imports';
import type { PublicationWithRelations } from '~/types/publications';

export function usePublicationState() {
  const publications = useState<PublicationWithRelations[]>('usePublications.publications', () => []);
  const currentPublication = useState<PublicationWithRelations | null>(
    'usePublications.currentPublication',
    () => null,
  );
  const isLoading = useState<boolean>('usePublications.isLoading', () => false);
  const error = useState<string | null>('usePublications.error', () => null);
  const totalCount = useState<number>('usePublications.totalCount', () => 0);
  const totalUnfilteredCount = useState<number>('usePublications.totalUnfilteredCount', () => 0);

  return {
    publications,
    currentPublication,
    isLoading,
    error,
    totalCount,
    totalUnfilteredCount,
  };
}
