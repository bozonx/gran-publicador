import { storeToRefs } from 'pinia';
import { usePublicationsStore } from '~/stores/publications';

export function usePublicationState() {
  const store = usePublicationsStore();
  const { 
    items: publications, 
    currentPublication, 
    isLoading, 
    error, 
    totalCount, 
    totalUnfilteredCount 
  } = storeToRefs(store);

  return {
    publications,
    currentPublication,
    isLoading,
    error,
    totalCount,
    totalUnfilteredCount,
    // Add store reference for setters if needed
    store
  };
}
