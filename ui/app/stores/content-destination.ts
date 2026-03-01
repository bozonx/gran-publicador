import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { ContentCollection } from '~/composables/useContentCollections';

export type DestinationScope = 'personal' | 'project';

/**
 * Content Destination store using Dumb Store pattern.
 */
export const useContentDestinationStore = defineStore('contentDestination', () => {
  // State
  const scope = ref<DestinationScope>('personal');
  const projectId = ref<string | null>(null);
  const collectionId = ref<string | null>(null);
  const groupId = ref<string | null>(null);
  
  const projects = ref<any[]>([]);
  const collections = ref<ContentCollection[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Actions
  function setScope(newScope: DestinationScope) {
    scope.value = newScope;
  }

  function setProjectId(id: string | null) {
    projectId.value = id;
  }

  function setCollectionId(id: string | null) {
    collectionId.value = id;
  }

  function setGroupId(id: string | null) {
    groupId.value = id;
  }

  function setProjects(newProjects: any[]) {
    projects.value = newProjects;
  }

  function setCollections(newCollections: ContentCollection[]) {
    collections.value = newCollections;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function reset() {
    scope.value = 'personal';
    projectId.value = null;
    collectionId.value = null;
    groupId.value = null;
    projects.value = [];
    collections.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    scope,
    projectId,
    collectionId,
    groupId,
    projects,
    collections,
    isLoading,
    error,
    setScope,
    setProjectId,
    setCollectionId,
    setGroupId,
    setProjects,
    setCollections,
    setLoading,
    setError,
    reset,
  };
});
