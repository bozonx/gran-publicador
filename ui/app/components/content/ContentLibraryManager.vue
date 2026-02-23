<script setup lang="ts">
import { type ContentCollection } from '~/composables/useContentCollections'
import { getApiErrorMessage } from '~/utils/error'
import { aggregateSelectedItemsToPublicationOrThrow } from '~/composables/useContentLibraryPublicationAggregation'
import { parseTags } from '~/utils/tags'
import { buildDescendantsTree, getRootGroupId } from '~/composables/useContentLibraryGroupsTree'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import ContentCollections from './ContentCollections.vue'
import ContentLibraryToolbar from './ContentLibraryToolbar.vue'
import ContentLibraryBulkBar from './ContentLibraryBulkBar.vue'
import ContentLibraryTreeSidebar from './ContentLibraryTreeSidebar.vue'
import ContentLibraryItemsGrid from './ContentLibraryItemsGrid.vue'
import UnsplashPreviewModal from './UnsplashPreviewModal.vue'
import ContentLibraryModals from './ContentLibraryModals.vue'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
}>()

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const route = useRoute()
const { projects, currentProject } = useProjects()
const { updateCollection, deleteCollection } = useContentCollections()
const { uploadMedia } = useMedia()

const isWindowFileDragActive = ref(false)
const windowDragDepth = ref(0)

const openItemById = async (id: string) => {
  try {
    const item = await api.get<any>(`/content-library/items/${id}`)
    activeItem.value = item
    isEditModalOpen.value = true
  } catch (e) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to open content item'),
      color: 'error',
    })
  }
}

watch(
  () => route.query.openItemId,
  (next) => {
    const id = typeof next === 'string' ? next : Array.isArray(next) ? next[0] : null
    if (!id) return
    openItemById(id)
  },
  { immediate: true },
)

const isAnyModalOpen = computed(() => {
  return (
    isPurgeConfirmModalOpen.value ||
    isBulkOperationModalOpen.value ||
    isMergeConfirmModalOpen.value ||
    isEditModalOpen.value ||
    isPublicationPreviewModalOpen.value ||
    isCreateItemFromPublicationModalOpen.value ||
    isMoveModalOpen.value ||
    isRenameCollectionModalOpen.value ||
    isUnsplashPreviewModalOpen.value ||
    isCreateItemFromUnsplashModalOpen.value ||
    isDeleteCollectionConfirmModalOpen.value ||
    isCreatePublicationModalOpen.value
  )
})

const handleWindowDragEnter = (e: DragEvent) => {
  if (isAnyModalOpen.value) return
  if (e.dataTransfer?.types?.includes('Files')) {
    windowDragDepth.value++
    isWindowFileDragActive.value = true
  }
}

const handleWindowDragLeave = (e: DragEvent) => {
  if (isAnyModalOpen.value) return
  if (e.dataTransfer?.types?.includes('Files')) {
    windowDragDepth.value = Math.max(0, windowDragDepth.value - 1)
    if (windowDragDepth.value === 0) {
      isWindowFileDragActive.value = false
    }
  }
}

const handleWindowDrop = () => {
  if (isAnyModalOpen.value) return
  windowDragDepth.value = 0
  isWindowFileDragActive.value = false
}

if (import.meta.client) {
  useEventListener(window, 'dragenter', handleWindowDragEnter)
  useEventListener(window, 'dragleave', handleWindowDragLeave)
  useEventListener(window, 'drop', handleWindowDrop)
}

const canDeleteActiveCollection = computed(() => {
  return !!activeCollection.value
})

// State
const contentCollectionsRef = ref<any>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeCollectionId = ref<string | null>(null)
const activeCollection = ref<ContentCollection | null>(null)
const selectedGroupId = ref<string | null>(null)
const orphansOnly = ref(false)
const collections = ref<ContentCollection[]>([])
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = DEFAULT_PAGE_SIZE
const offset = ref(0)
const total = ref(0)
const totalUnfiltered = ref(0)
const totalInScope = ref(0)
const items = ref<any[]>([])
const availableTags = ref<string[]>([])
const selectedIds = ref<string[]>([])

const isSelectionDisabled = computed(() =>
  activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL' ||
  activeCollection.value?.type === 'UNSPLASH'
)

interface ContentLibraryTabState {
  q: string
  selectedTags: string
  sortBy: 'createdAt' | 'title' | 'combined'
  sortOrder: 'asc' | 'desc'
  withMedia: boolean
}

