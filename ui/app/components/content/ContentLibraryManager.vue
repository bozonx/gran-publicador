<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import { type ContentCollection } from '~/composables/useContentCollections'
import { sanitizeContentPreserveMarkdown } from '~/utils/text'
import { getApiErrorMessage } from '~/utils/error'
import { aggregateSelectedItemsToPublicationOrThrow } from '~/composables/useContentLibraryPublicationAggregation'
import ContentCollections from './ContentCollections.vue'
import ContentLibraryToolbar from './ContentLibraryToolbar.vue'
import ContentLibraryBulkBar from './ContentLibraryBulkBar.vue'
import ContentItemEditor from './ContentItemEditor.vue'
import ContentItemCard from './ContentItemCard.vue'
import ContentMoveModal from './ContentMoveModal.vue'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import UiLoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import CommonFoundCount from '~/components/common/CommonFoundCount.vue'

const VALIDATION_LIMITS = {
  MAX_REORDER_MEDIA: 100,
  MAX_PUBLICATION_CONTENT_LENGTH: 100000,
  MAX_NOTE_LENGTH: 5000,
  MAX_TAGS_LENGTH: 1000,
  MAX_TAGS_COUNT: 50,
  MAX_TITLE_LENGTH: 500,
}

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const { projects, currentProject, fetchProject, fetchProjects } = useProjects()
const { listCollections, createCollection, updateCollection, deleteCollection } = useContentCollections()
const { uploadMedia } = useMedia()

const isLoading = ref(false)
const error = ref<string | null>(null)
const activeCollectionId = ref<string | null>(null)
const activeCollection = ref<ContentCollection | null>(null)
const collections = ref<ContentCollection[]>([])
const q = ref('')
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const totalUnfiltered = ref(0)
const items = ref<any[]>([])
const availableTags = ref<string[]>([])
const selectedTags = ref<string>('')

const sortBy = ref<'createdAt' | 'title'>('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

const sortOptions = computed(() => [
  { id: 'createdAt', label: t('common.createdAt'), icon: 'i-heroicons-calendar-days' },
  { id: 'title', label: t('common.title'), icon: 'i-heroicons-document-text' }
])

const currentSortOption = computed(() => 
  sortOptions.value.find(opt => opt.id === sortBy.value)
)

const sortOrderIcon = computed(() => 
  sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
)

const sortOrderLabel = computed(() => 
  sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')
)

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

watch(sortOrder, () => {
  if (isRestoringConfig.value) {
    return
  }

  persistActiveCollectionConfig()
})

watch(sortBy, () => {
  if (isRestoringConfig.value) {
    return
  }

  persistActiveCollectionConfig()
})

const selectedIds = ref<string[]>([])
const isBulkDeleting = ref(false)
const isBulkOperationModalOpen = ref(false)
const isMergeConfirmModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'MERGE'>('DELETE')

const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)

const isMoveModalOpen = ref(false)
const moveItemsIds = ref<string[]>([])
const allGroupCollections = ref<ContentCollection[]>([])

const isCreatePublicationModalOpen = ref(false)
const createPublicationModalProjectId = ref<string | undefined>(undefined)
const createPublicationModalAllowProjectSelection = ref(false)
const publicationData = ref({
  title: '',
  content: '',
  mediaIds: [] as Array<{ id: string }>,
  tags: [] as string[],
  note: '',
  contentItemIds: [] as string[]
})

const contentCollectionsRef = ref<any>(null)
const isRenameCollectionModalOpen = ref(false)
const newCollectionTitle = ref('')
const isDeleteCollectionConfirmModalOpen = ref(false)
const isRenamingCollection = ref(false)
const isDeletingCollection = ref(false)
const selectedGroupTreeNodeId = ref<string | null>(null)
const skipAutoRestoreLastSelectedGroupNodeOnce = ref(false)
const isTreeCreateModalOpen = ref(false)
const treeCreateParentId = ref<string | null>(null)
const treeCreateTitle = ref('')
const isCreatingTreeGroup = ref(false)
const isTreeDeleteConfirmModalOpen = ref(false)
const treeDeleteTargetId = ref<string | null>(null)
const isDeletingTreeGroup = ref(false)
const isTreeRenameModalOpen = ref(false)
const treeRenameTargetId = ref<string | null>(null)
const treeRenameTitle = ref('')
const isRenamingTreeGroup = ref(false)


interface GroupTreeNode extends TreeItem {
  label: string
  value: string
  children?: GroupTreeNode[]
}

const handleSidebarGroupNodeSelect = (collectionId: string) => {
  selectedGroupTreeNodeId.value = collectionId
  const targetCollection = collectionsById.value.get(collectionId)
  if (targetCollection?.type === 'GROUP' && !targetCollection.parentId) {
    skipAutoRestoreLastSelectedGroupNodeOnce.value = true
    localStorage.setItem(getGroupSelectionStorageKey(collectionId), collectionId)
  }
  handleSelectGroupCollection(collectionId)
}

const getGroupTreeNodeValue = (node: unknown): string => {
  if (!node || typeof node !== 'object' || !('value' in node)) {
    return ''
  }

  const value = (node as { value?: unknown }).value
  return typeof value === 'string' ? value : ''
}

const getGroupTreeNodeLabel = (node: unknown): string => {
  if (!node || typeof node !== 'object' || !('label' in node)) {
    return ''
  }

  const label = (node as { label?: unknown }).label
  return typeof label === 'string' ? label : ''
}

const hasTreeChildren = (node: unknown): boolean => {
  if (!node || typeof node !== 'object' || !('children' in node)) {
    return false
  }

  const children = (node as any).children
  return Array.isArray(children) && children.length > 0
}

const formatGroupTreeLabel = (collection: ContentCollection) => {
  const directItemsCount = Number(collection.directItemsCount ?? 0)
  return `${collection.title} (${directItemsCount})`
}

const canDeleteCollection = (collection: ContentCollection | null | undefined) => {
  if (!collection) {
    return false
  }

  return true
}

const canDeleteActiveCollection = computed(() => canDeleteCollection(activeCollection.value))

const isActiveGroupCollection = computed(() => activeCollection.value?.type === 'GROUP')

