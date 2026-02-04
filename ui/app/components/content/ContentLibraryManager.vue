<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import yaml from 'js-yaml'
import { VueDraggable } from 'vue-draggable-plus'
import { type ContentLibraryTab, useContentLibraryTabs } from '~/composables/useContentLibraryTabs'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import AppModal from '~/components/ui/AppModal.vue'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import ContentBlockEditor from '~/components/forms/content/ContentBlockEditor.vue'
import BulkUploadModal from '~/components/forms/content/BulkUploadModal.vue'
import ContentLibraryTabs from '~/components/content/ContentLibraryTabs.vue'

const VALIDATION_LIMITS = {
  MAX_REORDER_MEDIA: 100,
  MAX_PUBLICATION_CONTENT_LENGTH: 100000,
  MAX_NOTE_LENGTH: 5000,
  MAX_TAGS_LENGTH: 1000,
  MAX_TAGS_COUNT: 50,
  MAX_TITLE_LENGTH: 500,
}

interface TabConfig {
  search?: string
  tags?: string[]
  sortBy?: 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
}>()

interface ContentBlockMedia {
  id: string
  order: number
  hasSpoiler: boolean
  media: {
    id: string
    mimeType?: string | null
    url?: string | null
    fileName?: string | null
  }
}

interface ContentBlock {
  id?: string
  text?: string | null
  order: number
  meta?: any
  media?: ContentBlockMedia[]
}

interface ContentItem {
  id: string
  title: string | null
  note: string | null
  tags: string[]
  createdAt: string
  archivedAt: string | null
  blocks: ContentBlock[]
}

interface FindContentItemsResponse {
  items: ContentItem[]
  total: number
  limit: number
  offset: number
}

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const { projects, currentProject, fetchProject, fetchProjects } = useProjects()
const { updateTab, deleteTab } = useContentLibraryTabs()
const { formatDateShort, truncateContent } = useFormatters()

// const projectId = computed(() => route.params.id as string) // Replaced by props.projectId

const isLoading = ref(false)
const error = ref<string | null>(null)

const activeTabId = ref<string | null>(null)
const activeTab = ref<ContentLibraryTab | null>(null)

const q = ref('')
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const items = ref<ContentItem[]>([])
const availableTags = ref<string[]>([])
const selectedTags = ref<string[]>([])



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

onMounted(async () => {
  const raw = route.query.contentItemId
  const contentItemId = typeof raw === 'string' ? raw : undefined
  if (!contentItemId) return

  try {
    const item = await api.get<ContentItem>(`/content-library/items/${contentItemId}`)
    openEditModal(item)
    const { contentItemId: _, ...rest } = route.query
    await router.replace({ query: rest })
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to open content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
})

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// Configuration persistence logic
const isRestoringConfig = ref(false)

// Helper to get current config from state
const getCurrentConfig = (): TabConfig => ({
  search: q.value || undefined,
  tags: selectedTags.value.length > 0 ? selectedTags.value : undefined,
  sortBy: sortBy.value,
  sortOrder: sortOrder.value
})

const saveTabSettings = useDebounceFn(async () => {
  if (!activeTab.value || isRestoringConfig.value) return

  try {
    const config = getCurrentConfig()

    // Update local state to keep UI in sync if we switch back without reload
    if (activeTab.value.config) {
      Object.assign(activeTab.value.config, config)
    }

    await updateTab(activeTab.value.id, {
      scope: props.scope,
      projectId: props.projectId,
      config
    })
  } catch (e) {
    console.error('Failed to save tab settings', e)
  }
}, 1000)

const restoreTabSettings = () => {
  if (!activeTab.value) return

  isRestoringConfig.value = true
  
  const config = activeTab.value.config as TabConfig || {}
  
  q.value = config.search || ''
  selectedTags.value = config.tags || []
  
  if (config.sortBy) sortBy.value = config.sortBy
  if (config.sortOrder) sortOrder.value = config.sortOrder
  
  if (!config.sortBy) {
    sortBy.value = 'createdAt'
  }
  
  if (!config.sortOrder) {
    sortOrder.value = 'desc'
  }

  // Allow next tick for watchers to settle before enabling save
  setTimeout(() => {
    isRestoringConfig.value = false
  }, 100)
}

// Watchers for saving settings
watch([q, selectedTags, sortBy, sortOrder], () => {
  if (!isRestoringConfig.value && activeTab.value) {
    saveTabSettings()
  }
}, { deep: true })

watch(sortBy, (val) => {
  saveTabSettings()
  fetchItems({ reset: true })
})

watch(sortOrder, (val) => {
  saveTabSettings()
  fetchItems({ reset: true })
})

const isStartCreating = ref(false)

const isEditModalOpen = ref(false)
const activeItem = ref<ContentItem | null>(null)

const isBulkUploadModalOpen = ref(false)

const isPurgeConfirmModalOpen = ref(false)
const isPurging = ref(false)

const isArchiveModalOpen = ref(false)
const itemToArchive = ref<ContentItem | null>(null)

const editForm = ref({
  id: '',
  title: '',
  tags: '',
  note: '',
  blocks: [] as ContentBlock[],
})


const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)

