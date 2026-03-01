import { ref, computed, watch, toRaw } from 'vue';
import type { ContentCollection } from '~/composables/useContentCollections';
import { useContentCollections } from '~/composables/useContentCollections';
import { useProjects } from '~/composables/useProjects';
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree';

export interface UseContentDestinationOptions {
  initialScope?: 'personal' | 'project';
  initialProjectId?: string | null;
  initialCollectionId?: string | null;
  initialGroupId?: string | null;
  /** Whether to fetch projects on init */
  fetchProjectsOnInit?: boolean;
}

export const useContentDestination = (options: UseContentDestinationOptions = {}) => {
  const { listCollections } = useContentCollections();
  const { fetchProjects: apiFetchProjects } = useProjects();
  const { t } = useI18n();

  // State
  const scope = ref<'personal' | 'project'>(options.initialScope || 'personal');
  const projectId = ref<string | null>(options.initialProjectId || null);
  const collectionId = ref<string | null>(options.initialCollectionId || null);
  const groupId = ref<string | null>(options.initialGroupId || null);
  
  const projects = ref<any[]>([]);
  const collections = ref<ContentCollection[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

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
      projects.value = await apiFetchProjects({ hasContentCollections: true });
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchCollections = async () => {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const result = await listCollections(scope.value, projectId.value || undefined);
      collections.value = result || [];
      
      // If current collectionId is not in the new list, reset it
      if (collectionId.value && !collections.value.some(c => c.id === collectionId.value)) {
        collectionId.value = null;
        groupId.value = null;
      }
    } catch (err) {
      console.error('Failed to load collections', err);
      collections.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // Watchers
  watch(scope, () => {
    if (scope.value === 'personal') {
      projectId.value = null;
    }
    collectionId.value = null;
    groupId.value = null;
    fetchCollections();
  });

  watch(projectId, () => {
    if (scope.value === 'project') {
      collectionId.value = null;
      groupId.value = null;
      fetchCollections();
    }
  });

  watch(collectionId, () => {
    groupId.value = null;
  });

  // Init
  if (options.fetchProjectsOnInit) {
    fetchProjects();
  }
  
  // Initial fetch of collections if initial state allows
  if (scope.value === 'personal' || (scope.value === 'project' && projectId.value)) {
    fetchCollections();
  }

  return {
    // State
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
  };
};