const allScopeGroupCollections = computed(() => collections.value.filter(collection => collection.type === 'GROUP'))
const collectionsById = computed(() => new Map(collections.value.map(collection => [collection.id, collection])))

const treeCreateParentLabel = computed(() => {
  if (!treeCreateParentId.value) {
    return '-'
  }

  return collectionsById.value.get(treeCreateParentId.value)?.title ?? '-'
})

const treeDeleteTargetLabel = computed(() => {
  if (!treeDeleteTargetId.value) {
    return '-'
  }

  return collectionsById.value.get(treeDeleteTargetId.value)?.title ?? '-'
})

const activeRootGroupId = computed(() => {
  if (activeCollection.value?.type !== 'GROUP') {
    return null
  }

  let cursor: ContentCollection | undefined = activeCollection.value
  const visited = new Set<string>()

  while (cursor?.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    const parent = collectionsById.value.get(cursor.parentId)
    if (!parent || parent.type !== 'GROUP') {
      break
    }
    cursor = parent
  }

  return cursor?.id ?? null
})

const sidebarGroupTreeItems = computed<GroupTreeNode[]>(() => {
  if (!activeRootGroupId.value) {
    return []
  }

  const rootGroup = collectionsById.value.get(activeRootGroupId.value)
  if (!rootGroup || rootGroup.type !== 'GROUP') {
    return []
  }

  const byParent = new Map<string, ContentCollection[]>()

  for (const collection of allScopeGroupCollections.value) {
    const parentId = collection.parentId ?? ''
    const current = byParent.get(parentId) ?? []
    current.push(collection)
    byParent.set(parentId, current)
  }

  const buildTree = (parentId: string): GroupTreeNode[] => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)
    return children.map((collection) => ({
      label: formatGroupTreeLabel(collection),
      value: collection.id,
      slot: 'group-node',
      defaultExpanded: true,
      children: buildTree(collection.id),
    }))
  }

  return [{
    label: formatGroupTreeLabel(rootGroup),
    value: rootGroup.id,
    slot: 'group-node',
    defaultExpanded: true,
    children: buildTree(rootGroup.id),
  }]
})


const groupTreeItems = computed<GroupTreeNode[]>(() => {
  if (!isActiveGroupCollection.value || !activeCollection.value) {
    return []
  }

  const rootId = activeCollection.value.id
  const descendants = new Set<string>([rootId])
  const queue = [rootId]

  while (queue.length > 0) {
    const parentId = queue.shift()
    if (!parentId) {
      continue
    }

    for (const collection of allGroupCollections.value) {
      if (collection.parentId === parentId && !descendants.has(collection.id)) {
        descendants.add(collection.id)
        queue.push(collection.id)
      }
    }
  }

  const byParent = new Map<string, ContentCollection[]>()
  for (const collection of allGroupCollections.value) {
    if (!descendants.has(collection.id) || collection.id === rootId) {
      continue
    }

    const parentId = collection.parentId ?? ''
    const current = byParent.get(parentId) ?? []
    current.push(collection)
    byParent.set(parentId, current)
  }

  const buildTree = (parentId: string): GroupTreeNode[] => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)
    return children.map((collection) => ({
      label: collection.title,
      value: collection.id,
      defaultExpanded: true,
      children: buildTree(collection.id),
    }))
  }

  return buildTree(rootId)
})


const isPurgeConfirmModalOpen = ref(false)
const isPurging = ref(false)
const isStartCreating = ref(false)
const isEditModalOpen = ref(false)
const activeItem = ref<any | null>(null)
const isUploadingFiles = ref(false)
const isWindowFileDragActive = ref(false)
const windowDragDepth = ref(0)

function isFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes('Files') ?? false
}

function resetWindowDragState() {
  isWindowFileDragActive.value = false
  windowDragDepth.value = 0
}

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const uploadContentFiles = async (files: File[]) => {
  if (!files.length || (props.scope === 'project' && !props.projectId)) {
    return
  }

  if (isUploadingFiles.value) {
    toast.add({
      title: t('common.warning'),
      description: t('contentLibrary.actions.uploadMediaInProgress'),
      color: 'warning'
    })
    return
  }

  isUploadingFiles.value = true
  const targetGroupId = activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined
  try {
    let successCount = 0
    let errorCount = 0

    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase()
        const isText = ['txt', 'md'].includes(ext || '')

        if (isText) {
          const text = await readFileAsText(file)
          await api.post('/content-library/items', {
            scope: props.scope,
            projectId: props.scope === 'project' ? props.projectId : undefined,
            groupId: targetGroupId,
            title: file.name,
            text,
            meta: {},
            media: [],
          })
        } else {
          const media = await uploadMedia(
            file,
            undefined,
            undefined,
            props.scope === 'project' ? props.projectId : undefined
          )

          await api.post('/content-library/items', {
            scope: props.scope,
            projectId: props.scope === 'project' ? props.projectId : undefined,
            groupId: targetGroupId,
            title: file.name,
            text: '',
            meta: {},
            media: [{ mediaId: media.id, order: 0, hasSpoiler: false }],
          })
        }

        successCount += 1
      } catch {
        errorCount += 1
      }
    }

    if (successCount > 0) {
      await fetchItems({ reset: true })
    }

    if (errorCount === 0) {
      toast.add({
        title: t('common.success'),
        description: t('contentLibrary.actions.uploadMediaSuccess', { count: successCount }),
        color: 'success'
      })
    } else if (successCount > 0) {
      toast.add({
        title: t('common.warning'),
        description: t('contentLibrary.actions.uploadMediaPartial', { successCount, errorCount }),
        color: 'warning'
      })
    } else {
      toast.add({
        title: t('common.error'),
        description: t('contentLibrary.actions.uploadMediaFailed', { count: errorCount }),
        color: 'error'
      })
    }
  } finally {
    isUploadingFiles.value = false
  }
}

const openTreeCreateModal = (parentId: string) => {
  const parentCollection = collectionsById.value.get(parentId)
  if (!parentCollection || parentCollection.type !== 'GROUP') {
    return
  }

  treeCreateParentId.value = parentId
  treeCreateTitle.value = ''
  isTreeCreateModalOpen.value = true
}

