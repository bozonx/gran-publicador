<script setup lang="ts">
import { type ContentCollection } from '~/composables/useContentCollections'
import { getApiErrorMessage } from '~/utils/error'
import { aggregateSelectedItemsToPublicationOrThrow } from '~/composables/useContentLibraryPublicationAggregation'
import { parseTags } from '~/utils/tags'
import { buildDescendantsTree, getRootGroupId } from '~/composables/useContentLibraryGroupsTree'
import ContentCollections from './ContentCollections.vue'
import ContentLibraryToolbar from './ContentLibraryToolbar.vue'
import ContentLibraryBulkBar from './ContentLibraryBulkBar.vue'
import ContentLibraryTreeSidebar from './ContentLibraryTreeSidebar.vue'
import ContentLibraryItemsGrid from './ContentLibraryItemsGrid.vue'
import ContentLibraryModals from './ContentLibraryModals.vue'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
}>()

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const { projects, currentProject } = useProjects()
const { updateCollection, deleteCollection } = useContentCollections()
const { uploadMedia } = useMedia()

// State
const contentCollectionsRef = ref<any>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeCollectionId = ref<string | null>(null)
const activeCollection = ref<ContentCollection | null>(null)
const collections = ref<ContentCollection[]>([])
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const totalUnfiltered = ref(0)
const items = ref<any[]>([])
const availableTags = ref<string[]>([])
const selectedIds = ref<string[]>([])

interface ContentLibraryTabState {
  q: string
  selectedTags: string
  sortBy: 'createdAt' | 'title'
  sortOrder: 'asc' | 'desc'
  hasRestoredFromStorage: boolean
}

const tabStateByCollectionId = reactive<Record<string, ContentLibraryTabState>>({})

const DEFAULT_TAB_STATE: Omit<ContentLibraryTabState, 'hasRestoredFromStorage'> = {
  q: '',
  selectedTags: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
}

const getTabKey = (collectionId: string | null) => collectionId ?? '__default__'

const ensureTabState = (collectionId: string | null) => {
  const key = getTabKey(collectionId)
  if (!tabStateByCollectionId[key]) {
    tabStateByCollectionId[key] = {
      ...DEFAULT_TAB_STATE,
      hasRestoredFromStorage: false,
    }
  }
  return tabStateByCollectionId[key]
}

const getTabStorageKey = (collectionId: string) => {
  return `content-library-tab-state-${props.scope}-${props.projectId || 'global'}-${collectionId}`
}

const q = computed<string>({
  get() {
    return ensureTabState(activeCollectionId.value).q
  },
  set(next) {
    ensureTabState(activeCollectionId.value).q = next
  },
})

const selectedTags = computed<string>({
  get() {
    return ensureTabState(activeCollectionId.value).selectedTags
  },
  set(next) {
    ensureTabState(activeCollectionId.value).selectedTags = next
  },
})

const sortBy = computed<'createdAt' | 'title'>({
  get() {
    return ensureTabState(activeCollectionId.value).sortBy
  },
  set(next) {
    ensureTabState(activeCollectionId.value).sortBy = next
  },
})

const sortOrder = computed<'asc' | 'desc'>({
  get() {
    return ensureTabState(activeCollectionId.value).sortOrder
  },
  set(next) {
    ensureTabState(activeCollectionId.value).sortOrder = next
  },
})

const selectedTagsArray = computed(() => parseTags(selectedTags.value))

const allScopeGroupCollections = computed(() => collections.value.filter(c => c.type === 'GROUP'))
const collectionsById = computed(() => new Map(collections.value.map(c => [c.id, c])))

// Modals State
const isPurgeConfirmModalOpen = ref(false)
const isPurging = ref(false)
const isBulkDeleting = ref(false)
const isBulkOperationModalOpen = ref(false)
const isMergeConfirmModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'MERGE'>('DELETE')
const isEditModalOpen = ref(false)
const activeItem = ref<any | null>(null)
const isMoveModalOpen = ref(false)
const moveItemsIds = ref<string[]>([])
const isRenameCollectionModalOpen = ref(false)
const newCollectionTitle = ref('')
const isDeleteCollectionConfirmModalOpen = ref(false)
const isRenamingCollection = ref(false)
const isDeletingCollection = ref(false)
const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)
const isUploadingFiles = ref(false)
const isStartCreating = ref(false)