const tabStateByCollectionId = reactive<Record<string, ContentLibraryTabState>>({})

const DEFAULT_TAB_STATE: ContentLibraryTabState = {
  q: '',
  selectedTags: '',
  sortBy: 'combined',
  sortOrder: 'desc',
  withMedia: true,
}

const getTabKey = (collectionId: string | null) => collectionId ?? '__default__'

const ensureTabState = (collectionId: string | null) => {
  const key = getTabKey(collectionId)
  if (!tabStateByCollectionId[key]) {
    tabStateByCollectionId[key] = {
      ...DEFAULT_TAB_STATE,
    }
  }
  return tabStateByCollectionId[key]
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

const sortBy = computed<'createdAt' | 'title' | 'combined'>({
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

const withMedia = computed<boolean>({
  get() {
    return ensureTabState(activeCollectionId.value).withMedia
  },
  set(next) {
    ensureTabState(activeCollectionId.value).withMedia = next
  },
})

const selectedTagsArray = computed(() => parseTags(selectedTags.value))

const allScopeGroupCollections = computed(() => collections.value.filter(c => c.type === 'GROUP'))
const collectionsById = computed(() => new Map(collections.value.map(c => [c.id, c])))

const activeRootGroupId = computed(() => {
  if (activeCollection.value?.type !== 'GROUP') return undefined
  return getRootGroupId({
    activeGroupId: activeCollection.value.id,
    collectionsById: collectionsById.value as any,
  })
})

const getSelectedGroupStorageKey = () => {
  return `content-library-selected-group-${props.scope}-${props.projectId || 'global'}-${activeRootGroupId.value || 'none'}`
}

// Modals State
const isPurgeConfirmModalOpen = ref(false)
const isPurging = ref(false)
const isBulkOperationModalOpen = ref(false)
const isMergeConfirmModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'MERGE'>('DELETE')
const isBulkDeleting = ref(false)
const isEditModalOpen = ref(false)
const activeItem = ref<any | null>(null)
const isPublicationPreviewModalOpen = ref(false)
const activePublicationId = ref<string | null>(null)
const isCreateItemFromPublicationModalOpen = ref(false)
const isMoveModalOpen = ref(false)
const moveItemsIds = ref<string[]>([])
const isRenameCollectionModalOpen = ref(false)
const isUnsplashPreviewModalOpen = ref(false)
const isCreateItemFromUnsplashModalOpen = ref(false)
const newCollectionTitle = ref('')
const isDeleteCollectionConfirmModalOpen = ref(false)
const isRenamingCollection = ref(false)
const isDeletingCollection = ref(false)
const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)
const isUploadingFiles = ref(false)
const isUnsplashLoading = ref(false)
const isStartCreating = ref(false)

// Sorting Options
const sortOptions = computed(() => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') {
    return [
      { id: 'combined', label: t('publication.sort.chronology'), icon: 'i-heroicons-calendar-days' },
    ]
  }

  if (activeCollection.value?.type === 'UNSPLASH') {
    return [
      { id: 'combined', label: t('contentLibrary.unsplash.sortRelevance'), icon: 'i-heroicons-magnifying-glass' },
    ]
  }

  return [
    { id: 'createdAt', label: t('common.createdAt'), icon: 'i-heroicons-calendar-days' },
    { id: 'title', label: t('common.title'), icon: 'i-heroicons-document-text' },
  ]
})
const currentSortOption = computed(() => sortOptions.value.find(opt => opt.id === sortBy.value))
const sortOrderIcon = computed(() => sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down')
const sortOrderLabel = computed(() => sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc'))
function toggleSortOrder() { sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc' }

const isSavedView = (c: ContentCollection | null | undefined): c is ContentCollection => {
  return !!c && c.type === 'SAVED_VIEW'
}

const isPublicationMediaVirtual = (c: ContentCollection | null | undefined): c is ContentCollection => {
  return !!c && c.type === 'PUBLICATION_MEDIA_VIRTUAL'
}

const isUnsplash = (c: ContentCollection | null | undefined): c is ContentCollection => {
  return !!c && c.type === 'UNSPLASH'
}

const getSavedViewConfigBoolean = (collection: ContentCollection, key: string, defaultValue: boolean) => {
  const raw = (collection as any)?.config?.[key]
  return typeof raw === 'boolean' ? raw : defaultValue
}

const initTabStateFromCollectionConfigIfMissing = (collection: ContentCollection) => {
  if (!collection?.id) return

  const key = getTabKey(collection.id)
  if (tabStateByCollectionId[key]) return

  const base: ContentLibraryTabState = { ...DEFAULT_TAB_STATE }

  const cfg = (collection as any)?.config ?? {}
  if (cfg.sortBy === 'combined' || cfg.sortBy === 'createdAt' || cfg.sortBy === 'title') base.sortBy = cfg.sortBy
  if (cfg.sortOrder === 'asc' || cfg.sortOrder === 'desc') base.sortOrder = cfg.sortOrder

  if (collection.type === 'SAVED_VIEW') {
    const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
    const persistTags = getSavedViewConfigBoolean(collection, 'persistTags', true)

    if (persistSearch && typeof cfg.q === 'string') base.q = cfg.q
    if (persistTags && typeof cfg.selectedTags === 'string') base.selectedTags = cfg.selectedTags
  }

  if (collection.type === 'PUBLICATION_MEDIA_VIRTUAL') {
    const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
    const persistTags = getSavedViewConfigBoolean(collection, 'persistTags', false)

    if (persistSearch && typeof cfg.q === 'string') base.q = cfg.q
    if (persistTags && typeof cfg.selectedTags === 'string') base.selectedTags = cfg.selectedTags
    if (typeof cfg.withMedia === 'boolean') base.withMedia = cfg.withMedia
  }

  if (collection.type === 'UNSPLASH') {
    const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)

    if (persistSearch && typeof cfg.q === 'string') base.q = cfg.q
  }

  tabStateByCollectionId[key] = base
}

const updateCollectionsCache = (updated: ContentCollection) => {
  const idx = collections.value.findIndex(c => c.id === updated.id)
  if (idx !== -1) {
    // Preserve directItemsCount since PATCH responses don't include it
    const existing = collections.value[idx]
    if (!existing) return
    const merged = {
      ...updated,
      directItemsCount: updated.directItemsCount ?? existing.directItemsCount,
    }
    collections.value.splice(idx, 1, merged)
  }
}

const persistSavedViewStateToDb = async () => {
  const collection = activeCollection.value
  if (!isSavedView(collection)) return

  const state = ensureTabState(collection.id)
  const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
  const persistTags = getSavedViewConfigBoolean(collection, 'persistTags', true)

  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    persistSearch,
    persistTags,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  }

  if (persistSearch) nextConfig.q = state.q
  else delete nextConfig.q

  if (persistTags) nextConfig.selectedTags = state.selectedTags
  else delete nextConfig.selectedTags

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })

  activeCollection.value = updated
  updateCollectionsCache(updated)
}