const handleCreateGroupFromTreeModal = async () => {
  const title = treeCreateTitle.value.trim()
  if (!treeCreateParentId.value || !title) {
    return
  }

  isCreatingTreeGroup.value = true
  try {
    const newCollection = await createCollection({
      scope: props.scope,
      projectId: props.projectId,
      type: 'GROUP',
      parentId: treeCreateParentId.value,
      title,
      config: {},
    })

    await contentCollectionsRef.value?.fetchCollections()
    activeCollectionId.value = newCollection.id
    activeCollection.value = newCollection
    selectedGroupTreeNodeId.value = newCollection.id
    selectedIds.value = []
    isTreeCreateModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create subgroup'), color: 'error' })
  } finally {
    isCreatingTreeGroup.value = false
  }
}

const openTreeRenameModal = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  if (!targetCollection || targetCollection.type !== 'GROUP' || !targetCollection.parentId) {
    return
  }

  treeRenameTargetId.value = collectionId
  treeRenameTitle.value = targetCollection.title
  isTreeRenameModalOpen.value = true
}

const handleRenameGroupFromTree = async () => {
  const title = treeRenameTitle.value.trim()
  if (!treeRenameTargetId.value || !title) {
    return
  }

  isRenamingTreeGroup.value = true
  try {
    const updatedCollection = await updateCollection(treeRenameTargetId.value, {
      scope: props.scope,
      projectId: props.projectId,
      title,
    })

    await contentCollectionsRef.value?.fetchCollections()
    
    // Update active collection if it matches renamed one
    if (activeCollectionId.value === treeRenameTargetId.value) {
      activeCollection.value = updatedCollection
    }

    isTreeRenameModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename subgroup'), color: 'error' })
  } finally {
    isRenamingTreeGroup.value = false
  }
}

const openTreeDeleteModal = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  if (!targetCollection || targetCollection.type !== 'GROUP' || !targetCollection.parentId) {
    return
  }

  treeDeleteTargetId.value = collectionId
  isTreeDeleteConfirmModalOpen.value = true
}

const handleDeleteGroupFromTree = async () => {
  if (!treeDeleteTargetId.value) {
    return
  }

  const targetCollection = collectionsById.value.get(treeDeleteTargetId.value)
  if (!targetCollection) {
    return
  }

  const parentId = targetCollection.parentId
  isDeletingTreeGroup.value = true
  try {
    await deleteCollection(targetCollection.id, props.scope, props.projectId)
    await contentCollectionsRef.value?.fetchCollections()

    if (parentId) {
      const parentCollection = collections.value.find(collection => collection.id === parentId)
      if (parentCollection) {
        activeCollectionId.value = parentCollection.id
        activeCollection.value = parentCollection
      }
    }

    if (!parentId) {
      activeCollectionId.value = null
      activeCollection.value = null
    }

    selectedIds.value = []
    isTreeDeleteConfirmModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete group'), color: 'error' })
  } finally {
    isDeletingTreeGroup.value = false
  }
}

const getGroupNodeMenuItems = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  const menuItems: Array<{ label: string; icon: string; onSelect: () => void }> = [
    {
      label: t('contentLibrary.collections.createSubgroup'),
      icon: 'i-heroicons-folder-plus',
      onSelect: () => openTreeCreateModal(collectionId),
    },
  ]

  if (targetCollection?.parentId) {
    menuItems.push({
      label: t('common.rename'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openTreeRenameModal(collectionId),
    })
  }

  if (targetCollection?.parentId && canDeleteCollection(targetCollection)) {
    menuItems.push({
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      onSelect: () => openTreeDeleteModal(collectionId),
    })
  }

  return [menuItems]
}

function handleWindowDragEnter(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  windowDragDepth.value += 1
  isWindowFileDragActive.value = true
}

function handleWindowDragOver(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  isWindowFileDragActive.value = true
}

function handleWindowDragLeave(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  windowDragDepth.value = Math.max(0, windowDragDepth.value - 1)
  if (windowDragDepth.value === 0) {
    isWindowFileDragActive.value = false
  }
}

function handleWindowDrop(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  resetWindowDragState()
}

let fetchItemsRequestId = 0

const fetchItems = async (opts?: { reset?: boolean }) => {
  const requestId = ++fetchItemsRequestId
  if (props.scope === 'project' && !props.projectId) return

  if (activeCollectionId.value && !activeCollection.value && !collectionsById.value.get(activeCollectionId.value)) {
    return
  }

  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }
  isLoading.value = true
  error.value = null
  try {
    const resolvedActiveCollection = activeCollection.value ?? (activeCollectionId.value ? (collectionsById.value.get(activeCollectionId.value) ?? null) : null)
    const resolvedGroupId = resolvedActiveCollection?.type === 'GROUP' ? resolvedActiveCollection.id : undefined

    const shouldIncludeTotalUnfiltered = offset.value === 0

    const baseParams = {
      scope: props.scope === 'personal' ? 'personal' : 'project',
      projectId: props.scope === 'project' ? props.projectId : undefined,
      archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
      includeArchived: false,
    }

    const res = await api.get<any>('/content-library/items', {
      params: {
        ...baseParams,
        groupId: resolvedGroupId,
        search: q.value || undefined,
        limit,
        offset: offset.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        tags: selectedTags.value || undefined,
        includeTotalUnfiltered: shouldIncludeTotalUnfiltered ? true : undefined,
      },
    })

    if (requestId !== fetchItemsRequestId) {
      return
    }

    total.value = res.total
    if (typeof res.totalUnfiltered === 'number') {
      totalUnfiltered.value = res.totalUnfiltered
    } else if (offset.value === 0) {
      totalUnfiltered.value = res.total
    }
    if (offset.value === 0) {
      items.value = res.items
    } else {
      items.value = [...items.value, ...res.items]
    }
  } catch (e: any) {
    if (requestId !== fetchItemsRequestId) {
      return
    }

    error.value = getApiErrorMessage(e, 'Failed to load content library')
  } finally {
    if (requestId === fetchItemsRequestId) {
      isLoading.value = false
    }
  }
}