// Selection state
const selectedIds = ref<string[]>([])
const isBulkDeleting = ref(false)
const isBulkOperationModalOpen = ref(false)
const isMergeConfirmModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'MERGE'>('DELETE')

const isCreatePublicationModalOpen = ref(false)
const createPublicationModalProjectId = ref<string | undefined>(undefined)
const createPublicationModalAllowProjectSelection = ref(false)
const publicationData = ref({
  title: '',
  content: '',
  mediaIds: [] as any[],
  tags: '',
  note: '',
  contentItemIds: [] as string[]
})

const PUBLICATION_SEPARATOR = '\n\n---\n\n'

const normalizePublicationTags = (rawTags: string[]): string[] => {
  const normalized = (rawTags ?? [])
    .map(t => (t ?? '').toString().trim())
    .filter(Boolean)
    .map(t => t.toLowerCase())
    .slice(0, VALIDATION_LIMITS.MAX_TAGS_COUNT)

  const deduped = Array.from(new Set(normalized))
  return deduped.slice(0, VALIDATION_LIMITS.MAX_TAGS_COUNT)
}

const joinPublicationTags = (tags: string[]): string => {
  return tags.join(', ')
}

const isItemEmptyForPublication = (item: any): boolean => {
  const hasAnyText = (item.blocks || [])
    .some((b: any) => stripHtmlAndSpecialChars(b.text || '').trim().length > 0)
  const hasAnyMedia = (item.blocks || [])
    .some((b: any) => (b.media || []).some((m: any) => !!m.mediaId))
  const hasAnyNote = stripHtmlAndSpecialChars(item.note || '').trim().length > 0
  const hasAnyTitle = (item.title || '').toString().trim().length > 0

  return !(hasAnyText || hasAnyMedia || hasAnyNote || hasAnyTitle)
}