// Sorting Options
const sortOptions = computed(() => [
  { id: 'createdAt', label: t('common.createdAt'), icon: 'i-heroicons-calendar-days' },
  { id: 'title', label: t('common.title'), icon: 'i-heroicons-document-text' }
])
const currentSortOption = computed(() => sortOptions.value.find(opt => opt.id === sortBy.value))
const sortOrderIcon = computed(() => sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down')
const sortOrderLabel = computed(() => sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc'))
function toggleSortOrder() { sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc' }

const restoreTabStateFromStorage = (collection: ContentCollection) => {
  const state = ensureTabState(collection.id)
  if (state.hasRestoredFromStorage) return
  state.hasRestoredFromStorage = true

  const raw = localStorage.getItem(getTabStorageKey(collection.id))
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as Partial<ContentLibraryTabState>
    if (collection.type === 'SAVED_VIEW') {
      if (typeof parsed.q === 'string') state.q = parsed.q
      if (typeof parsed.selectedTags === 'string') state.selectedTags = parsed.selectedTags
      if (parsed.sortBy === 'createdAt' || parsed.sortBy === 'title') state.sortBy = parsed.sortBy
      if (parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc') state.sortOrder = parsed.sortOrder
      return
    }

    if (collection.type === 'GROUP') {
      if (parsed.sortBy === 'createdAt' || parsed.sortBy === 'title') state.sortBy = parsed.sortBy
      if (parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc') state.sortOrder = parsed.sortOrder
    }
  } catch {
    // ignore invalid storage
  }
}

const persistActiveTabStateToStorage = () => {
  const collection = activeCollection.value
  if (!collection) return
  if (collection.type !== 'SAVED_VIEW' && collection.type !== 'GROUP') return

  const state = ensureTabState(collection.id)
  if (!state.hasRestoredFromStorage) return

  const payload: Partial<ContentLibraryTabState> = {}
  if (collection.type === 'SAVED_VIEW') {
    payload.q = state.q
    payload.selectedTags = state.selectedTags
    payload.sortBy = state.sortBy
    payload.sortOrder = state.sortOrder
  } else if (collection.type === 'GROUP') {
    payload.sortBy = state.sortBy
    payload.sortOrder = state.sortOrder
  }

  try {
    localStorage.setItem(getTabStorageKey(collection.id), JSON.stringify(payload))
  } catch {
    // ignore quota / disabled storage
  }
}

// Group Tree helpers for Move Modal
const groupTreeItems = computed(() => {
  if (activeCollection.value?.type !== 'GROUP') return []

  return buildDescendantsTree({
    rootId: activeCollection.value.id,
    allGroupCollections: allScopeGroupCollections.value,
    labelFn: (c) => c.title,
  })
})

const activeRootGroupId = computed(() => {
  if (activeCollection.value?.type !== 'GROUP') return undefined
  return getRootGroupId({
    activeGroupId: activeCollection.value.id,
    collectionsById: collectionsById.value as any,
  })
})

// Data Fetching
let fetchItemsRequestId = 0
const fetchItems = async (opts?: { reset?: boolean }) => {
  const requestId = ++fetchItemsRequestId
  if (props.scope === 'project' && !props.projectId) return

  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }
  isLoading.value = true
  error.value = null
  try {
    const res = await api.get<any>('/content-library/items', {
      params: {
        scope: props.scope,
        projectId: props.projectId,
        archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
        groupId: activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined,
        search: q.value || undefined,
        limit,
        offset: offset.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        tags: selectedTagsArray.value.length > 0 ? selectedTagsArray.value : undefined,
        includeTotalUnfiltered: offset.value === 0 ? true : undefined,
      },
    })
    if (requestId !== fetchItemsRequestId) return

    total.value = res.total
    if (typeof res.totalUnfiltered === 'number') totalUnfiltered.value = res.totalUnfiltered
    else if (offset.value === 0) totalUnfiltered.value = res.total

    if (offset.value === 0) items.value = res.items
    else items.value = [...items.value, ...res.items]
  } catch (e: any) {
    if (requestId === fetchItemsRequestId) error.value = getApiErrorMessage(e, 'Failed to load content library')
  } finally {
    if (requestId === fetchItemsRequestId) isLoading.value = false
  }
}

const fetchAvailableTags = async () => {
  const requestId = ++fetchAvailableTagsRequestId
  try {
    if (!activeCollection.value) return
    const tags = await api.get<string[]>('/content-library/tags', {
      params: {
        scope: props.scope,
        projectId: props.projectId,
        groupId: activeCollection.value.type === 'GROUP' ? activeCollection.value.id : undefined,
      }
    })
    if (requestId !== fetchAvailableTagsRequestId) return
    availableTags.value = tags
  } catch (e) {
    if (requestId !== fetchAvailableTagsRequestId) return
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to load tags'), color: 'error' })
  }
}

// Watchers
watch(() => q.value, () => { selectedIds.value = []; debouncedFetch() })
watch([archiveStatus, selectedTags, sortBy, sortOrder], () => fetchItems({ reset: true }))
watch(activeCollection, (next, prev) => {
  if (next?.id !== prev?.id) {
    if (next) restoreTabStateFromStorage(next)
    fetchAvailableTags()
    fetchItems({ reset: true })
  }
})
watch([q, selectedTags, sortBy, sortOrder, activeCollectionId], () => persistActiveTabStateToStorage())
const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)
const hasMore = computed(() => items.value.length < total.value)

// Actions
const loadMore = () => { if (!isLoading.value && hasMore.value) { offset.value += limit; fetchItems() } }
const toggleSelection = (id: string) => { const idx = selectedIds.value.indexOf(id); if (idx === -1) selectedIds.value.push(id); else selectedIds.value.splice(idx, 1) }
const toggleSelectAll = () => { if (items.value.length === 0) return; if (items.value.every(i => selectedIds.value.includes(i.id))) selectedIds.value = []; else selectedIds.value = items.value.map(i => i.id) }

const uploadContentFiles = async (files: File[]) => {
  if (!files.length || (props.scope === 'project' && !props.projectId)) return
  if (isUploadingFiles.value) return
  isUploadingFiles.value = true
  const targetGroupId = activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined
  try {
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (['txt', 'md'].includes(ext || '')) {
        const text = await new Promise<string>((res, rej) => {
          const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(file)
        })
        await api.post('/content-library/items', { scope: props.scope, projectId: props.projectId, groupId: targetGroupId, title: file.name, text, meta: {}, media: [] })
      } else {
        const media = await uploadMedia(file, undefined, undefined, props.projectId)
        await api.post('/content-library/items', { scope: props.scope, projectId: props.projectId, groupId: targetGroupId, title: file.name, text: '', meta: {}, media: [{ mediaId: media.id, order: 0, hasSpoiler: false }] })
      }
    }
    await fetchItems({ reset: true })
    toast.add({ title: t('common.success'), description: t('contentLibrary.actions.uploadMediaSuccess', { count: files.length }), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to upload files'), color: 'error' })
  } finally { isUploadingFiles.value = false }
}

const VALIDATION_LIMITS = {
  MAX_REORDER_MEDIA: 100,
  MAX_PUBLICATION_CONTENT_LENGTH: 100000,
  MAX_NOTE_LENGTH: 5000,
  MAX_TAGS_LENGTH: 1000,
  MAX_TAGS_COUNT: 50,
  MAX_TITLE_LENGTH: 500,
}

const isCreatePublicationModalOpen = ref(false)
const createPublicationModalProjectId = ref<string | undefined>(undefined)
const createPublicationModalAllowProjectSelection = ref(false)
const publicationData = ref({
  title: '',
  content: '',
  mediaIds: [] as Array<{ id: string; hasSpoiler?: boolean }>,
  tags: [] as string[],
  note: '',
  contentItemIds: [] as string[],
})

const openCreatePublicationModalForItems = (selected: any[]) => {
  const data = aggregateSelectedItemsToPublicationOrThrow(selected, VALIDATION_LIMITS)

  const projectId = data.projectId ?? (props.scope === 'project' ? props.projectId : undefined)
  createPublicationModalProjectId.value = projectId
  createPublicationModalAllowProjectSelection.value = data.allowProjectSelection || !projectId

  publicationData.value = {
    title: data.title,
    content: data.content,
    mediaIds: data.media,
    tags: data.tags,
    note: data.note,
    contentItemIds: data.contentItemIds,
  }
  isCreatePublicationModalOpen.value = true
}

const handleCreatePublication = (item: any) => {
  try {
    openCreatePublicationModalForItems([item])
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create publication'), color: 'error' })
  }
}

const handleCreatePublicationFromSelection = () => {
  try {
    const selected = items.value.filter(i => selectedIds.value.includes(i.id))
    openCreatePublicationModalForItems(selected)
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create publication'), color: 'error' })
  }
}

const isBulkOperating = ref(false)
const handleBulkAction = async (type: 'ARCHIVE' | 'UNARCHIVE') => {
  if (selectedIds.value.length === 0) return

  isBulkOperating.value = true
  try {
    await api.post('/content-library/bulk', {
      ids: selectedIds.value,
      operation: type,
      projectId: props.scope === 'project' ? props.projectId : undefined,
    })
    await fetchItems({ reset: true })
    selectedIds.value = []
    toast.add({ title: t('common.success'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to update items'), color: 'error' })
  } finally {
    isBulkOperating.value = false
  }
}

const executeBulkOperation = async () => {
    isBulkDeleting.value = true
    try {
        await api.post('/content-library/bulk', {
          ids: selectedIds.value,
          operation: bulkOperationType.value,
          projectId: props.scope === 'project' ? props.projectId : undefined,
        })
        await fetchItems({ reset: true })
        selectedIds.value = []
        isBulkOperationModalOpen.value = false; isMergeConfirmModalOpen.value = false
        toast.add({ title: t('common.success'), color: 'success' })
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to update items'), color: 'error' })
    } finally { isBulkDeleting.value = false }
}

const archiveItem = async (id: string) => { isArchivingId.value = id; try { await api.post(`/content-library/items/${id}/archive`, {}); await fetchItems({ reset: true }) } finally { isArchivingId.value = null } }
const restoreItem = async (id: string) => { isRestoringId.value = id; try { await api.post(`/content-library/items/${id}/restore`, {}); await fetchItems({ reset: true }) } finally { isRestoringId.value = null } }
const deleteItemForever = async (id: string) => {
  try {
    await api.delete(`/content-library/items/${id}`)
    await fetchItems({ reset: true })
    toast.add({ title: t('common.success'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete item'), color: 'error' })
  }
}

const handleSelectGroupCollection = (id: string) => {
  if (!id) {
    activeCollectionId.value = null
    activeCollection.value = null
    return
  }

  const c = collectionsById.value.get(id)
  if (!c) return

  activeCollectionId.value = id
  activeCollection.value = c
}

const handleActiveCollectionUpdate = (c: ContentCollection | null) => {
    activeCollection.value = c
    activeCollectionId.value = c?.id ?? null
}

const purgeArchived = async () => {
    isPurging.value = true
    try {
        const url = props.scope === 'project' ? `/content-library/projects/${props.projectId}/purge-archived` : '/content-library/personal/purge-archived'
        await api.post(url, {})
        await fetchItems({ reset: true })
        isPurgeConfirmModalOpen.value = false
        toast.add({ title: t('common.success'), color: 'success' })
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to purge archived items'), color: 'error' })
    } finally { isPurging.value = false }
}

const handleExecuteMoveItems = async (data: any) => {
    try {
        const bulkProjectId = data.targetProjectId
          ? data.targetProjectId
          : (props.scope === 'project' ? props.projectId : undefined)

        await api.post('/content-library/bulk', {
            operation: data.targetProjectId ? 'SET_PROJECT' : 'LINK_TO_GROUP',
            ids: moveItemsIds.value,
            groupId: data.targetGroupId,
            projectId: bulkProjectId,
        })
        await fetchItems({ reset: true })
        isMoveModalOpen.value = false; moveItemsIds.value = []
        toast.add({ title: t('common.success'), color: 'success' })
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to move items'), color: 'error' })
    }
}

const handleRenameCollection = async () => {
    const title = newCollectionTitle.value.trim()
    if (!activeCollectionId.value || !title) return
    isRenamingCollection.value = true
    try {
        const updated = await updateCollection(activeCollectionId.value, { scope: props.scope, projectId: props.projectId, title })
        activeCollection.value = updated
        activeCollectionId.value = updated.id
        isRenameCollectionModalOpen.value = false
        contentCollectionsRef.value?.fetchCollections()
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename collection'), color: 'error' })
    } finally { isRenamingCollection.value = false }
}

const handleDeleteCollection = async () => {
    if (!activeCollectionId.value) return
    isDeletingCollection.value = true
    try {
        await deleteCollection(activeCollectionId.value, props.scope, props.projectId)
        activeCollectionId.value = null; activeCollection.value = null
        isDeleteCollectionConfirmModalOpen.value = false
        contentCollectionsRef.value?.fetchCollections()
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete collection'), color: 'error' })
    } finally { isDeletingCollection.value = false }
}

const createAndEdit = async () => {
    isStartCreating.value = true
    try {
        const res = await api.post<any>('/content-library/items', {
            scope: props.scope,
            projectId: props.projectId,
            groupId: activeCollection.value?.type === 'GROUP' ? activeCollection.value.id : undefined,
            text: '', meta: {}, media: []
        })
        await fetchItems({ reset: true })
        activeItem.value = res; isEditModalOpen.value = true
    } finally { isStartCreating.value = false }
}

const handleCloseModal = () => { isEditModalOpen.value = false; activeItem.value = null }
const handleOpenMoveModal = (ids: string[]) => { moveItemsIds.value = ids; isMoveModalOpen.value = true }
const handleMerge = () => { bulkOperationType.value = 'MERGE'; isMergeConfirmModalOpen.value = true }
const handleBulkDeleteForever = () => { bulkOperationType.value = 'DELETE'; isBulkOperationModalOpen.value = true }

let fetchAvailableTagsRequestId = 0

onMounted(() => { fetchItems() })
</script>

<template>
  <div class="relative">

    <ContentLibraryToolbar
      :scope="scope"
      :project-id="projectId"
      :user-id="projectId ? undefined : useAuth()?.user?.value?.id"
      :group-id="activeCollection?.type === 'GROUP' ? activeCollection.id : undefined"
      :total-unfiltered="totalUnfiltered"
      :current-project="currentProject"
      v-model:archiveStatus="archiveStatus"
      v-model:q="q"
      v-model:selectedTags="selectedTags"
      v-model:sortBy="sortBy"
      v-model:sortOrder="sortOrder"
      :is-purging="isPurging"
      :active-collection="activeCollection"
      :is-start-creating="isStartCreating"
      :available-tags="availableTags"
      :sort-options="sortOptions"
      :current-sort-option="currentSortOption"
      :sort-order-icon="sortOrderIcon"
      :sort-order-label="sortOrderLabel"
      :can-delete-active-collection="!!activeCollection"
      @purge="isPurgeConfirmModalOpen = true"
      @create="createAndEdit"
      @upload-files="uploadContentFiles"
      @rename-collection="isRenameCollectionModalOpen = true; newCollectionTitle = activeCollection?.title || ''"
      @delete-collection="isDeleteCollectionConfirmModalOpen = true"
      @toggle-sort-order="toggleSortOrder"
    >
      <template #collections>
        <ContentCollections
          ref="contentCollectionsRef"
          v-model="activeCollectionId"
          :scope="scope"
          :project-id="projectId"
          @update:active-collection="handleActiveCollectionUpdate"
          @update:collections="collections = $event"
        />
      </template>
    </ContentLibraryToolbar>

    <div
      class="mt-6 grid grid-cols-1 gap-6 items-start"
      :class="activeCollection?.type === 'GROUP' ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : 'xl:grid-cols-1'"
    >
      <ContentLibraryItemsGrid
        :items="items"
        :selected-ids="selectedIds"
        :is-loading="isLoading"
        :has-more="hasMore"
        :total="total"
        :total-unfiltered="totalUnfiltered"
        :archive-status="archiveStatus"
        :q="q"
        :selected-tags="selectedTags"
        :error="error"
        :is-uploading-files="isUploadingFiles"
        :is-archiving-id="isArchivingId"
        :is-restoring-id="isRestoringId"
        @select-all="toggleSelectAll"
        @toggle-selection="toggleSelection"
        @load-more="loadMore"
        @open-edit="item => { activeItem = item; isEditModalOpen = true }"
        @archive="archiveItem"
        @restore="restoreItem"
        @delete-forever="deleteItemForever"
        @create-publication="handleCreatePublication"
        @move="handleOpenMoveModal($event)"
      />

      <ContentLibraryTreeSidebar
        v-if="activeCollection?.type === 'GROUP'"
        :scope="scope"
        :project-id="projectId"
        :collections="collections"
        :active-collection="activeCollection"
        :selected-node-id="activeCollectionId"
        @select-node="handleSelectGroupCollection"
        @refresh-collections="() => contentCollectionsRef?.fetchCollections()"
        @refresh-items="fetchItems"
      />
    </div>

    <ContentLibraryBulkBar
      :selected-ids="selectedIds"
      :archive-status="archiveStatus"
      :is-group-collection="activeCollection?.type === 'GROUP'"
      @archive="handleBulkAction('ARCHIVE')"
      @restore="handleBulkAction('UNARCHIVE')"
      @purge="handleBulkDeleteForever"
      @move="handleOpenMoveModal(selectedIds)"
      @merge="handleMerge"
      @create-publication="handleCreatePublicationFromSelection"
      @clear="selectedIds = []"
    />

    <ContentLibraryModals
      v-model:isPurgeConfirmModalOpen="isPurgeConfirmModalOpen"
      v-model:isBulkOperationModalOpen="isBulkOperationModalOpen"
      v-model:isMergeConfirmModalOpen="isMergeConfirmModalOpen"
      v-model:isEditModalOpen="isEditModalOpen"
      v-model:isMoveModalOpen="isMoveModalOpen"
      v-model:isRenameCollectionModalOpen="isRenameCollectionModalOpen"
      v-model:isDeleteCollectionConfirmModalOpen="isDeleteCollectionConfirmModalOpen"
      v-model:newCollectionTitle="newCollectionTitle"
      :scope="scope"
      :project-id="projectId"
      :is-purging="isPurging"
      :bulk-operation-type="bulkOperationType"
      :is-bulk-deleting="isBulkDeleting"
      :selected-ids-count="selectedIds.length"
      :active-item="activeItem"
      :active-root-group-id="activeRootGroupId"
      :move-items-ids="moveItemsIds"
      :active-collection="activeCollection"
      :all-group-collections="allScopeGroupCollections"
      :projects="projects" 
      :group-tree-items="groupTreeItems"
      :is-renaming-collection="isRenamingCollection"
      :is-deleting-collection="isDeletingCollection"
      @purge="purgeArchived"
      @bulk-operation="executeBulkOperation"
      @refresh-items="fetchItems"
      @create-publication="handleCreatePublication"
      @execute-move="handleExecuteMoveItems"
      @rename-collection="handleRenameCollection"
      @delete-collection="handleDeleteCollection"
    />

    <ModalsCreatePublicationModal
      v-if="isCreatePublicationModalOpen"
      v-model:open="isCreatePublicationModalOpen"
      :project-id="createPublicationModalProjectId"
      :allow-project-selection="createPublicationModalAllowProjectSelection"
      :prefilled-title="publicationData.title"
      :prefilled-content="publicationData.content"
      :prefilled-media-ids="publicationData.mediaIds"
      :prefilled-tags="publicationData.tags"
      :prefilled-note="publicationData.note"
      :prefilled-content-item-ids="publicationData.contentItemIds"
    />
  </div>
</template>