const fetchAvailableTags = async () => {
  try {
    if (!activeCollection.value) {
      return
    }

    const groupIdForTags = activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined
    const tags = await api.get<string[]>('/content-library/tags', {
      params: {
        scope: props.scope === 'personal' ? 'personal' : 'project',
        projectId: props.scope === 'project' ? props.projectId : undefined,
        groupId: groupIdForTags,
      }
    })
    availableTags.value = tags
  } catch (e) {
    console.error('Failed to fetch available tags', e)
  }
}

watch(activeCollection, (next, prev) => {
  if (next?.id && next.id !== prev?.id) {
    fetchAvailableTags()
  }
})

const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return
  offset.value += limit
  await fetchItems()
}

const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)

watch(() => q.value, () => {
  selectedIds.value = []
  debouncedFetch()
})

watch(archiveStatus, () => fetchItems({ reset: true }))

watch(selectedTags, () => fetchItems({ reset: true }))

watch(sortBy, () => fetchItems({ reset: true }))
watch(sortOrder, () => fetchItems({ reset: true }))

const hasMore = computed(() => items.value.length < total.value)

const isAllSelected = computed(() => items.value.length > 0 && items.value.every(item => selectedIds.value.includes(item.id)))
const isSomeSelected = computed(() => selectedIds.value.length > 0 && !isAllSelected.value)

function toggleSelectAll() {
  if (items.value.length === 0) {
    return
  }
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = items.value.map(item => item.id)
  }
}

function toggleSelection(itemId: string) {
  const index = selectedIds.value.indexOf(itemId)
  if (index === -1) {
    selectedIds.value.push(itemId)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const createAndEdit = async () => {
  if (props.scope === 'project' && !props.projectId) return
  isStartCreating.value = true
  try {
    const payload: any = {
      scope: props.scope === 'personal' ? 'personal' : 'project',
      groupId: activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined,
      text: '',
      meta: {},
      media: [],
    }
    if (props.scope === 'project') payload.projectId = props.projectId
    const res = await api.post<any>('/content-library/items', payload)
    await fetchItems({ reset: true })
    openEditModal(res)
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to create content item'),
      color: 'error'
    })
  } finally {
    isStartCreating.value = false
  }
}

const archiveItem = async (item: any) => {
  isArchivingId.value = item.id
  try {
    await api.post(`/content-library/items/${item.id}/archive`)
    await fetchItems({ reset: true })
    toast.add({ title: t('common.success'), description: t('contentLibrary.actions.moveToTrashSuccess'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to archive'), color: 'error' })
  } finally {
    isArchivingId.value = null
  }
}

const restoreItem = async (itemId: string) => {
  isRestoringId.value = itemId
  try {
    await api.post(`/content-library/items/${itemId}/restore`)
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to restore'), color: 'error' })
  } finally {
    isRestoringId.value = null
  }
}

const purgeArchived = async () => {
  if (props.scope === 'project' && !props.projectId) return
  isPurging.value = true
  try {
    if (props.scope === 'project' && props.projectId) {
      await api.post(`/content-library/projects/${props.projectId}/purge-archived`)
    } else {
      await api.post('/content-library/personal/purge-archived')
    }
    await fetchItems({ reset: true })
    isPurgeConfirmModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to purge'), color: 'error' })
  } finally {
    isPurging.value = false
  }
}

const handleBulkAction = async (operation: 'ARCHIVE' | 'UNARCHIVE') => {
  bulkOperationType.value = operation
  await executeBulkOperation()
}

const handleBulkDeleteForever = async () => {
  bulkOperationType.value = 'DELETE'
  await executeBulkOperation()
}

const executeBulkOperation = async () => {
  if (selectedIds.value.length === 0) return
  const operation = bulkOperationType.value
  isBulkDeleting.value = true
  try {
    await api.post('/content-library/bulk', { ids: selectedIds.value, operation })
    toast.add({ title: t('common.success'), description: t('contentLibrary.bulk.success', { count: selectedIds.value.length }), color: 'success' })
    selectedIds.value = []
    isBulkOperationModalOpen.value = false
    isMergeConfirmModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, `Failed to perform bulk ${operation}`), color: 'error' })
  } finally {
    isBulkDeleting.value = false
  }
}

const openRenameCollectionModal = () => {
  const collection = resolveRootGroupCollectionForActions()
  if (!collection) return
  newCollectionTitle.value = collection.title
  isRenameCollectionModalOpen.value = true
}

const handleRenameCollection = async () => {
  const collection = resolveRootGroupCollectionForActions()
  if (!collection || !newCollectionTitle.value.trim()) return
  isRenamingCollection.value = true
  try {
    await updateCollection(collection.id, { scope: props.scope, projectId: props.projectId, title: newCollectionTitle.value })
    contentCollectionsRef.value?.fetchCollections()
    isRenameCollectionModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename group'), color: 'error' })
  } finally {
    isRenamingCollection.value = false
  }
}

const openDeleteCollectionModal = () => {
  const collection = resolveRootGroupCollectionForActions()
  if (!collection) return
  isDeleteCollectionConfirmModalOpen.value = true
}

const handleDeleteCollection = async () => {
  const collectionToDelete = resolveRootGroupCollectionForActions()
  if (!collectionToDelete) return
  const parentId = collectionToDelete.parentId
  isDeletingCollection.value = true
  try {
    await deleteCollection(collectionToDelete.id, props.scope, props.projectId)
    contentCollectionsRef.value?.fetchCollections()

    const parentCollection = parentId ? collections.value.find(collection => collection.id === parentId) : null
    if (parentCollection) {
      activeCollection.value = parentCollection
      activeCollectionId.value = parentCollection.id
    } else {
      activeCollection.value = null
      activeCollectionId.value = null
    }

    isDeleteCollectionConfirmModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete group'), color: 'error' })
  } finally {
    isDeletingCollection.value = false
  }
}

// Move to Project Logic
const isMoveToProjectModalOpen = ref(false)
const targetProjectId = ref<string | undefined>(undefined)

const moveModalRootRef = ref<HTMLElement | null>(null)
const moveProjectSelectRef = ref()

useModalAutoFocus({
  open: isMoveToProjectModalOpen,
  root: moveModalRootRef,
  candidates: [{ target: moveProjectSelectRef }],
})