const aggregateSelectedItemsToPublicationOrThrow = (selectedItems: any[]) => {
  const itemsToUse = (selectedItems || []).filter(item => !isItemEmptyForPublication(item))
  if (itemsToUse.length === 0) {
    throw new Error('EMPTY_SELECTION')
  }

  const titleParts: string[] = []
  const contentParts: string[] = []
  const noteParts: string[] = []
  const allTags: string[] = []

  // mediaId -> chosen media input (chosen from the latest block.order)
  const mediaPick = new Map<string, { input: { id: string; hasSpoiler?: boolean }; blockOrder: number }>()

  const projectIds = new Set<string>()

  for (const item of itemsToUse) {
    if (item.projectId) projectIds.add(item.projectId)

    const title = (item.title || '').toString().trim()
    if (title) titleParts.push(title)

    const note = (item.note || '').toString().trim()
    if (note) noteParts.push(note)

    for (const tag of (item.tags || [])) {
      if (typeof tag === 'string') allTags.push(tag)
    }

    const sortedBlocks = (item.blocks || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    for (const block of sortedBlocks) {
      const blockText = stripHtmlAndSpecialChars(block.text || '').trim()
      if (blockText) contentParts.push(blockText)

      const blockOrder = Number(block.order ?? 0)
      const sortedMedia = (block.media || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      for (const link of sortedMedia) {
        const mediaId = link?.mediaId
        if (!mediaId) continue

        const candidate = { id: mediaId, hasSpoiler: link.hasSpoiler ? true : undefined }
        const prev = mediaPick.get(mediaId)
        if (!prev || blockOrder >= prev.blockOrder) {
          mediaPick.set(mediaId, { input: candidate, blockOrder })
        }
      }
    }
  }

  const title = titleParts.join(' | ')
  const content = contentParts.join(PUBLICATION_SEPARATOR)
  const note = Array.from(new Set(noteParts)).join(PUBLICATION_SEPARATOR)

  const tags = joinPublicationTags(normalizePublicationTags(allTags))

  const media = Array.from(mediaPick.values())
    .sort((a, b) => a.blockOrder - b.blockOrder)
    .map(x => x.input)

  if (title.length > VALIDATION_LIMITS.MAX_TITLE_LENGTH) {
    throw new Error('LIMIT_TITLE')
  }
  if (content.length > VALIDATION_LIMITS.MAX_PUBLICATION_CONTENT_LENGTH) {
    throw new Error('LIMIT_CONTENT')
  }
  if (note.length > VALIDATION_LIMITS.MAX_NOTE_LENGTH) {
    throw new Error('LIMIT_NOTE')
  }
  if (tags.length > VALIDATION_LIMITS.MAX_TAGS_LENGTH) {
    throw new Error('LIMIT_TAGS')
  }
  if (media.length > VALIDATION_LIMITS.MAX_REORDER_MEDIA) {
    throw new Error('LIMIT_MEDIA')
  }

  return {
    title,
    content,
    note,
    tags,
    media,
    projectId: projectIds.size === 1 ? Array.from(projectIds)[0] : undefined,
    allowProjectSelection: projectIds.size !== 1,
    contentItemIds: itemsToUse.map(i => i.id),
  }
}

// Tab Management
const contentLibraryTabsRef = ref<any>(null)
const isRenameTabModalOpen = ref(false)
const tabToRename = ref<ContentLibraryTab | null>(null)
const newTabTitle = ref('')
const isDeleteTabConfirmModalOpen = ref(false)
const tabToDelete = ref<ContentLibraryTab | null>(null)
const isRenamingTab = ref(false)
const isDeletingTab = ref(false)

const openRenameTabModal = () => {
    if (!activeTab.value) return
    tabToRename.value = activeTab.value
    newTabTitle.value = activeTab.value.title
    isRenameTabModalOpen.value = true
}

const handleRenameTab = async () => {
    if (!tabToRename.value || !newTabTitle.value.trim()) return
    
    isRenamingTab.value = true
    try {
        await updateTab(tabToRename.value.id, {
            scope: props.scope,
            projectId: props.projectId,
            title: newTabTitle.value
        })
        
        // Update local state if needed, but fetchTabs in child should handle it if we trigger it
        if (activeTab.value && activeTab.value.id === tabToRename.value.id) {
            activeTab.value.title = newTabTitle.value
        }
        
        contentLibraryTabsRef.value?.fetchTabs()
        isRenameTabModalOpen.value = false
        tabToRename.value = null
    } catch (e: any) {
        toast.add({
            title: t('common.error'),
            description: getApiErrorMessage(e, 'Failed to rename tab'),
            color: 'error'
        })
    } finally {
        isRenamingTab.value = false
    }
}

const openDeleteTabModal = () => {
    if (!activeTab.value) return
    tabToDelete.value = activeTab.value
    isDeleteTabConfirmModalOpen.value = true
}

const handleDeleteTab = async () => {
    if (!tabToDelete.value) return
    
    isDeletingTab.value = true
    try {
        await deleteTab(tabToDelete.value.id, props.scope, props.projectId)
        
        contentLibraryTabsRef.value?.fetchTabs()
        activeTab.value = null // clear active tab
        activeTabId.value = null
        
        isDeleteTabConfirmModalOpen.value = false
        tabToDelete.value = null
        
        toast.add({
            title: t('common.success'),
            description: t('contentLibrary.tabs.deleteSuccess', 'Tab deleted'),
            color: 'success'
        })
    } catch (e: any) {
         toast.add({
            title: t('common.error'),
            description: getApiErrorMessage(e, 'Failed to delete tab'),
            color: 'error'
        })
    } finally {
        isDeletingTab.value = false
    }
}

const isAllSelected = computed(() => {
  return items.value.length > 0 && items.value.every(item => selectedIds.value.includes(item.id))
})

const isSomeSelected = computed(() => {
  return selectedIds.value.length > 0 && !isAllSelected.value
})

function toggleSelectAll() {
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

const hasMore = computed(() => items.value.length < total.value)

// Auto-save setup
const { saveStatus, saveError, forceSave } = useAutosave({
  data: toRef(() => editForm.value),
  saveFn: async (data: any) => {
    if (!isEditModalOpen.value || !activeItem.value) return
    await saveItem(data)
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const parseTags = (raw: string): string[] => {
  return raw
    .split(/[,\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
}

const formatTags = (tags: string[]): string => {
  return (tags ?? []).join(', ')
}

const getApiErrorMessage = (e: any, fallback: string) => {
  return (
    e?.data?.message ||
    e?.data?.error?.message ||
    e?.response?._data?.message ||
    e?.message ||
    fallback
  )
}

const fetchItems = async (opts?: { reset?: boolean }) => {
  // if (!projectId.value) return // Only check if scope is project
  if (props.scope === 'project' && !props.projectId) return

  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }

  isLoading.value = true
  error.value = null

  try {
    const res = await api.get<FindContentItemsResponse>('/content-library/items', {
      params: {
        scope: props.scope === 'personal' ? 'personal' : 'project',
        projectId: props.scope === 'project' ? props.projectId : undefined,
        folderId: (activeTab.value?.type === 'FOLDER' ? activeTab.value.id : undefined),
        search: q.value || undefined,
        limit,
        offset: offset.value,
        archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
        includeArchived: false,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        tags: selectedTags.value.length > 0 ? selectedTags.value.join(',') : undefined,
      },
    })

    total.value = res.total

    if (offset.value === 0) {
      items.value = res.items
    } else {
      items.value = [...items.value, ...res.items]
    }
  } catch (e: any) {
    error.value = getApiErrorMessage(e, 'Failed to load content library')
  } finally {
    isLoading.value = false
  }
}

const fetchAvailableTags = async () => {
  try {
    const tags = await api.get<string[]>('/content-library/tags', {
      params: {
        scope: props.scope === 'personal' ? 'personal' : 'project',
        projectId: props.scope === 'project' ? props.projectId : undefined,
      }
    })
    availableTags.value = tags
  } catch (e) {
    console.error('Failed to fetch available tags', e)
  }
}

const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return
  offset.value += limit
  await fetchItems()
}

const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)

watch(
  () => q.value,
  () => {
    selectedIds.value = []
    debouncedFetch()
  },
)

watch(selectedTags, () => {
  fetchItems({ reset: true })
})

watch(activeTab, async (newTab, oldTab) => {
  if (newTab?.id !== oldTab?.id) {
    // Save previous tab settings immediately before switching
    if (oldTab && !isRestoringConfig.value) {
       // Capture state BEFORE restoreTabSettings modifies it
       const config = getCurrentConfig()
       // Fire and forget - or await if we want to be sure? 
       // Better to just call updateTab. We don't want to block UI excessively but we want to ensure it sends.
       try {
         // Also update the oldTab object in memory if possible (though it's a prop clone/ref)
         if (oldTab.config) Object.assign(oldTab.config, config)
         
         await updateTab(oldTab.id, {
           scope: props.scope,
           projectId: props.projectId,
           config
         })
       } catch (e) {
         console.error('Failed to save previous tab settings', e)
       }
    }

    selectedIds.value = []
    if (newTab) {
      restoreTabSettings()
    } else {
      // Reset to defaults when clearing tab
      q.value = ''
      selectedTags.value = []
      sortBy.value = 'createdAt'
      sortOrder.value = 'desc'
    }
    fetchItems({ reset: true })
  }
})

watch(
  () => archiveStatus.value,
  () => {
    selectedIds.value = []
    fetchItems({ reset: true })
  },
)

watch(() => props.projectId, (newVal) => {
  if (props.scope === 'project' && newVal) {
    fetchItems({ reset: true })
    fetchAvailableTags()
    fetchProject(newVal)
  }
})

watch(() => props.scope, () => {
  selectedTags.value = []
  fetchAvailableTags()
  fetchItems({ reset: true })
})

  fetchAvailableTags()
  fetchItems({ reset: true })
  if (props.scope === 'project' && props.projectId) {
    fetchProject(props.projectId)
  }

const createAndEdit = async () => {
  if (props.scope === 'project' && !props.projectId) return

  isStartCreating.value = true
  try {
    const payload: any = {
      scope: props.scope === 'personal' ? 'personal' : 'project',
      folderId: activeTab.value?.type === 'FOLDER' ? activeTab.value.id : undefined,
      blocks: [
        { text: '', order: 0, media: [] }
      ]
    }
    if (props.scope === 'project') {
      payload.projectId = props.projectId
    }

    const res = await api.post<ContentItem>('/content-library/items', payload)

    await fetchItems({ reset: true })
    
    openEditModal(res)
    
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to create content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    isStartCreating.value = false
  }
}

const openEditModal = (item: ContentItem) => {
  activeItem.value = item

  editForm.value = {
    id: item.id,
    title: item.title || '',
    tags: formatTags(item.tags || []),
    note: item.note || '',
    blocks: JSON.parse(JSON.stringify(item.blocks || [])).sort((a: any, b: any) => a.order - b.order),
  }

  if (editForm.value.blocks.length === 0) {
    editForm.value.blocks.push({ text: '', order: 0, media: [] })
  }

  isEditModalOpen.value = true
}

const handleAddBlock = () => {
  editForm.value.blocks.push({ text: '', order: 0, media: [] })
}


const refreshActiveItem = async () => {
  if (!editForm.value.id) return
  try {
    const item = await api.get<ContentItem>(`/content-library/items/${editForm.value.id}`)
    
    // Smart sync: update only media in existing blocks to preserve unsaved text changes
    editForm.value.blocks.forEach(localBlock => {
      if (!localBlock.id) return
      const freshBlock = item.blocks?.find(b => b.id === localBlock.id)
      if (freshBlock) {
        localBlock.media = freshBlock.media
      }
    })
    
    // Update activeItem as well
    activeItem.value = item
    
    // Also refresh the background list
    fetchItems()
  } catch (e) {
    console.error('Failed to refresh item', e)
  }
}

const addBlock = async () => {
  if (!editForm.value.id) return
  
  const target = editForm.value
  const maxOrder = target.blocks.reduce((max, b) => Math.max(max, (b.order ?? -1)), -1)
  
  try {
    const res = await api.post<ContentBlock>(`/content-library/items/${editForm.value.id}/blocks`, {
      text: '',
      order: maxOrder + 1,
      media: []
    })
    target.blocks.push(res)
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to add block'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
}

const removeBlock = async (index: number) => {
  const target = editForm.value
  const block = target.blocks[index]
  
  if (!block) return

  if (!block.id) {
    target.blocks.splice(index, 1)
    return
  }

  try {
    await api.delete(`/content-library/items/${editForm.value.id}/blocks/${block.id}`)
    target.blocks.splice(index, 1)
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to remove block'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
}

const detachBlock = async (index: number) => {
  const target = editForm.value
  const block = target.blocks[index]
  
  if (!block || !block.id) return

  try {
    await api.post(`/content-library/items/${editForm.value.id}/blocks/${block.id}/detach`)
    
    target.blocks.splice(index, 1)
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.actions.detachSuccess'),
      color: 'success'
    })
    
    // Background list update
    fetchItems()
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to detach block'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
}

const handleReorder = async () => {
  if (!editForm.value.id) return
  
  try {
    const reorderData = editForm.value.blocks.map((b, i) => ({
      id: b.id!,
      order: i
    }))
    
    await api.post(`/content-library/items/${editForm.value.id}/blocks/reorder`, {
      blocks: reorderData
    })
    
    // Update local order numbers to match
    editForm.value.blocks.forEach((b, i) => {
      b.order = i
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to reorder blocks'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    // Optional: reload blocks if reorder fails to sync UI with DB
    await refreshActiveItem()
  }
}

const saveItem = async (formData: typeof editForm.value) => {
  if (!activeItem.value) return

  await api.patch(`/content-library/items/${formData.id}`, {
    title: formData.title || null,
    tags: parseTags(formData.tags),
    note: formData.note || null,
  })


  // Update blocks
  const nextBlocks = formData.blocks.map((b, i) => ({
    ...b,
    order: i,
    text: b.text?.trim() || ''
  }))

  for (const b of nextBlocks) {
    if (b.id) {
      await api.patch(`/content-library/items/${formData.id}/blocks/${b.id}`, {
        text: b.text,
        order: b.order,
        meta: b.meta || {}
      })
    }
  }
}

const handleCloseModal = async () => {
  await forceSave()
  isEditModalOpen.value = false
  activeItem.value = null
  await fetchItems({ reset: true })
}

const openArchiveModal = (item: ContentItem) => {
  itemToArchive.value = item
  isArchiveModalOpen.value = true
}

const confirmArchive = async () => {
  if (!itemToArchive.value) return
  
  const itemId = itemToArchive.value.id
  isArchivingId.value = itemId
  
  try {
    await api.post(`/content-library/items/${itemId}/archive`)
    await fetchItems({ reset: true })
    isArchiveModalOpen.value = false
    itemToArchive.value = null
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to archive content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
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
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to restore content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
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
    } else if (props.scope === 'personal') {
      await api.post('/content-library/personal/purge-archived')
    } else {
      return
    }
    
    await fetchItems({ reset: true })
    isPurgeConfirmModalOpen.value = false
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to purge archived items'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    isPurging.value = false
  }
}


const handleBulkAction = async (operation: 'ARCHIVE' | 'UNARCHIVE') => {
  bulkOperationType.value = operation
  
  // For archive (move to trash), show confirmation?
  // User said "move to trash" looks like moving to trash.
  // We can add a simple confirm if needed, but usually moving to trash is reversible so immediate is okay.
  // But strictly speaking, if we want to mimic "Move to Trash" we might want a confirm or just do it.
  // The Delete button was for PERMANENT delete. 
  // Let's stick to immediate action for Archive/Restore for now, as it just toggles a flag.
  // Wait, user said "instead of archiving do - to trash".
  // Let's treat ARCHIVE as "Move to Trash".
  
  await executeBulkOperation()
}

const handleCreatePublication = (item: any) => {
  const texts = (item.blocks || [])
    .map((b: any) => stripHtmlAndSpecialChars(b.text || '').trim())
    .filter(Boolean)

  createPublicationModalProjectId.value = props.scope === 'project' ? props.projectId : undefined
  createPublicationModalAllowProjectSelection.value = props.scope === 'personal'
  publicationData.value = {
    title: (item.title || '').toString().trim(),
    content: texts.join('\n\n'),
    mediaIds: (item.blocks || []).flatMap((b: any) => (b.media || []).map((m: any) => ({ id: m.mediaId }))).filter((m: any) => !!m.id),
    tags: formatTags(item.tags || []),
    note: item.note || '',
    contentItemIds: [item.id]
  }
  
  isCreatePublicationModalOpen.value = true
}

const handleCreatePublicationFromSelection = () => {
  if (selectedIds.value.length === 0) return

  const selectedItems = items.value.filter(i => selectedIds.value.includes(i.id))

  try {
    const aggregated = aggregateSelectedItemsToPublicationOrThrow(selectedItems)

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
    const code = e?.message || 'UNKNOWN'
    const errorKeyMap: Record<string, string> = {
      EMPTY_SELECTION: 'contentLibrary.bulk.createPublicationEmptyError',
      LIMIT_TITLE: 'contentLibrary.bulk.createPublicationLimitTitleError',
      LIMIT_CONTENT: 'contentLibrary.bulk.createPublicationLimitContentError',
      LIMIT_NOTE: 'contentLibrary.bulk.createPublicationLimitNoteError',
      LIMIT_TAGS: 'contentLibrary.bulk.createPublicationLimitTagsError',
      LIMIT_MEDIA: 'contentLibrary.bulk.createPublicationLimitMediaError',
    }

    toast.add({
      title: t('common.error'),
      description: t(errorKeyMap[code] || 'contentLibrary.bulk.createPublicationGenericError'),
      color: 'error',
    })
  }
}

const handleMerge = () => {
  bulkOperationType.value = 'MERGE'
  isMergeConfirmModalOpen.value = true
}

const executeBulkOperation = async () => {
  if (selectedIds.value.length === 0) return
  
  const operation = bulkOperationType.value
  if (operation === 'DELETE') isBulkDeleting.value = true
  
    const selectedCount = selectedIds.value.length
    try {
      await api.post('/content-library/bulk', {
        ids: selectedIds.value,
        operation
      })
      
      toast.add({
        title: t('common.success'),
        description: t('contentLibrary.bulk.success', { count: selectedCount }),
        color: 'success'
      })
    
    selectedIds.value = []
    isBulkOperationModalOpen.value = false
    isMergeConfirmModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, `Failed to perform bulk ${operation}`),
      color: 'error'
    })
  } finally {
    isBulkDeleting.value = false
    isBulkOperationModalOpen.value = false
    isMergeConfirmModalOpen.value = false
  }
}

// Move to Project Logic
const isMoveToProjectModalOpen = ref(false)
const targetProjectId = ref<string | undefined>(undefined)
const myProjects = computed(() => {
  return (projects.value || []).map((p) => ({
    id: p.id,
    label: p.name,
    isPersonal: false,
  }))
})

// Add "Personal Scope" option
const projectOptions = computed(() => {
  return [
    { id: 'PERSONAL', label: t('contentLibrary.bulk.personalScope'), isPersonal: true },
    ...myProjects.value
  ]
})

const handleMoveToProject = async () => {
  // Reset target project
  targetProjectId.value = undefined
  if (projects.value.length === 0) {
    await fetchProjects(false)
  }
  isMoveToProjectModalOpen.value = true
}

const executeMoveToProject = async () => {
  if (selectedIds.value.length === 0) return
  
  isBulkDeleting.value = true // Re-use loading state
  
  // 'PERSONAL' id logic maps to null projectId for backend
  const projectIdToSend = targetProjectId.value === 'PERSONAL' ? null : targetProjectId.value

  try {
    await api.post('/content-library/bulk', {
      ids: selectedIds.value,
      operation: 'SET_PROJECT',
      projectId: projectIdToSend
    })
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.bulk.success', { count: selectedIds.value.length }),
      color: 'success'
    })
    
    selectedIds.value = []
    isMoveToProjectModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, `Failed to move items`),
      color: 'error'
    })
  } finally {
    isBulkDeleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
          {{ t('contentLibrary.title', 'Content library') }}
          <CommonCountBadge :count="total" :title="t('contentLibrary.badgeCountTooltip')" />
        </h1>
        
        <template v-if="scope === 'project'">
          <NuxtLink
            v-if="currentProject"
            :to="`/projects/${props.projectId}`"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium flex items-center gap-1"
          >
            <UIcon name="i-heroicons-folder" class="w-4 h-4" />
            {{ currentProject.name }}
          </NuxtLink>
           <p v-else class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('contentLibrary.subtitleProject', 'Project scope') }}
          </p>
        </template>
        <template v-else>
           <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('contentLibrary.subtitlePersonal', 'Personal scope') }}
          </p>
        </template>
       
      </div>

      <UButton
        v-if="scope === 'project' && props.projectId"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        :to="`/projects/${props.projectId}`"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row items-start justify-between gap-4">
      <ContentLibraryTabs
        ref="contentLibraryTabsRef"
        v-model="activeTabId"
        @update:active-tab="activeTab = $event"
        :scope="scope"
        :project-id="props.projectId"
        class="flex-1 min-w-0"
      />

      <div class="flex items-center gap-2 shrink-0 pt-1">
         <UButton
            :color="archiveStatus === 'archived' ? 'neutral' : 'neutral'"
            variant="ghost" 
            :icon="archiveStatus === 'archived' ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-trash'"
            @click="archiveStatus = archiveStatus === 'active' ? 'archived' : 'active'"
            size="sm"
          >
            {{ archiveStatus === 'archived' ? t('contentLibrary.filter.active') : t('contentLibrary.filter.archived') }}
          </UButton>
          
          <UButton
            v-if="archiveStatus === 'archived'"
            size="sm"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            :loading="isPurging"
            @click="isPurgeConfirmModalOpen = true"
          >
            {{ t('contentLibrary.actions.purgeArchived', 'Empty trash') }}
          </UButton>
      </div>
    </div>

    <div class="app-card-lg space-y-4">
      <!-- Toolbar -->
      <div class="flex flex-col gap-4">
        <!-- Top Row: Actions -->
        <div class="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center pb-2 border-b border-gray-100 dark:border-gray-800">
            <!-- Left: Creation -->
            <div class="flex items-center gap-2">
                <template v-if="archiveStatus === 'active'">
                    <UButton
                    color="primary"
                    size="sm"
                    icon="i-heroicons-plus"
                    :loading="isStartCreating"
                    @click="createAndEdit"
                    >
                    {{ t('contentLibrary.actions.createEmpty', 'Create') }}
                    </UButton>

                    <UButton
                    color="neutral"
                    size="sm"
                    variant="outline"
                    icon="i-heroicons-cloud-arrow-up"
                    @click="isBulkUploadModalOpen = true"
                    >
                    {{ t('contentLibrary.actions.bulkUpload') }}
                    </UButton>
                </template>
            </div>

            <!-- Right: Tab Actions -->
            <div class="flex items-center gap-2" v-if="activeTab">
                 <!-- Rename -->
                <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-heroicons-pencil-square"
                    @click="openRenameTabModal"
                >
                    {{ t('common.rename') }}
                </UButton>
                
                 <!-- Delete -->
                 <UButton
                    color="error"
                    variant="ghost"
                    size="sm"
                    icon="i-heroicons-trash"
                    @click="openDeleteTabModal"
                >
                     {{ t('common.delete') }}
                </UButton>
            </div>
        </div>

        <!-- Bottom Row: Filters (3 Columns) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <!-- Col 1: Search -->
            <UInput
            v-model="q"
            :placeholder="t('contentLibrary.searchPlaceholder', 'Search...')"
            icon="i-heroicons-magnifying-glass"
            class="w-full"
            />

            <!-- Col 2: Tags -->
            <USelectMenu
            v-model="selectedTags"
            :items="availableTags"
            multiple
            :placeholder="t('contentLibrary.filter.filterByTags')"
            class="w-full"
            icon="i-heroicons-tag"
            searchable
            />

            <!-- Col 3: Sorting -->
            <div class="flex items-center gap-2">
                <USelectMenu
                    v-model="sortBy"
                    :items="sortOptions"
                    value-key="id"
                    label-key="label"
                    class="flex-1"
                    :searchable="false"
                >
                    <template #leading>
                    <UIcon v-if="currentSortOption" :name="currentSortOption.icon" class="w-4 h-4" />
                    </template>
                </USelectMenu>

                <UButton
                    :key="sortOrder"
                    :icon="sortOrderIcon"
                    color="neutral"
                    variant="ghost"
                    @click="toggleSortOrder"
                    :title="sortOrderLabel"
                />
            </div>
        </div>
      </div>

      <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-if="isLoading && items.length === 0" class="mt-6 flex justify-center py-8">
        <UiLoadingSpinner />
      </div>

      <div v-else class="mt-6 space-y-4">
        <!-- Select All and Bulk Actions -->
        <div v-if="items.length > 0" class="flex items-center gap-4 px-2">
          <UCheckbox
            :model-value="isAllSelected"
            :indeterminate="isSomeSelected"
            @update:model-value="toggleSelectAll"
            :label="isAllSelected ? t('common.deselectAll', 'Deselect all') : t('common.selectAll', 'Select all')"
          />
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
            @archive="openArchiveModal"
            @restore="restoreItem"
            @create-publication="handleCreatePublication"
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

    <!-- Modals -->
    <UiConfirmModal
      v-if="isArchiveModalOpen"
      v-model:open="isArchiveModalOpen"
      :title="t('contentLibrary.actions.deleteConfirmTitle')"
      :description="t('contentLibrary.actions.deleteConfirmDescription')"
      :confirm-text="t('contentLibrary.actions.moveToTrash')"
      color="warning"
      icon="i-heroicons-trash"
      :loading="!!isArchivingId"
      @confirm="confirmArchive"
    />

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
      :title="t('contentLibrary.bulk.deleteTitle', 'Delete multiple items')"
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

    <!-- Bulk Action Bar -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-full opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-full opacity-0"
    >
      <div v-if="selectedIds.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-full shadow-2xl border border-gray-700 flex items-center gap-6 min-w-max">
        <span class="text-sm font-medium border-r border-gray-700 pr-6 mr-0">
          {{ t('common.selected', { count: selectedIds.length }) }}
        </span>

        <div class="flex items-center gap-2">
          <UButton
            v-if="archiveStatus === 'active'"
            color="warning"
            variant="ghost"
            icon="i-heroicons-archive-box"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="handleBulkAction('ARCHIVE')"
          >
            {{ t('contentLibrary.bulk.moveToTrash') }}
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-folder-open"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="handleMoveToProject"
          >
            {{ t('contentLibrary.bulk.move') }}
          </UButton>

          <UButton
            v-if="selectedIds.length >= 2"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-square-3-stack-3d"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="handleMerge"
          >
            {{ t('contentLibrary.bulk.merge') }}
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-paper-airplane"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="handleCreatePublicationFromSelection"
          >
            {{ t('contentLibrary.bulk.createPublication', 'Create publication') }}
          </UButton>
        </div>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          size="sm"
          class="text-gray-400 hover:text-white"
          @click="selectedIds = []"
        />
      </div>
    </Transition>

    <AppModal
      v-model:open="isEditModalOpen"
      :title="t('contentLibrary.editTitle', 'Edit content item')"
      :ui="{ content: 'w-[90vw] max-w-5xl' }"
      @close="handleCloseModal"
    >
      <div class="space-y-6">
        <!-- Blocks Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <UIcon name="i-heroicons-paper-clip" class="w-4 h-4" />
              {{ t('contentLibrary.sections.blocks') }}
            </h3>
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-heroicons-plus"
              @click="addBlock()"
            >
              {{ t('contentLibrary.actions.addBlock') }}
            </UButton>
          </div>

          <VueDraggable
            v-model="editForm.blocks"
            handle=".drag-handle"
            class="space-y-3"
            @end="handleReorder"
          >
            <div v-for="(block, index) in editForm.blocks" :key="block.id || index">
              <ContentBlockEditor
                :model-value="editForm.blocks[index]!"
                @update:model-value="editForm.blocks[index] = $event"
                :index="index"
                :content-item-id="editForm.id"
                :show-detach="editForm.blocks.length > 1"
                @remove="removeBlock(index)"
                @detach="detachBlock(index)"
                @refresh="refreshActiveItem"
              />
            </div>
          </VueDraggable>
        </div>

        <!-- Title Field -->
        <UFormField 
          :label="t('contentLibrary.fields.title', 'Title')"
          :help="t('contentLibrary.fields.titleHelp', 'Optional title for easier identification')"
          class="w-full"
        >
          <template #label>
            <span class="inline-flex items-center gap-2">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>{{ t('contentLibrary.fields.title', 'Title') }}</span>
              <!-- Auto-save status indicator inline with title -->
              <span class="ml-auto">
                 <UiAutosaveStatus 
                  :status="saveStatus" 
                  :error="saveError" 
                  :last-saved="null"
                />
              </span>
            </span>
          </template>
          <UInput 
            v-model="editForm.title"
            :placeholder="t('contentLibrary.fields.titlePlaceholder', 'Product announcement, Weekly update...')"
            class="w-full"
          />
        </UFormField>

        <!-- Tags Field -->
        <UFormField 
          :label="t('contentLibrary.fields.tags', 'Tags')"
          class="w-full"
        >
          <UInput 
            v-model="editForm.tags"
            :placeholder="t('contentLibrary.fields.tagsPlaceholder', 'Comma separated tags...')"
            class="w-full"
          />
        </UFormField>

        <!-- Note Field -->
        <UFormField 
          :label="t('contentLibrary.fields.note', 'Internal note')"
          class="w-full"
        >
          <UTextarea 
            v-model="editForm.note"
            :placeholder="t('contentLibrary.fields.notePlaceholder', 'Notes for yourself...')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- Note Field -->
      </div>
      
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
    </AppModal>
    
    <BulkUploadModal
      v-model:open="isBulkUploadModalOpen"
      :scope="scope"
      :project-id="projectId"
      :folder-id="activeTab?.type === 'FOLDER' ? activeTab.id : undefined"
      @uploaded="fetchItems({ reset: true })"
    />

    <!-- Move to Project Modal -->
    <AppModal
      v-model:open="isMoveToProjectModalOpen"
      :title="t('contentLibrary.bulk.moveToProjectTitle')"
      :description="t('contentLibrary.bulk.moveToProjectDescription', { count: selectedIds.length })"
      :ui="{ content: 'w-full max-w-xl' }"
      @close="isMoveToProjectModalOpen = false"
    >
      <USelectMenu
        v-model="targetProjectId"
        :items="projectOptions"
        value-key="id"
        label-key="label"
        searchable
        :search-attributes="['label']"
        :placeholder="t('contentLibrary.bulk.selectProject')"
      />

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isMoveToProjectModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isBulkDeleting"
          :disabled="!targetProjectId"
          @click="executeMoveToProject"
        >
          {{ t('contentLibrary.bulk.move') }}
        </UButton>
      </template>
    </AppModal>

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

    <!-- Rename Tab Modal -->
    <AppModal
      v-model:open="isRenameTabModalOpen"
      :title="t('contentLibrary.tabs.renameTitle', 'Rename tab')"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isRenameTabModalOpen = false"
    >
        <UFormField :label="t('common.title', 'Title')">
            <UInput v-model="newTabTitle" @keydown.enter="handleRenameTab" autofocus />
        </UFormField>

        <template #footer>
             <UButton color="neutral" variant="ghost" @click="isRenameTabModalOpen = false">
                {{ t('common.cancel') }}
             </UButton>
             <UButton color="primary" :loading="isRenamingTab" @click="handleRenameTab">
                {{ t('common.save') }}
             </UButton>
        </template>
    </AppModal>

    <!-- Delete Tab Modal -->
    <UiConfirmModal
      v-if="isDeleteTabConfirmModalOpen"
      v-model:open="isDeleteTabConfirmModalOpen"
      :title="t('contentLibrary.tabs.deleteTitle', 'Delete tab')"
      :description="t('contentLibrary.tabs.deleteDescription', 'Are you sure you want to delete this tab? This action cannot be undone.')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingTab"
      @confirm="handleDeleteTab"
    />
  </div>
</template>
