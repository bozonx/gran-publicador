<script setup lang="ts">
import type { ContentCollection } from '~/composables/useContentCollections'
import { useContentCollections } from '~/composables/useContentCollections'
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree'
import ContentGroupSelectTree from './ContentGroupSelectTree.vue'
import { getApiErrorMessage } from '~/utils/error'

interface Props {
  scope: 'project' | 'personal'
  projectId?: string
  unsplashId: string | null
}

const props = withDefaults(defineProps<Props>(), {
  unsplashId: null,
})

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const router = useRouter()

const { listCollections } = useContentCollections()

const isLoading = ref(false)
const isCreating = ref(false)
const error = ref<string | null>(null)

const collections = ref<ContentCollection[]>([])

const targetCollectionId = ref<string | null>(null)

const collectionOptions = computed(() => {
  return collections.value
    .filter(c => (c.type === 'GROUP' || c.type === 'SAVED_VIEW') && !c.parentId)
    .map(c => ({ label: c.title, value: c.id }))
})

const selectedCollection = computed(() => {
  if (!targetCollectionId.value) return null
  return collections.value.find(c => c.id === targetCollectionId.value) ?? null
})

const targetCollectionTreeItems = computed<ContentLibraryTreeItem[]>(() => {
  if (!selectedCollection.value) return []
  if (selectedCollection.value.type !== 'GROUP') return []

  return buildGroupTreeFromRoot({
    rootId: selectedCollection.value.id,
    allGroupCollections: collections.value,
    labelFn: c => c.title,
  })
})

async function fetchCollections() {
  collections.value = await listCollections(props.scope, props.scope === 'project' ? props.projectId : undefined)
}

async function init() {
  if (!isOpen.value) return

  error.value = null
  isLoading.value = true
  try {
    await fetchCollections()
  } catch (e: any) {
    error.value = getApiErrorMessage(e, 'Failed to load data')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, () => {
  if (isOpen.value) {
    init()
  }
})

watch(isOpen, (next) => {
  if (!next) {
    isLoading.value = false
    isCreating.value = false
    error.value = null
    collections.value = []
    targetCollectionId.value = null
  }
})

function handleSelectCollection(next: unknown) {
  const targetId = (next && typeof next === 'object' && 'value' in next) ? (next as any).value : next
  targetCollectionId.value = (targetId ?? null) as any
}

async function createItem(groupId?: string) {
  if (!props.unsplashId) {
    error.value = 'Unsplash photo ID is missing'
    return
  }
  if (isCreating.value) return

  isCreating.value = true
  error.value = null
  try {
    const created = await api.post<any>('/content-library/items', {
      scope: props.scope,
      projectId: props.scope === 'project' ? props.projectId : undefined,
      groupId,
      unsplashId: props.unsplashId,
    })

    isOpen.value = false

    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.actions.copyToItemSuccess'),
      color: 'success',
      actions: [
        {
          label: t('common.view', 'View'),
          onClick: () => {
            const base = props.scope === 'project' ? `/projects/${props.projectId}/content-library` : '/content-library'
            router.push({ path: base, query: { openItemId: created?.id } })
          },
        },
      ],
    } as any)
  } catch (e: any) {
    error.value = getApiErrorMessage(e, 'Failed to create content item')
    toast.add({
      title: t('common.error'),
      description: error.value,
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

async function handleSelectGroup(groupId: string) {
  if (!groupId || isCreating.value) return
  await createItem(groupId)
}

async function handleCopyToSavedView() {
  await createItem(undefined)
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('contentLibrary.actions.copyToContentItem')"
    :ui="{ content: 'max-w-md' }"
  >
    <div class="space-y-4 relative">
      <div v-if="isCreating" class="absolute inset-0 z-10 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-lg">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('contentLibrary.actions.copyPublicationToItemDescription', 'Select a target collection to create a new content item.') }}
      </p>

      <div v-if="error" class="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30">
        {{ error }}
      </div>

      <div v-else class="space-y-3">
        <USelectMenu
          :items="collectionOptions"
          value-key="value"
          label-key="label"
          searchable
          :loading="isLoading"
          :search-input="{ placeholder: t('contentLibrary.bulk.searchGroups') }"
          :placeholder="t('contentLibrary.bulk.searchGroups')"
          @update:model-value="handleSelectCollection"
        >
          <template #leading>
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <div v-if="selectedCollection" class="py-2">
          <div v-if="selectedCollection.type === 'GROUP'" class="max-h-60 overflow-y-auto custom-scrollbar" :class="{ 'opacity-50 pointer-events-none': isCreating }">
            <ContentGroupSelectTree
              v-if="targetCollectionTreeItems.length > 0"
              :items="targetCollectionTreeItems as any"
              @select="handleSelectGroup"
            />
          </div>

          <div v-else-if="selectedCollection.type === 'SAVED_VIEW'" class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <UButton
              color="primary"
              icon="i-heroicons-document-duplicate"
              :loading="isCreating"
              @click="handleCopyToSavedView"
            >
              {{ t('common.copy', 'Copy') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton color="neutral" variant="ghost" :disabled="isCreating" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