const fetchGroupCollections = async () => {
  if (props.scope === 'project' && !props.projectId) {
    return
  }

  try {
    const collections = await listCollections(props.scope, props.projectId)
    allGroupCollections.value = collections.filter(collection => collection.type === 'GROUP')
  } finally {
    // Done
  }
}

const handleOpenMoveModal = async (ids: string[]) => {
  if (ids.length === 0) return
  moveItemsIds.value = ids
  
  if (allGroupCollections.value.length === 0) {
    await fetchGroupCollections()
  }
  
  if (projects.value.length === 0) {
    await fetchProjects(false)
  }
  
  isMoveModalOpen.value = true
}

const handleExecuteMoveItems = async (payload: { operation: 'MOVE_TO_GROUP' | 'SET_PROJECT'; targetId: string | null; sourceGroupId?: string }) => {
  if (moveItemsIds.value.length === 0) return
  
  isLoading.value = true
  try {
    await api.post('/content-library/bulk', {
      ids: moveItemsIds.value,
      operation: payload.operation,
      groupId: payload.operation === 'MOVE_TO_GROUP' ? payload.targetId : undefined,
      projectId: payload.operation === 'SET_PROJECT' ? payload.targetId : undefined,
      sourceGroupId: payload.sourceGroupId
    })
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.bulk.success', { count: moveItemsIds.value.length }),
      color: 'success',
    })
    
    // Clear selection if it was a bulk move
    if (selectedIds.value.length > 0 && moveItemsIds.value.every(id => selectedIds.value.includes(id))) {
      selectedIds.value = []
    }
    
    isMoveModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to move items'), color: 'error' })
  } finally {
    isLoading.value = false
  }
}

const handleCreatePublicationFromSelection = () => {
  if (selectedIds.value.length === 0) return
  const selectedItems = items.value.filter(i => selectedIds.value.includes(i.id))
  try {
    const aggregated = aggregateSelectedItemsToPublicationOrThrow(selectedItems, VALIDATION_LIMITS)
    createPublicationModalProjectId.value = aggregated.projectId
    createPublicationModalAllowProjectSelection.value = aggregated.allowProjectSelection
    publicationData.value = {
      title: aggregated.title,
      content: aggregated.content,
      mediaIds: aggregated.media,
      tags: aggregated.tags,
      note: aggregated.note,
      contentItemIds: aggregated.contentItemIds
    }
    isCreatePublicationModalOpen.value = true
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: t('contentLibrary.bulk.createPublicationGenericError'), color: 'error' })
  }
}

const handleMerge = () => {
  bulkOperationType.value = 'MERGE'
  isMergeConfirmModalOpen.value = true
}

const handleCreatePublication = (item: any) => {
  const text = sanitizeContentPreserveMarkdown(item.text || '').trim()
  createPublicationModalProjectId.value = props.scope === 'project' ? props.projectId : undefined
  createPublicationModalAllowProjectSelection.value = props.scope === 'personal'
  publicationData.value = {
    title: (item.title || '').toString().trim(),
    content: text,
    mediaIds: (item.media || [])
      .map((m: any) => ({ id: m.mediaId || m.media?.id || null, hasSpoiler: m.hasSpoiler ? true : undefined }))
      .filter((m: any) => !!m.id),
    tags: item.tags || [],
    note: item.note || '',
    contentItemIds: [item.id]
  }
  isCreatePublicationModalOpen.value = true
}

 const resolveRootGroupCollectionForActions = (): ContentCollection | null => {
   if (!activeCollection.value) {
     return null
   }
   if (activeCollection.value.type !== 'GROUP') {
     return activeCollection.value
   }
   if (!activeRootGroupId.value) {
     return activeCollection.value
   }
   return collectionsById.value.get(activeRootGroupId.value) ?? activeCollection.value
 }

const handleSelectGroupCollection = (collectionId: string) => {
  if (activeCollectionId.value === collectionId) {
    return
  }

  const targetCollection = collections.value.find(collection => collection.id === collectionId)
  if (!targetCollection) {
    return
  }

  activeCollectionId.value = targetCollection.id
  activeCollection.value = targetCollection
}

const openEditModal = (item: any) => {
  activeItem.value = item
  isEditModalOpen.value = true
}

const editorRef = ref<InstanceType<typeof ContentItemEditor> | null>(null)

const handleCloseModal = async () => {
  if (editorRef.value) {
    await editorRef.value.forceSave()
  }
  isEditModalOpen.value = false
  activeItem.value = null
  await fetchItems({ reset: true })
}

const isRestoringConfig = ref(false)
const isInitialDataLoaded = ref(false)

const getGroupRootCollectionId = (collection: ContentCollection): string => {
  let cursor: ContentCollection | undefined = collection
  const visited = new Set<string>()

  while (cursor?.type === 'GROUP' && cursor.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    const parent = collectionsById.value.get(cursor.parentId)
    if (!parent || parent.type !== 'GROUP') {
      break
    }
    cursor = parent
  }

  return cursor?.id ?? collection.id
}

const isRestoringGroupSelection = ref(false)

const getGroupSelectionStorageKey = (rootGroupId: string) => {
  return `content-library-last-group-${props.scope}-${props.projectId || 'global'}-${rootGroupId}`
}

const buildCollectionConfig = () => {
  if (!activeCollection.value) {
    return {}
  }

  const baseConfig = {
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }

  if (activeCollection.value.type === 'SAVED_VIEW') {
    return {
      ...baseConfig,
      search: q.value,
      tags: selectedTags.value,
    }
  }

  return baseConfig
}

const resolveCollectionForConfigPersistence = (): ContentCollection | null => {
  if (!activeCollection.value) {
    return null
  }

  const canonicalCollection = collectionsById.value.get(activeCollection.value.id) ?? activeCollection.value

  if (canonicalCollection.type !== 'GROUP') {
    return canonicalCollection
  }

  const rootId = getGroupRootCollectionId(canonicalCollection)
  return collectionsById.value.get(rootId) ?? canonicalCollection
}

