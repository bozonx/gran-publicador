<script setup lang="ts">
import { useContentDestination } from '~/composables/useContentDestination';
import ContentGroupSelectTree from '../content/ContentGroupSelectTree.vue';

interface Props {
  showScope?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  /** Whether to show a button for Saved Views (non-GROUP collections) */
  allowSavedViews?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showScope: true,
  disabled: false,
  isLoading: false,
  allowSavedViews: false,
});

const scope = defineModel<'personal' | 'project'>('scope', { default: 'personal' });
const projectId = defineModel<string | null>('projectId', { default: null });
const collectionId = defineModel<string | null>('collectionId', { default: null });
const groupId = defineModel<string | null>('groupId', { default: null });

const emit = defineEmits<{
  (e: 'select-saved-view', collectionId: string): void;
}>();

const { t } = useI18n();

const {
  scope: internalScope,
  projectId: internalProjectId,
  collectionId: internalCollectionId,
  groupId: internalGroupId,
  isLoading: isDataLoading,
  scopeOptions,
  projectOptions,
  collectionOptions,
  subGroupTreeItems,
  selectedCollection,
} = useContentDestination({
  initialScope: scope.value,
  initialProjectId: projectId.value,
  initialCollectionId: collectionId.value,
  initialGroupId: groupId.value,
  fetchProjectsOnInit: true,
});

// Sync internal state to external models
watch(internalScope, (v) => scope.value = v);
watch(internalProjectId, (v) => projectId.value = v);
watch(internalCollectionId, (v) => collectionId.value = v);
watch(internalGroupId, (v) => groupId.value = v);

const projectSelection = computed({
  get: () => internalProjectId.value ?? undefined,
  set: (v) => internalProjectId.value = v ?? null
})

const collectionSelection = computed({
  get: () => internalCollectionId.value ?? undefined,
  set: (v) => internalCollectionId.value = v ?? null
})

const effectiveIsLoading = computed(() => props.isLoading || isDataLoading.value);

function handleSavedViewAction() {
  if (internalCollectionId.value) {
    emit('select-saved-view', internalCollectionId.value);
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Scope selector -->
    <UFormField v-if="showScope" :label="t('videoEditor.export.destination')">
      <AppButtonGroup
        v-model="internalScope"
        :options="scopeOptions"
        :disabled="disabled"
      />
    </UFormField>

    <UFormField
      v-if="internalScope === 'project'"
      :label="t('project.title')"
    >
      <USelectMenu
        v-model="projectSelection"
        :items="projectOptions"
        value-key="value"
        label-key="label"
        searchable
        :placeholder="t('project.select_project')"
        :disabled="disabled"
        :loading="effectiveIsLoading"
      >
        <template #leading>
          <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
        </template>
      </USelectMenu>
    </UFormField>

    <UFormField :label="t('contentLibrary.moveModal.collection', 'Collection')">
      <USelectMenu
        v-model="collectionSelection"
        :items="collectionOptions"
        value-key="value"
        label-key="label"
        searchable
        :placeholder="t('contentLibrary.bulk.searchGroups')"
        :loading="effectiveIsLoading"
        :disabled="disabled"
        class="w-full"
      >
        <template #leading>
          <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
        </template>
      </USelectMenu>
    </UFormField>

    <!-- Sub-group tree selector or Saved View action -->
    <div v-if="selectedCollection" class="py-2">
      <template v-if="selectedCollection.type === 'GROUP'">
        <div class="p-2.5 border border-gray-200 dark:border-gray-800 rounded-md max-h-60 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900">
          <ContentGroupSelectTree
            v-if="subGroupTreeItems.length > 0"
            :items="subGroupTreeItems"
            :selected-id="internalGroupId"
            @select="internalGroupId = $event"
          />
          <div v-else class="text-xs text-gray-500 italic p-2 text-center">
            {{ t('contentLibrary.noSubGroups', 'No sub-groups.') }}
          </div>
        </div>
      </template>

      <template v-else-if="allowSavedViews && selectedCollection.type === 'SAVED_VIEW'">
        <div class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
          <UButton
            color="primary"
            icon="i-heroicons-document-duplicate"
            :loading="isLoading"
            @click="handleSavedViewAction"
          >
            {{ t('common.select') }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
