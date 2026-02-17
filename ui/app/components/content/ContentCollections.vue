<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { calculateRecursiveGroupCounters } from '@gran/shared/content-library-tree'
import type { ContentCollection } from '~/composables/useContentCollections'
import CreateCollectionModal from '~/components/content/CreateCollectionModal.vue'
import CommonDraggableTabs from '~/components/common/CommonDraggableTabs.vue'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:active-collection': [collection: ContentCollection | null]
  'update:collections': [collections: ContentCollection[]]
}>()

const { t } = useI18n()
const toast = useToast()
const api = useApi()
const { user, refreshUser } = useAuth()
const { listCollections, createCollection, deleteCollection } = useContentCollections()

const collections = ref<ContentCollection[]>([])
const isLoading = ref(false)
const isCreateModalOpen = ref(false)
const isReordering = ref(false)

const hasRestoredFromStorage = ref(false)
const hasUserSelection = ref(false)
let fetchCollectionsRequestId = 0

const activeCollectionId = computed({
  get: () => props.modelValue ?? null,
  set: (value) => emit('update:modelValue', value),
})

const topLevelCollections = computed<ContentCollection[]>({
  get: () => collections.value.filter(collection => collection.type === 'SAVED_VIEW' || !collection.parentId),
  set: (nextTopLevelCollections) => {
    const topLevelIds = new Set(nextTopLevelCollections.map(collection => collection.id))
    const nestedCollections = collections.value.filter(collection => !topLevelIds.has(collection.id))
    collections.value = [...nextTopLevelCollections, ...nestedCollections]
  },
})

const collectionById = computed(() => {
  return new Map(collections.value.map(collection => [collection.id, collection]))
})

const groupRecursiveItemsCount = computed(() => {
  return calculateRecursiveGroupCounters(collections.value as any)
})

const resolveTopLevelCollectionId = (collectionId: string | null | undefined): string | null => {
  if (!collectionId) {
    return null
  }

  let cursor = collectionById.value.get(collectionId)
  if (!cursor) {
    return null
  }

  if (cursor.type === 'SAVED_VIEW') {
    return cursor.id
  }

  while (cursor.parentId) {
    const parent = collectionById.value.get(cursor.parentId)
    if (!parent) {
      break
    }
    cursor = parent
  }

  return cursor.id
}

const highlightedCollectionId = computed(() => resolveTopLevelCollectionId(activeCollectionId.value))

const getOrderPreferenceKey = () => {
  const projectKey = props.scope === 'project' ? (props.projectId || 'global') : 'global'
  return `content-library-collections:${props.scope}:${projectKey}`
}

const getSavedOrderIds = () => {
  const raw = (user.value as any)?.contentLibraryCollectionOrder
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const key = getOrderPreferenceKey()
  const ids = (raw as any)[key]
  return Array.isArray(ids) ? (ids.filter((id: any) => typeof id === 'string') as string[]) : null
}

const applySavedOrder = () => {
  const savedIds = getSavedOrderIds()
  if (!savedIds || savedIds.length === 0) {
    return
  }

  const orderIndex = new Map(savedIds.map((id, idx) => [id, idx] as const))
  const nextTop = [...topLevelCollections.value].sort((a, b) => {
    const ai = orderIndex.get(a.id)
    const bi = orderIndex.get(b.id)
    if (ai === undefined && bi === undefined) return 0
    if (ai === undefined) return 1
    if (bi === undefined) return -1
    return ai - bi
  })

  topLevelCollections.value = nextTop
}

const getStorageKey = () => {
  return `content-library-collection-${props.scope}-${props.projectId || 'global'}`
}

const fetchCollections = async () => {
  const requestId = ++fetchCollectionsRequestId
  if (props.scope === 'project' && !props.projectId) return

  isLoading.value = true
  try {
    collections.value = await listCollections(props.scope, props.scope === 'project' ? props.projectId : undefined)
    if (requestId !== fetchCollectionsRequestId) return

    applySavedOrder()
    emit('update:collections', collections.value)

    if (activeCollectionId.value) {
      const currentActiveCollection = collections.value.find(t => t.id === activeCollectionId.value)
      if (currentActiveCollection) {
        emit('update:active-collection', currentActiveCollection)
      }
    }
    
    if (!hasRestoredFromStorage.value && !hasUserSelection.value) {
      hasRestoredFromStorage.value = true

      const savedCollectionId = localStorage.getItem(getStorageKey())
      const resolvedSavedCollectionId = resolveTopLevelCollectionId(savedCollectionId)
      const collectionToRestore = resolvedSavedCollectionId
        ? topLevelCollections.value.find(t => t.id === resolvedSavedCollectionId)
        : null

      if (collectionToRestore) {
        activeCollectionId.value = collectionToRestore.id
        emit('update:active-collection', collectionToRestore)
      } else {
        if (!activeCollectionId.value && topLevelCollections.value.length > 0 && topLevelCollections.value[0]) {
          activeCollectionId.value = topLevelCollections.value[0].id
          emit('update:active-collection', topLevelCollections.value[0])
        }
      }
    }
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('common.unexpectedError'),
      color: 'error',
    })
  } finally {
    if (requestId === fetchCollectionsRequestId) {
      isLoading.value = false
    }
  }
}