const persistActiveCollectionConfig = async () => {
  const persistenceCollection = resolveCollectionForConfigPersistence()
  if (!persistenceCollection || isRestoringConfig.value) {
    return
  }

  const nextConfig = buildCollectionConfig()
  const currentConfig = persistenceCollection.config || {}
  if (JSON.stringify(currentConfig) === JSON.stringify(nextConfig)) {
    return
  }

  try {
    const collectionIdToUpdate = persistenceCollection.id
    await updateCollection(collectionIdToUpdate, {
      scope: props.scope,
      projectId: props.projectId,
      config: nextConfig,
    })
    if (activeCollection.value?.id === collectionIdToUpdate) {
      activeCollection.value = {
        ...activeCollection.value,
        config: nextConfig,
      }
    }

    collections.value = collections.value.map((collection) =>
      collection.id === collectionIdToUpdate
        ? { ...collection, config: nextConfig }
        : collection,
    )

    const collectionsComponentCollections = contentCollectionsRef.value?.collections
    if (collectionsComponentCollections?.value && Array.isArray(collectionsComponentCollections.value)) {
      collectionsComponentCollections.value = collectionsComponentCollections.value.map((collection: ContentCollection) => (
        collection.id === collectionIdToUpdate
          ? { ...collection, config: nextConfig }
          : collection
      ))
    }
  } catch (e: any) {
    console.warn('Failed to persist content library collection config', e)

    const now = Date.now()
    if (!lastConfigPersistToastAt.value || now - lastConfigPersistToastAt.value > 5000) {
      lastConfigPersistToastAt.value = now
      toast.add({
        title: t('common.error'),
        description: getApiErrorMessage(e, 'Failed to save collection settings'),
        color: 'error',
      })
    }
  }
}

const lastConfigPersistToastAt = ref<number | null>(null)

const handleActiveCollectionUpdate = async (nextCollection: ContentCollection | null) => {
  if (activeCollection.value?.id !== nextCollection?.id) {
    await persistActiveCollectionConfig()
  }

  activeCollection.value = nextCollection

  if (nextCollection?.type === 'GROUP' && !nextCollection.parentId) {
    localStorage.setItem(getGroupSelectionStorageKey(nextCollection.id), nextCollection.id)
  }
}

const debouncedPersistActiveCollectionConfig = useDebounceFn(persistActiveCollectionConfig, 350)

const restoreCollectionSettings = () => {
  if (!activeCollection.value) return
  isRestoringConfig.value = true
  const configSource = resolveCollectionForConfigPersistence() ?? activeCollection.value
  const config = (configSource.config as any) || {}
  q.value = activeCollection.value.type === 'SAVED_VIEW' ? (config.search || '') : ''
  selectedTags.value = activeCollection.value.type === 'SAVED_VIEW' ? (config.tags || '') : ''
  if (config.sortBy) sortBy.value = config.sortBy
  if (config.sortOrder) sortOrder.value = config.sortOrder
  setTimeout(() => { isRestoringConfig.value = false }, 100)
}

const persistLastSelectedGroupNode = (collection: ContentCollection) => {
  if (collection.type !== 'GROUP') {
    return
  }

  const rootId = getGroupRootCollectionId(collection)
  localStorage.setItem(getGroupSelectionStorageKey(rootId), collection.id)
}

const restoreLastSelectedGroupNode = (rootCollection: ContentCollection) => {
  if (rootCollection.type !== 'GROUP') {
    return
  }

  const rootId = getGroupRootCollectionId(rootCollection)
  const savedId = localStorage.getItem(getGroupSelectionStorageKey(rootId))
  if (!savedId || savedId === rootCollection.id) {
    return
  }

  const savedCollection = collectionsById.value.get(savedId)
  if (!savedCollection || savedCollection.type !== 'GROUP') {
    return
  }

  isRestoringGroupSelection.value = true
  selectedGroupTreeNodeId.value = savedCollection.id
  activeCollectionId.value = savedCollection.id
  activeCollection.value = savedCollection
  setTimeout(() => { isRestoringGroupSelection.value = false }, 50)
}

watch(activeCollection, async (newCollection, oldCollection) => {
  if (newCollection?.id !== oldCollection?.id) {
    if (!isRestoringGroupSelection.value) {
      selectedGroupTreeNodeId.value = newCollection?.type === 'GROUP' ? newCollection.id : null
    }
    selectedIds.value = []
    if (newCollection) {
      if (newCollection.type === 'GROUP') {
        if (!isRestoringGroupSelection.value && !newCollection.parentId) {
          if (skipAutoRestoreLastSelectedGroupNodeOnce.value) {
            skipAutoRestoreLastSelectedGroupNodeOnce.value = false
          } else {
            restoreLastSelectedGroupNode(newCollection)
            return
          }
        }

        if (newCollection.parentId) {
          persistLastSelectedGroupNode(newCollection)
        }
      }

      restoreCollectionSettings()
    }
    else {
      q.value = ''
      selectedTags.value = ''
      sortBy.value = 'createdAt'
      sortOrder.value = 'desc'
    }
    fetchItems({ reset: true })
    fetchAvailableTags()
  }
})

watch([activeCollectionId, collections], () => {
  if (!activeCollectionId.value || activeCollection.value?.id === activeCollectionId.value) {
    return
  }

  const next = collections.value.find(t => t.id === activeCollectionId.value) ?? null
  if (next) {
    activeCollection.value = next
  }
})

watch([activeCollection, collections], () => {
  if (isInitialDataLoaded.value) {
    return
  }

  if (collections.value.length === 0) {
    return
  }

  if (!activeCollection.value) {
    return
  }

  isInitialDataLoaded.value = true
  fetchAvailableTags()
  fetchItems({ reset: true })
}, { immediate: true })

watch([q, selectedTags, sortBy, sortOrder], () => {
  debouncedPersistActiveCollectionConfig()
}, { deep: true })