const persistPublicationMediaVirtualStateToDb = async () => {
  const collection = activeCollection.value
  if (!isPublicationMediaVirtual(collection)) return

  const state = ensureTabState(collection.id)
  const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
  const persistTags = getSavedViewConfigBoolean(collection, 'persistTags', false)

  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    persistSearch,
    persistTags,
    sortBy: state.sortBy,
    withMedia: state.withMedia,
    sortOrder: state.sortOrder,
  }

  if (persistSearch) nextConfig.q = state.q
  else delete nextConfig.q

  if (persistTags) nextConfig.selectedTags = state.selectedTags
  else delete nextConfig.selectedTags

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })

  activeCollection.value = updated
  updateCollectionsCache(updated)
}

const persistGroupSortStateToDb = async () => {
  const collection = activeCollection.value
  if (!collection || collection.type !== 'GROUP') return

  const state = ensureTabState(collection.id)
  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  }

  delete nextConfig.q
  delete nextConfig.selectedTags

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })

  activeCollection.value = updated
  updateCollectionsCache(updated)
}

const debouncedPersistSavedViewStateToDb = useDebounceFn(async () => {
  try {
    await persistSavedViewStateToDb()
  } catch {
    // ignore persistence errors
  }
}, 500)

const debouncedPersistGroupSortStateToDb = useDebounceFn(async () => {
  try {
    await persistGroupSortStateToDb()
  } catch {
    // ignore persistence errors
  }
}, 500)

const debouncedPersistPublicationMediaVirtualStateToDb = useDebounceFn(async () => {
  try {
    await persistPublicationMediaVirtualStateToDb()
  } catch {
    // ignore persistence errors
  }
}, 500)