const handleCreateCollection = async (data: { type: 'GROUP' | 'SAVED_VIEW'; title: string; groupType?: 'PROJECT_USER' | 'PROJECT_SHARED' }) => {
  try {
    const resolvedGroupType =
      props.scope === 'project' && data.type === 'GROUP'
        ? (data.groupType ?? 'PROJECT_USER')
        : undefined

    const newCollection = await createCollection({
      scope: props.scope,
      projectId: props.projectId,
      type: data.type,
      title: data.title,
      config: {},
      ...(data.type === 'GROUP' && resolvedGroupType ? { groupType: resolvedGroupType } : {}),
    })
    
    await fetchCollections()
    activeCollectionId.value = newCollection.id
    emit('update:active-collection', newCollection)
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.collections.createError'),
      color: 'error',
    })
  }
}

const handleDeleteCollection = async (collectionId: string) => {
  try {
    await deleteCollection(collectionId, props.scope, props.projectId)
    
    if (activeCollectionId.value === collectionId) {
      activeCollectionId.value = null
      emit('update:active-collection', null)
    }
    
    await fetchCollections()
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.collections.deleteError'),
      color: 'error',
    })
  }
}

const handleReorder = async () => {
  isReordering.value = true
  try {
    const key = getOrderPreferenceKey()
    const nextIds = topLevelCollections.value.map(t => t.id)
    const current = (user.value as any)?.contentLibraryCollectionOrder
    const next = {
      ...(current && typeof current === 'object' ? current : {}),
      [key]: nextIds,
    }

    await api.patch('/users/me', {
      contentLibraryCollectionOrder: next,
    })

    await refreshUser()
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.collections.reorderError'),
      color: 'error',
    })
    await fetchCollections()
  } finally {
    isReordering.value = false
  }
}

const getCollectionIcon = (collection: ContentCollection) => {
  if (collection.type === 'SAVED_VIEW') {
    return props.scope === 'project' ? 'i-heroicons-bookmark-square' : 'i-heroicons-bookmark'
  }

  if (props.scope === 'project' && collection.visibility === 'PROJECT_SHARED') {
    return 'i-heroicons-briefcase'
  }

  return 'i-heroicons-user'
}

const getCollectionColor = (collection: ContentCollection, isActive: boolean) => {
  const isProjectShared = props.scope === 'project' && collection.visibility === 'PROJECT_SHARED'

  if (isProjectShared) {
    return 'primary'
  }

  if (isActive) {
    return 'secondary'
  }

  return 'neutral'
}

const getCollectionTooltip = (collection: ContentCollection) => {
  const typeText = collection.type === 'GROUP' 
    ? t('contentLibrary.collections.types.group.title') 
    : t('contentLibrary.collections.types.savedView.title')
  
  const scopeText = collection.visibility === 'PROJECT_SHARED' 
    ? t('contentLibrary.collections.groupVisibility.projectShared') 
    : (props.scope === 'project' 
        ? t('contentLibrary.collections.groupVisibility.projectUser') 
        : t('contentLibrary.subtitlePersonal'))
  
  return `${typeText} (${scopeText})`
}

const getCollectionLabel = (collection: ContentCollection) => {
  if (collection.type !== 'GROUP') {
    return collection.title
  }

  const totalRecursiveCount = groupRecursiveItemsCount.value.get(collection.id) ?? Number(collection.directItemsCount ?? 0)
  return `${collection.title} (${totalRecursiveCount})`
}

watch(() => props.projectId, () => {
  if (props.scope === 'project') {
    fetchCollections()
  }
})

watch(activeCollectionId, (newId) => {
  const idToSave = resolveTopLevelCollectionId(newId)
  if (idToSave) {
    localStorage.setItem(getStorageKey(), idToSave)
  }
})

watch(() => props.scope, () => {
  activeCollectionId.value = null
  emit('update:active-collection', null)
  fetchCollections()
})

onMounted(() => {
  fetchCollections()
})

defineExpose({
    fetchCollections,
    collections
})
</script>

<template>
  <div class="space-y-3">
    <CommonDraggableTabs
      v-model="activeCollectionId"
      v-model:items="topLevelCollections"
      :show-add-button="true"
      @add="isCreateModalOpen = true"
      @end="handleReorder"
    >
      <template #tab="{ item, selected, select }">
        <UTooltip :text="getCollectionTooltip(item as any)" :delay-duration="500">
          <UButton
            :color="getCollectionColor(item as any, selected)"
            :variant="highlightedCollectionId === (item as any).id ? 'solid' : 'outline'"
            size="sm"
            :icon="getCollectionIcon(item as any)"
            class="drag-handle cursor-pointer max-w-full"
            @click="() => { hasUserSelection = true; select(); emit('update:active-collection', item as any) }"
          >
            <span class="truncate max-w-48 sm:max-w-64">
              {{ getCollectionLabel(item as any) }}
            </span>
          </UButton>
        </UTooltip>
      </template>
    </CommonDraggableTabs>

    <CreateCollectionModal
      v-model:open="isCreateModalOpen"
      :scope="props.scope"
      @create="handleCreateCollection"
    />
  </div>
</template>