onMounted(() => {
  window.addEventListener('dragenter', handleWindowDragEnter)
  window.addEventListener('dragover', handleWindowDragOver)
  window.addEventListener('dragleave', handleWindowDragLeave)
  window.addEventListener('drop', handleWindowDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', handleWindowDragEnter)
  window.removeEventListener('dragover', handleWindowDragOver)
  window.removeEventListener('dragleave', handleWindowDragLeave)
  window.removeEventListener('drop', handleWindowDrop)
})

onMounted(async () => {
  const raw = route.query.contentItemId
  const contentItemId = typeof raw === 'string' ? raw : undefined
  if (!contentItemId) return
  try {
    const item = await api.get<any>(`/content-library/items/${contentItemId}`)
    openEditModal(item)
    const { contentItemId: _, ...rest } = route.query
    await router.replace({ query: rest })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to open content item'), color: 'error' })
  }
})

watch(() => props.projectId, (newVal) => {
  if (props.scope === 'project' && newVal) {
    fetchItems({ reset: true })
    fetchAvailableTags()
    fetchProject(newVal)
  }
})

watch(() => props.scope, () => {
  selectedTags.value = ''
  fetchAvailableTags()
  fetchItems({ reset: true })
})

if (props.scope === 'project' && props.projectId) {
  fetchProject(props.projectId)
}
</script>

<template>
  <div class="space-y-6">
    <ContentLibraryToolbar
      v-model:q="q"
      v-model:selected-tags="selectedTags"
      v-model:sort-by="sortBy"
      v-model:sort-order="sortOrder"
      v-model:archive-status="archiveStatus"
      :scope="scope"
      :project-id="projectId"
      :user-id="projectId ? undefined : useAuth()?.user?.value?.id"
      :group-id="activeCollection?.type === 'GROUP' ? activeCollection.id : undefined"
      :total-unfiltered="totalUnfiltered"
      :current-project="currentProject"
      :is-purging="isPurging"
      :active-collection="activeCollection"
      :is-start-creating="isStartCreating"
      :available-tags="availableTags"
      :sort-options="sortOptions"
      :current-sort-option="currentSortOption"
      :sort-order-icon="sortOrderIcon"
      :sort-order-label="sortOrderLabel"
      :is-window-file-drag-active="isWindowFileDragActive"
      :can-delete-active-collection="canDeleteActiveCollection"
      @purge="isPurgeConfirmModalOpen = true"
      @create="createAndEdit"
      @upload-files="uploadContentFiles"
      @rename-collection="openRenameCollectionModal"
      @delete-collection="openDeleteCollectionModal"
      @toggle-sort-order="toggleSortOrder"
    >
      <template #collections>
        <ContentCollections
          ref="contentCollectionsRef"
          v-model="activeCollectionId"
          :scope="scope"
          :project-id="props.projectId"
          @update:active-collection="handleActiveCollectionUpdate($event)"
          @update:collections="collections = $event"
        />
      </template>
    </ContentLibraryToolbar>

    <div
      class="mt-6 grid grid-cols-1 gap-6 items-start"
      :class="isActiveGroupCollection ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : 'xl:grid-cols-1'"
    >
      <div>
        <!-- Items Grid -->
        <div v-if="isLoading && items.length === 0" class="flex justify-center py-8">
          <UiLoadingSpinner />
        </div>

        <div v-else class="space-y-4">
          <CommonFoundCount :count="total" :show="q.length > 0 || selectedTags.length > 0" class="mb-2" />
          <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
            {{ error }}
          </div>

          <!-- Select All -->
          <div class="flex items-center justify-between gap-4 px-2">
            <UCheckbox
              :model-value="isAllSelected"
              :indeterminate="isSomeSelected"
              :disabled="items.length === 0"
              :label="isAllSelected ? t('common.deselectAll', 'Deselect all') : t('common.selectAll', 'Select all')"
              @update:model-value="toggleSelectAll"
            />

            <div v-if="isUploadingFiles" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-primary-500 animate-spin" />
              <span>{{ t('common.loading') }}</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ContentItemCard
              v-for="item in items"
              :key="item.id"
              :item="item"
              :selected="selectedIds.includes(item.id)"
              :is-archiving="isArchivingId === item.id"
              :is-restoring="isRestoringId === item.id"
              @click="openEditModal(item)"
              @toggle-selection="toggleSelection"
              @archive="archiveItem"
              @restore="restoreItem"
              @create-publication="handleCreatePublication"
              @move="handleOpenMoveModal([$event.id])"
            />
          </div>

          <div v-if="items.length === 0" class="py-10 text-center text-gray-500 dark:text-gray-400">
            {{ t('contentLibrary.empty', 'No items yet') }}
          </div>

          <div v-if="hasMore" class="pt-2 flex justify-center">
            <UButton
              :loading="isLoading"
              variant="outline"
              color="neutral"
              icon="i-heroicons-arrow-down"
              @click="loadMore"
            >
              {{ t('common.loadMore', 'Load more') }}
            </UButton>
          </div>
        </div>
      </div>

      <aside v-if="isActiveGroupCollection" class="app-card-lg border border-gray-200/70 dark:border-gray-700/70 space-y-4">
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('contentLibrary.groupsTree.title') }}
          </h3>
        </div>

        <div class="rounded-md border border-gray-200 dark:border-gray-800 p-3 max-h-128 overflow-auto">
          <div v-if="sidebarGroupTreeItems.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('contentLibrary.groupsTree.empty') }}
          </div>
          <UTree
            v-else
            :items="sidebarGroupTreeItems"
            :ui="{
              item: 'cursor-pointer'
            }"
          >
            <template #group-node-leading="{ item, expanded, handleToggle }">
              <UButton
                v-if="hasTreeChildren(item)"
                variant="ghost"
                color="neutral"
                size="xs"
                :icon="expanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                class="p-0.5"
                @click.stop="handleToggle"
              />
            </template>
            <template #group-node-label="{ item }">
              <span
                class="flex-1 truncate text-sm py-1 transition-colors cursor-pointer"
                :class="selectedGroupTreeNodeId === getGroupTreeNodeValue(item)
                  ? 'text-primary-600 dark:text-primary-300'
                  : 'text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-300'"
                @click.stop="handleSidebarGroupNodeSelect(getGroupTreeNodeValue(item))"
              >
                {{ getGroupTreeNodeLabel(item) }}
              </span>
            </template>
            <template #group-node-trailing="{ item }">
              <UDropdownMenu :items="getGroupNodeMenuItems(getGroupTreeNodeValue(item))">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-heroicons-ellipsis-horizontal"
                  :aria-label="t('contentLibrary.groupsTree.nodeMenuAriaLabel')"
                  @click.stop
                />
              </UDropdownMenu>
            </template>
          </UTree>
        </div>
      </aside>
    </div>


    <!-- Modals -->
    <UiConfirmModal
      v-if="isPurgeConfirmModalOpen"
      v-model:open="isPurgeConfirmModalOpen"
      :title="t('contentLibrary.actions.purgeConfirmTitle')"
      :description="t('contentLibrary.actions.purgeConfirmDescription')"
      :confirm-text="t('contentLibrary.actions.purgeArchived')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isPurging"
      @confirm="purgeArchived"
    />

    <UiConfirmModal
      v-if="isBulkOperationModalOpen"
      v-model:open="isBulkOperationModalOpen"
      :title="t('contentLibrary.bulk.deleteTitle')"
      :description="t('contentLibrary.bulk.deleteDescription', { count: selectedIds.length })"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isBulkDeleting"
      @confirm="executeBulkOperation"
    />

    <UiConfirmModal
      v-if="isMergeConfirmModalOpen"
      v-model:open="isMergeConfirmModalOpen"
      :title="t('contentLibrary.bulk.merge')"
      :description="t('contentLibrary.bulk.mergeConfirm', { count: selectedIds.length })"
      :confirm-text="t('contentLibrary.bulk.merge')"
      color="primary"
      icon="i-heroicons-square-3-stack-3d"
      :loading="isBulkDeleting"
      @confirm="executeBulkOperation"
    />

    <UiAppModal
      v-model:open="isTreeCreateModalOpen"
      :title="t('contentLibrary.collections.createSubgroupTitle')"
      :description="t('contentLibrary.groupsTree.selectedParentHint', { title: treeCreateParentLabel })"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isTreeCreateModalOpen = false"
    >
      <UFormField :label="t('common.title')">
        <UInput v-model="treeCreateTitle" autofocus @keydown.enter="handleCreateGroupFromTreeModal" />
      </UFormField>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTreeCreateModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isCreatingTreeGroup"
          :disabled="!treeCreateTitle.trim()"
          @click="handleCreateGroupFromTreeModal"
        >
          {{ t('common.create') }}
        </UButton>
      </template>
    </UiAppModal>

    <UiAppModal
      v-model:open="isTreeRenameModalOpen"
      :title="t('contentLibrary.collections.renameTitle', 'Rename group')"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isTreeRenameModalOpen = false"
    >
      <UFormField :label="t('common.title', 'Title')">
        <UInput v-model="treeRenameTitle" autofocus @keydown.enter="handleRenameGroupFromTree" />
      </UFormField>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTreeRenameModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isRenamingTreeGroup"
          :disabled="!treeRenameTitle.trim()"
          @click="handleRenameGroupFromTree"
        >
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>

    <UiConfirmModal
      v-if="isTreeDeleteConfirmModalOpen"
      v-model:open="isTreeDeleteConfirmModalOpen"
      :title="t('contentLibrary.collections.deleteTitle')"
      :description="t('contentLibrary.groupsTree.deleteConfirmDescription', { title: treeDeleteTargetLabel })"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingTreeGroup"
      @confirm="handleDeleteGroupFromTree"
    />

    <!-- Bulk Bar -->
    <ContentLibraryBulkBar
      :selected-ids="selectedIds"
      :archive-status="archiveStatus"
      :is-group-collection="isActiveGroupCollection"
      @archive="handleBulkAction('ARCHIVE')"
      @restore="handleBulkAction('UNARCHIVE')"
      @purge="handleBulkDeleteForever"
      @move="handleOpenMoveModal(selectedIds)"
      @merge="handleMerge"
      @create-publication="handleCreatePublicationFromSelection"
      @clear="selectedIds = []"
    />

    <UiAppModal
      v-model:open="isEditModalOpen"
      :title="t('contentLibrary.editTitle', 'Edit content item')"
      :ui="{ content: 'w-[90vw] max-w-5xl' }"
      @close="handleCloseModal"
    >
      <ContentItemEditor
        v-if="activeItem"
        ref="editorRef"
        :item="activeItem"
        :scope="props.scope"
        :project-id="props.projectId"
        :group-id="activeRootGroupId ?? undefined"
        @refresh="fetchItems({ reset: true })"
      />
      
      <template #footer>
        <div class="flex justify-between items-center w-full">
           <div class="text-xs text-gray-500 flex gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-paper-airplane"
                @click="handleCreatePublication(activeItem)"
              >
                {{ t('contentLibrary.actions.createPublication') }}
              </UButton>
           </div>
           <UButton 
            color="primary" 
            @click="handleCloseModal"
          >
            {{ t('common.done', 'Done') }}
          </UButton>
        </div>
      </template>
    </UiAppModal>
    
    <!-- Move to Project Modal -->
    <ContentMoveModal
      v-model:open="isMoveModalOpen"
      :ids="moveItemsIds"
      :scope="props.scope"
      :project-id="props.projectId"
      :active-collection="activeCollection"
      :collections="allGroupCollections"
      :projects="projects"
      :folder-tree-items="groupTreeItems"
      @move="handleExecuteMoveItems"
    />

    <!-- Rename Collection Modal -->
    <UiAppModal
      v-model:open="isRenameCollectionModalOpen"
      :title="t('contentLibrary.collections.renameTitle', 'Rename group')"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isRenameCollectionModalOpen = false"
    >
        <UFormField :label="t('common.title', 'Title')">
            <UInput v-model="newCollectionTitle" autofocus @keydown.enter="handleRenameCollection" />
        </UFormField>

        <template #footer>
             <UButton color="neutral" variant="ghost" @click="isRenameCollectionModalOpen = false">
                {{ t('common.cancel') }}
             </UButton>
             <UButton color="primary" :loading="isRenamingCollection" @click="handleRenameCollection">
                {{ t('common.save') }}
             </UButton>
        </template>
    </UiAppModal>

    <!-- Delete Collection Modal -->
    <UiConfirmModal
      v-if="isDeleteCollectionConfirmModalOpen"
      v-model:open="isDeleteCollectionConfirmModalOpen"
      :title="t('contentLibrary.collections.deleteTitle', 'Delete group')"
      :description="t('contentLibrary.collections.deleteDescription', 'Are you sure you want to delete this group? This action cannot be undone.')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingCollection"
      @confirm="handleDeleteCollection"
    />
  </div>
</template>