const persistUnsplashStateToDb = async () => {
  const collection = activeCollection.value
  if (!isUnsplash(collection)) return

  const state = ensureTabState(collection.id)
  const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    persistSearch,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  }

  delete nextConfig.persistTags

  if (persistSearch) nextConfig.q = state.q
  else delete nextConfig.q

  delete nextConfig.selectedTags

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })

  activeCollection.value = updated
  updateCollectionsCache(updated)
}

const debouncedPersistUnsplashStateToDb = useDebounceFn(async () => {
  try {
    await persistUnsplashStateToDb()
  } catch {
    // ignore persistence errors
  }
}, 500)

const setSavedViewPersistSearch = async (value: boolean) => {
  const collection = activeCollection.value
  if (!isSavedView(collection) && !isPublicationMediaVirtual(collection) && !isUnsplash(collection)) return

  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    persistSearch: value,
  }
  if (!value) delete nextConfig.q

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })
  activeCollection.value = updated
  updateCollectionsCache(updated)
}

const setSavedViewPersistTags = async (value: boolean) => {
  const collection = activeCollection.value
  if (!isSavedView(collection) && !isPublicationMediaVirtual(collection)) return

  const nextConfig: Record<string, any> = {
    ...(typeof (collection as any).config === 'object' && (collection as any).config !== null
      ? (collection as any).config
      : {}),
    persistTags: value,
  }
  if (!value) delete nextConfig.selectedTags

  const updated = await updateCollection(collection.id, {
    scope: props.scope,
    projectId: props.projectId,
    config: nextConfig,
  })
  activeCollection.value = updated
  updateCollectionsCache(updated)
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
    if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') {
      const sortByParam = 'combined'

      const res = await api.get<any>(`/content-library/collections/${activeCollection.value.id}/items`, {
        params: {
          scope: props.scope,
          projectId: props.projectId,
          search: q.value || undefined,
          limit,
          offset: offset.value,
          sortBy: 'combined',
          sortOrder: sortOrder.value,
          tags: selectedTagsArray.value.length > 0 ? selectedTagsArray.value.join(',') : undefined,
          withMedia: withMedia.value,
        },
      })
      if (requestId !== fetchItemsRequestId) return

      const nextItems = res.items ?? []

      total.value = Number(res.total ?? nextItems.length)
      if (typeof res.totalUnfiltered === 'number') totalUnfiltered.value = res.totalUnfiltered
      else if (offset.value === 0) totalUnfiltered.value = total.value
      if (offset.value === 0) totalInScope.value = total.value

      if (offset.value === 0) items.value = nextItems
      else items.value = [...items.value, ...nextItems]
      return
    }

    if (activeCollection.value?.type === 'UNSPLASH') {
      const res = await api.get<any>(`/content-library/collections/${activeCollection.value.id}/items`, {
        params: {
          scope: props.scope,
          projectId: props.projectId,
          search: q.value || undefined,
          limit,
          offset: offset.value,
        },
      })
      if (requestId !== fetchItemsRequestId) return

      const nextItems = res.items ?? []

      total.value = Number(res.total ?? nextItems.length)
      if (typeof res.totalUnfiltered === 'number') totalUnfiltered.value = res.totalUnfiltered
      else if (offset.value === 0) totalUnfiltered.value = total.value
      if (offset.value === 0) totalInScope.value = total.value

      if (offset.value === 0) items.value = nextItems
      else items.value = [...items.value, ...nextItems]
      return
    }

    const res = await api.get<any>('/content-library/items', {
      params: {
        scope: props.scope,
        projectId: props.projectId,
        archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
        groupIds:
          activeCollection.value?.type === 'GROUP'
            ? [selectedGroupId.value ?? activeCollection.value.id]
            : undefined,
        orphansOnly: activeCollection.value?.type === 'SAVED_VIEW' && orphansOnly.value ? true : undefined,
        search: q.value || undefined,
        limit,
        offset: offset.value,
        sortBy: sortBy.value === 'combined' ? 'createdAt' : sortBy.value,
        sortOrder: sortOrder.value,
        tags: selectedTagsArray.value.length > 0 ? selectedTagsArray.value : undefined,
        includeTotalUnfiltered: offset.value === 0 ? true : undefined,
        includeTotalInScope: offset.value === 0 ? true : undefined,
      },
    })
    if (requestId !== fetchItemsRequestId) return

    total.value = res.total
    if (typeof res.totalUnfiltered === 'number') totalUnfiltered.value = res.totalUnfiltered
    else if (offset.value === 0) totalUnfiltered.value = res.total

    if (typeof res.totalInScope === 'number') totalInScope.value = res.totalInScope
    else if (offset.value === 0) totalInScope.value = (res.totalUnfiltered ?? res.total)

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
    if (activeCollection.value.type === 'PUBLICATION_MEDIA_VIRTUAL' || activeCollection.value.type === 'UNSPLASH') {
      if (requestId !== fetchAvailableTagsRequestId) return
      availableTags.value = []
      return
    }

    const tags = await api.get<string[]>('/content-library/tags', {
      params: {
        scope: props.scope,
        projectId: props.projectId,
        groupId: activeCollection.value.type === 'GROUP' ? (selectedGroupId.value ?? activeCollection.value.id) : undefined,
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
watch([archiveStatus, selectedTags, sortBy, sortOrder, withMedia], () => fetchItems({ reset: true }))
watch(activeCollection, (next, prev) => {
  if (next?.id !== prev?.id) {
    selectedIds.value = []
    if (next) initTabStateFromCollectionConfigIfMissing(next)
    if (next?.type === 'PUBLICATION_MEDIA_VIRTUAL') {
      sortBy.value = 'combined'
      selectedIds.value = []
    } else if (next?.type === 'UNSPLASH') {
      sortBy.value = 'combined'
      selectedIds.value = []
    } else {
      if (sortBy.value !== 'createdAt' && sortBy.value !== 'title') {
        sortBy.value = 'createdAt'
      }
    }
    if (next?.type === 'GROUP') {
      let restoredGroupId: string | null = null
      if (import.meta.client) {
        restoredGroupId = localStorage.getItem(getSelectedGroupStorageKey())
      }

      const isValidRestoredId =
        !!restoredGroupId &&
        collectionsById.value.has(restoredGroupId) &&
        getRootGroupId({
          activeGroupId: restoredGroupId,
          collectionsById: collectionsById.value as any,
        }) === activeRootGroupId.value

      selectedGroupId.value = isValidRestoredId ? restoredGroupId : next.id
      orphansOnly.value = false
    } else {
      selectedGroupId.value = null
      orphansOnly.value = false
    }
    fetchAvailableTags()
    fetchItems({ reset: true })
  }
})
watch([q, selectedTags, sortBy, sortOrder, activeCollectionId], () => {
  const collection = activeCollection.value
  if (!collection) return

  if (collection.type === 'SAVED_VIEW') {
    const persistSearch = getSavedViewConfigBoolean(collection, 'persistSearch', false)
    const persistTags = getSavedViewConfigBoolean(collection, 'persistTags', true)
    if (!persistSearch && !persistTags) {
      return
    }
    debouncedPersistSavedViewStateToDb()
    return
  }

  if (collection.type === 'GROUP') {
    debouncedPersistGroupSortStateToDb()
  }

  if (collection.type === 'PUBLICATION_MEDIA_VIRTUAL') {
    debouncedPersistPublicationMediaVirtualStateToDb()
  }

  if (collection.type === 'UNSPLASH') {
    debouncedPersistUnsplashStateToDb()
  }
})

watch(selectedGroupId, (next) => {
  if (activeCollection.value?.type !== 'GROUP') return
  selectedIds.value = []
  if (!next) return
  if (!import.meta.client) return
  if (!activeRootGroupId.value) return
  localStorage.setItem(getSelectedGroupStorageKey(), next)
})
const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)
const hasMore = computed(() => items.value.length < total.value)

// Actions
const loadMore = () => { if (!isLoading.value && hasMore.value) { offset.value += limit; fetchItems() } }
const toggleSelection = (id: string) => {
  if (isSelectionDisabled.value) return
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) selectedIds.value.push(id)
  else selectedIds.value.splice(idx, 1)
}
const toggleSelectAll = () => {
  if (isSelectionDisabled.value) return
  if (items.value.length === 0) return
  if (items.value.every(i => selectedIds.value.includes(i.id))) selectedIds.value = []
  else selectedIds.value = items.value.map(i => i.id)
}

const uploadContentFiles = async (files: File[]) => {
  if (!files.length || (props.scope === 'project' && !props.projectId)) return
  if (isUploadingFiles.value) return
  isUploadingFiles.value = true
  const targetGroupId =
    activeCollection.value?.type === 'GROUP'
      ? (selectedGroupId.value ?? activeCollection.value.id)
      : undefined
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
    contentCollectionsRef.value?.fetchCollections()
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
  unsplashId: undefined as string | undefined,
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
    unsplashId: undefined,
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

const handleCreatePublicationFromUnsplash = (item: any) => {
  if (!item) return

  const virtual = item._virtual || {}
  const title = item.title || virtual.altDescription || ''
  const content = item.text || item.note || ''
  const tags = Array.isArray(item.tags) ? item.tags : []
  const unsplashId = virtual.unsplashId || item.id

  const projectId = props.scope === 'project' ? props.projectId : undefined
  createPublicationModalProjectId.value = projectId
  createPublicationModalAllowProjectSelection.value = !projectId

  publicationData.value = {
    title,
    content,
    mediaIds: [],
    tags,
    note: '',
    contentItemIds: [],
    unsplashId,
  }

  isUnsplashPreviewModalOpen.value = false
  isCreatePublicationModalOpen.value = true
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
    contentCollectionsRef.value?.fetchCollections()
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
        contentCollectionsRef.value?.fetchCollections()
        selectedIds.value = []
        isBulkOperationModalOpen.value = false; isMergeConfirmModalOpen.value = false
        toast.add({ title: t('common.success'), color: 'success' })
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to update items'), color: 'error' })
    } finally { isBulkDeleting.value = false }
}

const archiveItem = async (id: string) => { isArchivingId.value = id; try { await api.post(`/content-library/items/${id}/archive`, {}); await fetchItems({ reset: true }); contentCollectionsRef.value?.fetchCollections() } finally { isArchivingId.value = null } }
const restoreItem = async (id: string) => { isRestoringId.value = id; try { await api.post(`/content-library/items/${id}/restore`, {}); await fetchItems({ reset: true }); contentCollectionsRef.value?.fetchCollections() } finally { isRestoringId.value = null } }
const deleteItemForever = async (id: string) => {
  try {
    await api.delete(`/content-library/items/${id}`)
    await fetchItems({ reset: true })
    contentCollectionsRef.value?.fetchCollections()
    toast.add({ title: t('common.success'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete item'), color: 'error' })
  }
}

const handleSelectGroupCollection = (id: string) => {
  if (!id) {
    selectedGroupId.value = null
    return
  }

  selectedGroupId.value = id
}

const handleActiveCollectionUpdate = (c: ContentCollection | null) => {
    const prevId = activeCollection.value?.id
    activeCollection.value = c
    activeCollectionId.value = c?.id ?? null
    
    if (c?.id === 'system-trash') {
      archiveStatus.value = 'archived'
      selectedGroupId.value = null
      orphansOnly.value = false
      return
    }

    archiveStatus.value = 'active'
    if (c) {
      initTabStateFromCollectionConfigIfMissing(c)
    }
    if (c?.type === 'GROUP') {
      // Only reset selectedGroupId when switching to a different collection tab
      if (c.id !== prevId) {
        selectedGroupId.value = c.id
      }
      orphansOnly.value = false
    } else {
      selectedGroupId.value = null
      orphansOnly.value = false
    }
}

const setOrphansOnly = (value: boolean) => {
  orphansOnly.value = value
  fetchItems({ reset: true })
}

const purgeArchived = async () => {
    isPurging.value = true
    try {
        const url = props.scope === 'project' ? `/content-library/projects/${props.projectId}/purge-archived` : '/content-library/personal/purge-archived'
        await api.post(url, {})
        await fetchItems({ reset: true })
        contentCollectionsRef.value?.fetchCollections()
        isPurgeConfirmModalOpen.value = false
        toast.add({ title: t('common.success'), color: 'success' })
    } catch (e) {
        toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to purge archived items'), color: 'error' })
    } finally { isPurging.value = false }
}

const handleExecuteMoveItems = async (data: any) => {
    try {
        await api.post('/content-library/bulk', {
            operation: data.operation,
            ids: moveItemsIds.value,
            groupId: data.groupId ?? undefined,
            projectId: data.projectId ?? undefined,
            sourceGroupId: data.operation === 'MOVE_TO_GROUP'
              ? (data.sourceGroupId ?? selectedGroupId.value ?? activeCollection.value?.id)
              : undefined,
        })
        await fetchItems({ reset: true })
        contentCollectionsRef.value?.fetchCollections()
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
    const deletedId = activeCollectionId.value
    const deletedParentId = activeCollection.value?.parentId

    await deleteCollection(deletedId, props.scope, props.projectId)

    // Attempt to find a suitable next collection
    let nextCollection: ContentCollection | null = null
    if (deletedParentId) {
      nextCollection = collections.value.find((c) => c.id === deletedParentId) || null
    }

    if (!nextCollection) {
      // Filter out what was just deleted (approximation since recursive delete happened on server)
      const remaining = collections.value.filter((c) => c.id !== deletedId && c.parentId !== deletedId)
      nextCollection = remaining[0] || null
    }

    activeCollectionId.value = nextCollection?.id ?? null
    activeCollection.value = nextCollection

    isDeleteCollectionConfirmModalOpen.value = false
    await contentCollectionsRef.value?.fetchCollections()
  } catch (e) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to delete collection'),
      color: 'error',
    })
  } finally {
    isDeletingCollection.value = false
  }
}

const createAndEdit = async () => {
    isStartCreating.value = true
    try {
        const res = await api.post<any>('/content-library/items', {
            scope: props.scope,
            projectId: props.projectId,
            groupId: activeCollection.value?.type === 'GROUP' ? (selectedGroupId.value ?? activeCollection.value.id) : undefined,
            text: '', meta: {}, media: []
        })
        await fetchItems({ reset: true })
        contentCollectionsRef.value?.fetchCollections()
        activeItem.value = res; isEditModalOpen.value = true
    } finally { isStartCreating.value = false }
}

const handleRefreshItems = async (opts?: { reset?: boolean }) => {
  await fetchItems(opts)
  contentCollectionsRef.value?.fetchCollections()
}

const handleCloseModal = () => { isEditModalOpen.value = false; activeItem.value = null }
const handleOpenMoveModal = (ids: string[]) => { moveItemsIds.value = ids; isMoveModalOpen.value = true }
const handleMerge = () => { bulkOperationType.value = 'MERGE'; isMergeConfirmModalOpen.value = true }
const handleBulkDeleteForever = () => { bulkOperationType.value = 'DELETE'; isBulkOperationModalOpen.value = true }

const handleOpenItem = (item: any) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') {
    const publicationId = item?._virtual?.publicationId || item?.id
    activePublicationId.value = typeof publicationId === 'string' ? publicationId : null
    isPublicationPreviewModalOpen.value = true
    return
  }

  // UNSPLASH items open a preview modal
  if (activeCollection.value?.type === 'UNSPLASH') {
    activeItem.value = item
    isUnsplashPreviewModalOpen.value = true
    return
  }

  activeItem.value = item
  isEditModalOpen.value = true
}

