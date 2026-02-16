<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { ContentCollection } from '~/composables/useContentCollections'
import CreateCollectionModal from '~/components/content/CreateCollectionModal.vue'

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
const { listCollections, createCollection, deleteCollection, reorderCollections } = useContentCollections()

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

const groupChildrenByParentId = computed(() => {
  const result = new Map<string, ContentCollection[]>()

  for (const collection of collections.value) {
    if (collection.type !== 'GROUP' || !collection.parentId) {
      continue
    }

    const children = result.get(collection.parentId) ?? []
    children.push(collection)
    result.set(collection.parentId, children)
  }

  return result
})

const groupRecursiveItemsCount = computed(() => {
  const memo = new Map<string, number>()

  const countForGroup = (groupId: string, trail: Set<string>): number => {
    if (memo.has(groupId)) {
      return memo.get(groupId)!
    }

    if (trail.has(groupId)) {
      return 0
    }

    const group = collectionById.value.get(groupId)
    if (!group || group.type !== 'GROUP') {
      return 0
    }

    trail.add(groupId)
    let total = Number(group.directItemsCount ?? 0)
    const children = groupChildrenByParentId.value.get(groupId) ?? []

    for (const child of children) {
      total += countForGroup(child.id, trail)
    }

    trail.delete(groupId)
    memo.set(groupId, total)
    return total
  }

  for (const collection of collections.value) {
    if (collection.type === 'GROUP') {
      countForGroup(collection.id, new Set<string>())
    }
  }

  return memo
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
    const newCollection = await createCollection({
      scope: props.scope,
      projectId: props.projectId,
      type: data.type,
      groupType: data.type === 'GROUP' ? data.groupType : undefined,
      title: data.title,
      config: {},
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
    await reorderCollections({
      scope: props.scope,
      projectId: props.projectId,
      ids: collections.value.map(t => t.id),
    })
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

const getCollectionIcon = (type: 'GROUP' | 'SAVED_VIEW') => {
  return type === 'GROUP' ? 'i-heroicons-folder' : 'i-heroicons-bookmark'
}

const getCollectionColor = (type: 'GROUP' | 'SAVED_VIEW', isActive: boolean) => {
  if (isActive) return 'primary'
  return type === 'GROUP' ? 'neutral' : 'neutral'
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
    <div class="flex flex-wrap items-center gap-2 pb-2">
      <VueDraggable
        v-model="topLevelCollections"
        :animation="200"
        handle=".drag-handle"
        class="flex flex-wrap items-center gap-2 flex-1 min-w-0"
        @end="handleReorder"
      >
        <div
          v-for="collection in topLevelCollections"
          :key="collection.id"
          class="flex items-center gap-1 min-w-0"
        >
          <UButton
            :color="getCollectionColor(collection.type, highlightedCollectionId === collection.id)"
            :variant="highlightedCollectionId === collection.id ? 'solid' : 'outline'"
            size="sm"
            :icon="getCollectionIcon(collection.type)"
            class="drag-handle cursor-pointer max-w-full"
            @click="() => { hasUserSelection = true; activeCollectionId = collection.id; emit('update:active-collection', collection) }"
          >
            <span class="truncate max-w-48 sm:max-w-64">
              {{ getCollectionLabel(collection) }}
            </span>
          </UButton>
        </div>
      </VueDraggable>

      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-heroicons-plus"
        :title="t('contentLibrary.collections.create')"
        @click="isCreateModalOpen = true"
      />
    </div>

    <CreateCollectionModal
      v-model:open="isCreateModalOpen"
      :scope="props.scope"
      @create="handleCreateCollection"
    />
  </div>
</template>
