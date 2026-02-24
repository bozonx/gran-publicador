import { type ContentCollection } from '~/composables/useContentCollections'

export interface ContentLibraryTabState {
  q: string
  selectedTags: string
  sortBy: 'createdAt' | 'title' | 'combined'
  sortOrder: 'asc' | 'desc'
  withMedia: boolean
}

const DEFAULT_TAB_STATE: ContentLibraryTabState = {
  q: '',
  selectedTags: '',
  sortBy: 'combined',
  sortOrder: 'desc',
  withMedia: true,
}

const getTabKey = (collectionId: string | null) => collectionId ?? '__default__'

export const useContentLibraryFilters = (activeCollectionId: Ref<string | null>) => {
  const tabStateByCollectionId = reactive<Record<string, ContentLibraryTabState>>({})

  const ensureTabState = (collectionId: string | null) => {
    const key = getTabKey(collectionId)
    if (!tabStateByCollectionId[key]) {
      tabStateByCollectionId[key] = {
        ...DEFAULT_TAB_STATE,
      }
    }
    return tabStateByCollectionId[key]
  }

  const currentTabState = computed(() => ensureTabState(activeCollectionId.value))

  const q = computed<string>({
    get() { return currentTabState.value.q },
    set(next) { currentTabState.value.q = next },
  })

  const selectedTags = computed<string>({
    get() { return currentTabState.value.selectedTags },
    set(next) { currentTabState.value.selectedTags = next },
  })

  const sortBy = computed<'createdAt' | 'title' | 'combined'>({
    get() { return currentTabState.value.sortBy },
    set(next) { currentTabState.value.sortBy = next },
  })

  const sortOrder = computed<'asc' | 'desc'>({
    get() { return currentTabState.value.sortOrder },
    set(next) { currentTabState.value.sortOrder = next },
  })

  const withMedia = computed<boolean>({
    get() { return currentTabState.value.withMedia },
    set(next) { currentTabState.value.withMedia = next },
  })

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

  return {
    q,
    selectedTags,
    sortBy,
    sortOrder,
    withMedia,
    currentTabState,
    ensureTabState,
    initTabStateFromCollectionConfigIfMissing,
    getSavedViewConfigBoolean,
  }
}