const handleArchiveFromGrid = (id: string) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') return
  if (activeCollection.value?.type === 'UNSPLASH') return
  archiveItem(id)
}

const handleRestoreFromGrid = (id: string) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') return
  if (activeCollection.value?.type === 'UNSPLASH') return
  restoreItem(id)
}

const handleDeleteForeverFromGrid = (id: string) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') return
  if (activeCollection.value?.type === 'UNSPLASH') return
  deleteItemForever(id)
}

const handleCreatePublicationFromGrid = (item: any) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') return
  if (activeCollection.value?.type === 'UNSPLASH') return
  handleCreatePublication(item)
}

const handleMoveFromGrid = (ids: string[]) => {
  if (activeCollection.value?.type === 'PUBLICATION_MEDIA_VIRTUAL') return
  if (activeCollection.value?.type === 'UNSPLASH') return
  handleOpenMoveModal(ids)
}

let fetchAvailableTagsRequestId = 0

onMounted(() => { fetchItems() })
</script>

<template>
  <div class="relative">

    <ContentLibraryToolbar
      v-model:q="q"
      v-model:selectedTags="selectedTags"
      v-model:sortBy="sortBy"
      v-model:sortOrder="sortOrder"
      v-model:withMedia="withMedia"
      :scope="scope"
      :project-id="projectId"
      :user-id="projectId ? undefined : useAuth()?.user?.value?.id"
      :group-ids="activeCollection?.type === 'GROUP' ? [selectedGroupId ?? activeCollection.id] : undefined"
      :orphans-only="orphansOnly"
      :total-unfiltered="totalUnfiltered"
      :total-in-scope="totalInScope"
      :current-project="currentProject"
      :archive-status="archiveStatus"
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
      @update:archive-status="(v) => (archiveStatus = v)"
      @purge="() => (isPurgeConfirmModalOpen = true)"
      @create="createAndEdit"
      @upload-files="uploadContentFiles"
      @rename-collection="() => { newCollectionTitle = activeCollection?.title || ''; isRenameCollectionModalOpen = true }"
      @delete-collection="() => { isDeleteCollectionConfirmModalOpen = true }"
      @toggle-sort-order="toggleSortOrder"
      @set-saved-view-persist-search="setSavedViewPersistSearch"
      @set-saved-view-persist-tags="setSavedViewPersistTags"
      @set-orphans-only="setOrphansOnly"
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
        :disable-selection="isSelectionDisabled"
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
        :hide-actions="activeCollection?.type === 'PUBLICATION_MEDIA_VIRTUAL' || activeCollection?.type === 'UNSPLASH'"
        :is-unsplash="activeCollection?.type === 'UNSPLASH'"
        :active-collection-id="activeCollectionId"
        :active-collection-type="activeCollection?.type"
        @select-all="toggleSelectAll"
        @toggle-selection="toggleSelection"
        @load-more="loadMore"
        @open-edit="handleOpenItem"
        @archive="handleArchiveFromGrid"
        @restore="handleRestoreFromGrid"
        @delete-forever="handleDeleteForeverFromGrid"
        @create-publication="handleCreatePublicationFromGrid"
        @move="handleMoveFromGrid($event)"
      />

      <ContentLibraryTreeSidebar
        v-if="activeCollection?.type === 'GROUP'"
        :scope="scope"
        :project-id="projectId"
        :collections="collections"
        :active-collection="activeCollection"
        :selected-node-id="selectedGroupId"
        @select-node="handleSelectGroupCollection"
        @refresh-collections="() => contentCollectionsRef?.fetchCollections()"
        @refresh-items="fetchItems"
      />
    </div>

    <ContentLibraryBulkBar
      v-if="!isSelectionDisabled"
      :selected-ids="selectedIds"
      :archive-status="archiveStatus"
      :is-group-collection="activeCollection?.type === 'GROUP'"
      :hide-create-publication="activeCollection?.type === 'PUBLICATION_MEDIA_VIRTUAL'"
      @archive="handleBulkAction('ARCHIVE')"
      @restore="handleBulkAction('UNARCHIVE')"
      @purge="handleBulkDeleteForever"
      @move="handleOpenMoveModal(selectedIds)"
      @merge="handleMerge"
      @create-publication="handleCreatePublicationFromSelection"
      @clear="selectedIds = []"
    />

    <ContentLibraryModals
      v-model:is-purge-confirm-modal-open="isPurgeConfirmModalOpen"
      v-model:is-bulk-operation-modal-open="isBulkOperationModalOpen"
      v-model:is-merge-confirm-modal-open="isMergeConfirmModalOpen"
      v-model:is-edit-modal-open="isEditModalOpen"
      v-model:is-publication-preview-modal-open="isPublicationPreviewModalOpen"
      v-model:is-create-item-from-publication-modal-open="isCreateItemFromPublicationModalOpen"
      v-model:is-create-item-from-unsplash-modal-open="isCreateItemFromUnsplashModalOpen"
      v-model:is-move-modal-open="isMoveModalOpen"
      v-model:is-rename-collection-modal-open="isRenameCollectionModalOpen"
      v-model:is-delete-collection-confirm-modal-open="isDeleteCollectionConfirmModalOpen"
      v-model:new-collection-title="newCollectionTitle"
      :scope="scope"
      :project-id="projectId"
      :is-purging="isPurging"
      :bulk-operation-type="bulkOperationType"
      :is-bulk-deleting="isBulkDeleting"
      :selected-ids-count="selectedIds.length"
      :active-item="activeItem"
      :active-root-group-id="activeRootGroupId"
      :active-publication-id="activePublicationId"
      :move-items-ids="moveItemsIds"
      :active-collection="activeCollection"
      :current-group-id="selectedGroupId"
      :all-group-collections="collections"
      :projects="projects" 
      :group-tree-items="groupTreeItems"
      :is-renaming-collection="isRenamingCollection"
      :is-deleting-collection="isDeletingCollection"
      @purge="purgeArchived"
      @bulk-operation="executeBulkOperation"
      @refresh-items="handleRefreshItems"
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
      :prefilled-unsplash-id="publicationData.unsplashId"
    />

    <UnsplashPreviewModal
      v-model:open="isUnsplashPreviewModalOpen"
      :item="activeItem"
      @add-to-library="isCreateItemFromUnsplashModalOpen = true; isUnsplashPreviewModalOpen = false"
      @create-publication="handleCreatePublicationFromUnsplash"
    />
  </div>
</template>
