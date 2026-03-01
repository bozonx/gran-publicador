import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { ContentCollection } from '~/composables/useContentCollections';
import { useContentCollections } from '~/composables/useContentCollections';
import { useProjects } from '~/composables/useProjects';
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree';
import { useContentDestinationStore, type DestinationScope } from '~/stores/content-destination';

export interface UseContentDestinationOptions {
  initialScope?: DestinationScope;
  initialProjectId?: string | null;
  initialCollectionId?: string | null;
  initialGroupId?: string | null;
  /** Whether to fetch projects on init */
  fetchProjectsOnInit?: boolean;
}

export const useContentDestination = (options: UseContentDestinationOptions = {}) => {
  const store = useContentDestinationStore();
  const { 
    scope, 
    projectId, 
    collectionId, 
    groupId, 
    projects, 
    collections, 
    isLoading, 
    error 
  } = storeToRefs(store);

  const { listCollections } = useContentCollections();
  const { fetchProjects: apiFetchProjects } = useProjects();
  const { t } = useI18n();

  // Initialize store state from options if provided
  if (options.initialScope) store.setScope(options.initialScope);
  if (options.initialProjectId) store.setProjectId(options.initialProjectId);
  if (options.initialCollectionId) store.setCollectionId(options.initialCollectionId);
  if (options.initialGroupId) store.setGroupId(options.initialGroupId);

  // Computed
  const projectOptions = computed(() => {
    return projects.value.map((p) => ({ value: p.id, label: p.name }));
  });

  const scopeOptions = computed(() => [
    { value: 'personal', label: t('contentLibrary.moveModal.personal') },
    { value: 'project', label: t('contentLibrary.moveModal.project', 'Project') },
  ]);

  const collectionOptions = computed(() => {
    return collections.value
      .filter((c) => !c.parentId && (c.type === 'GROUP' || c.type === 'SAVED_VIEW'))
      .map((c) => ({ value: c.id, label: c.title, collectionType: c.type }));
  });

  const selectedCollection = computed(() => {
    return collections.value.find((c) => c.id === collectionId.value) || null;
  });

  const subGroupTreeItems = computed<ContentLibraryTreeItem[]>(() => {
    if (!selectedCollection.value || selectedCollection.value.type !== 'GROUP') return [];
    return buildGroupTreeFromRoot({
      rootId: selectedCollection.value.id,
      allGroupCollections: collections.value,
      labelFn: (c) => c.title,
    });
  });

  // Actions
  const fetchProjects = async () => {
    try {
      const result = await apiFetchProjects({ hasContentCollections: true });
      store.setProjects(result);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchCollections = async () => {
    if (isLoading.value) return;
    store.setLoading(true);
    try {
      const result = await listCollections(scope.value, projectId.value || undefined);
      store.setCollections(result || []);
      
      // If current collectionId is not in the new list, reset it
      if (collectionId.value && !collections.value.some(c => c.id === collectionId.value)) {
        store.setCollectionId(null);
        store.setGroupId(null);
      }
    } catch (err) {
      console.error('Failed to load collections', err);
      store.setCollections([]);
    } finally {
      store.setLoading(false);
    }
  };

  // Watchers
  watch(scope, () => {
    if (scope.value === 'personal') {
      store.setProjectId(null);
    }
    store.setCollectionId(null);
    store.setGroupId(null);
    fetchCollections();
  });

  watch(projectId, (newVal) => {
    if (scope.value === 'project') {
      store.setCollectionId(null);
      store.setGroupId(null);
      if (newVal) fetchCollections();
    }
  });

  watch(collectionId, () => {
    store.setGroupId(null);
  });

  // Init
  if (options.fetchProjectsOnInit && projects.value.length === 0) {
    fetchProjects();
  }
  
  // Initial fetch of collections if initial state allows and list is empty
  if (collections.value.length === 0) {
    if (scope.value === 'personal' || (scope.value === 'project' && projectId.value)) {
      fetchCollections();
    }
  }

  return {
    // State from store
    scope,
    projectId,
    collectionId,
    groupId,
    projects,
    collections,
    isLoading,
    error,
    
    // Computed
    projectOptions,
    scopeOptions,
    collectionOptions,
    subGroupTreeItems,
    selectedCollection,
    
    // Actions
    fetchProjects,
    fetchCollections,
    setScope: store.setScope,
    setProjectId: store.setProjectId,
    setCollectionId: store.setCollectionId,
    setGroupId: store.setGroupId,
  };
};
