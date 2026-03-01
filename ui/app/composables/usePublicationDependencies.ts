import { ref, computed, watch, type Ref } from 'vue';
import type { ProjectAuthorSignature } from '~/types/author-signatures';
import type { PostType } from '~/types/posts';

interface UsePublicationDependenciesOptions {
  projectId: Ref<string>;
  language: Ref<string>;
  postType: Ref<PostType>;
}

/**
 * Composable to manage external dependencies for publication forms (channels, signatures, templates).
 * Handles fetching and synchronization when project or language changes.
 */
export function usePublicationDependencies(options: UsePublicationDependenciesOptions) {
  const { projectId, language, postType } = options;
  const { t } = useI18n();
  const { user } = useAuth();
  
  const { channels, fetchChannels, isLoading: isLoadingChannels } = useChannels();
  const { fetchByProject: fetchSignatures } = useAuthorSignatures();
  const { templates: allTemplates, fetchProjectTemplates, isLoading: isLoadingTemplates } = useProjectTemplates();
  
  const signatures = ref<ProjectAuthorSignature[]>([]);
  const isLoadingSignatures = ref(false);

  const filteredTemplates = computed(() => {
    return allTemplates.value.filter((tpl) => {
      const langMatch = !tpl.language || tpl.language === language.value;
      const typeMatch = !tpl.postType || tpl.postType === postType.value;
      return langMatch && typeMatch;
    });
  });

  const signatureOptions = computed(() => {
    const userLang = user.value?.language || 'en-US';
    const userId = user.value?.id;
    const userSigs = signatures.value.filter(sig => sig.userId === userId);
    return userSigs.map(sig => {
      const variant = sig.variants.find(v => v.language === userLang) || sig.variants[0];
      return { value: sig.id, label: variant?.content || sig.id };
    });
  });

  const templateOptions = computed(() => {
    return filteredTemplates.value.map(tpl => ({ value: tpl.id, label: tpl.name }));
  });

  async function loadAll() {
    if (!projectId.value) {
      channels.value = [];
      signatures.value = [];
      allTemplates.value = [];
      return;
    }

    isLoadingSignatures.value = true;
    try {
      const [, fetchedSigs] = await Promise.all([
        fetchChannels({ projectId: projectId.value }),
        fetchSignatures(projectId.value),
        fetchProjectTemplates(projectId.value),
      ]);
      signatures.value = fetchedSigs;
    } finally {
      isLoadingSignatures.value = false;
    }
  }

  // Watch for project changes to reload everything
  watch(projectId, () => {
    loadAll();
  }, { immediate: true });

  return {
    channels,
    signatures,
    allTemplates,
    filteredTemplates,
    templateOptions,
    signatureOptions,
    isLoading: computed(() => isLoadingChannels.value || isLoadingSignatures.value || isLoadingTemplates.value),
    loadAll,
  };
}
