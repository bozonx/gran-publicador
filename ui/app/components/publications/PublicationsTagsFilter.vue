<script setup lang="ts">
import {
  createSearchRequestTracker,
  resolveTagSearchScope,
} from '~/utils/common-input-tags';
import {
  appendPublicationTagsFromInput,
  mergePublicationTagSuggestions,
} from '~/utils/publication-tags-filter';
import { normalizeTags, parseTags } from '~/utils/tags';

const props = withDefaults(
  defineProps<{
    modelValue: string | string[] | null | undefined;
    publicationTags?: string[];
    placeholder?: string;
    projectId?: string;
    userId?: string;
    scope?: 'personal' | 'project';
    groupId?: string;
    searchEndpoint?: string;
    disabled?: boolean;
    class?: any;
  }>(),
  {
    placeholder: '',
    publicationTags: () => [],
    searchEndpoint: '/publications/tags/search',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();
const api = useApi();
const toast = useToast();

const TAG_LIMIT = 50;

const loading = ref(false);
const searchTerm = ref('');
const remoteItems = ref<string[]>([]);
const searchRequestTracker = createSearchRequestTracker();
const activeSearchController = ref<AbortController | null>(null);
const hasShownScopeConflictWarning = ref(false);

function coerceModelValueToArray(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseTags(value);
  return [];
}

const value = computed<string[]>({
  get() {
    return normalizeTags(coerceModelValueToArray(props.modelValue), { limit: TAG_LIMIT });
  },
  set(next) {
    const normalized = normalizeTags(next, { limit: TAG_LIMIT });
    emit('update:modelValue', normalized.join(','));
  },
});

const items = computed(() => {
  return mergePublicationTagSuggestions({
    selectedTags: value.value,
    localTags: props.publicationTags,
    remoteTags: remoteItems.value,
    searchTerm: searchTerm.value,
  });
});

function resolveSearchScope() {
  return resolveTagSearchScope({
    projectId: props.projectId,
    userId: props.userId,
  });
}

async function searchTags(q: string, signal?: AbortSignal) {
  if (!q || q.length < 1) return [];

  if (props.scope) {
    try {
      const res = await api.get<{ name: string }[]>(props.searchEndpoint, {
        signal,
        params: {
          q,
          scope: props.scope,
          projectId: props.scope === 'project' ? props.projectId : undefined,
          groupId: props.groupId,
          limit: 20,
        },
      });

      return normalizeTags(res.map(tag => tag.name), { limit: TAG_LIMIT });
    } catch (err) {
      if ((err as { message?: string }).message === 'Request aborted') {
        return [];
      }

      console.error('Failed to search tags:', err);
      toast.add({
        title: t('common.error'),
        description: t('common.unexpectedError'),
        color: 'error',
      });
      return [];
    }
  }

  const resolvedScope = resolveSearchScope();
  if (resolvedScope.reason !== 'ok') {
    if (resolvedScope.reason === 'conflict' && !hasShownScopeConflictWarning.value) {
      if (import.meta.dev) {
        console.warn(
          'PublicationsTagsFilter: both projectId and userId were provided, expected exactly one',
        );
      }

      toast.add({
        title: t('common.warning'),
        description: t('post.tagsScopeInvalid'),
        color: 'warning',
      });
      hasShownScopeConflictWarning.value = true;
    }

    return [];
  }

  hasShownScopeConflictWarning.value = false;

  try {
    const res = await api.get<{ name: string }[]>(props.searchEndpoint, {
      signal,
      params: {
        q,
        ...resolvedScope.scope,
        groupId: props.groupId,
        limit: 20,
      },
    });

    return normalizeTags(res.map(tag => tag.name), { limit: TAG_LIMIT });
  } catch (err) {
    if ((err as { message?: string }).message === 'Request aborted') {
      return [];
    }

    console.error('Failed to search tags:', err);
    toast.add({
      title: t('common.error'),
      description: t('common.unexpectedError'),
      color: 'error',
    });
    return [];
  }
}

function appendTagsFromRawInput(rawInput: string) {
  const result = appendPublicationTagsFromInput(value.value, rawInput, TAG_LIMIT);
  if (!result.hasAddedTags) return false;

  value.value = result.nextTags;
  return true;
}

function onKeydownAddTag(event: KeyboardEvent) {
  if (event.isComposing) return;

  const isComma = event.key === ',' || event.code === 'Comma';
  const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
  if (!isComma && !isEnter) return;

  const nextTagInput = searchTerm.value.trim();
  if (!nextTagInput) return;

  event.preventDefault();

  const hasAdded = appendTagsFromRawInput(nextTagInput);
  if (hasAdded) {
    searchTerm.value = '';
  }
}

function onPasteTags(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData('text') ?? '';
  if (!pastedText.trim()) return;

  const hasAdded = appendTagsFromRawInput(pastedText);
  if (!hasAdded) return;

  event.preventDefault();
  searchTerm.value = '';
}

const debouncedSearch = useDebounceFn(async () => {
  const q = searchTerm.value.trim();
  if (!q) return;

  activeSearchController.value?.abort();
  const nextController = api.createAbortController();
  activeSearchController.value = nextController;

  const requestId = searchRequestTracker.next();
  loading.value = true;

  try {
    const result = await searchTags(q, nextController.signal);
    if (!searchRequestTracker.isLatest(requestId)) return;

    remoteItems.value = result;
  } finally {
    if (searchRequestTracker.isLatest(requestId)) {
      loading.value = false;
    }
  }
}, 200);

watch(searchTerm, () => {
  if (!searchTerm.value.trim()) {
    searchRequestTracker.invalidate();
    activeSearchController.value?.abort();
    activeSearchController.value = null;
    loading.value = false;
    remoteItems.value = [];
    return;
  }

  debouncedSearch();
});

onBeforeUnmount(() => {
  activeSearchController.value?.abort();
});
</script>

<template>
  <UInputMenu
    v-model="value"
    v-model:search-term="searchTerm"
    multiple
    :items="items"
    ignore-filter
    :placeholder="placeholder"
    :class="$props.class"
    :disabled="disabled"
    :loading="loading"
    icon="i-heroicons-tag"
    @paste.capture="onPasteTags"
    @keydown.capture="onKeydownAddTag"
  />
</template>
