<script setup lang="ts">
import { type ContentLibraryTab } from '~/composables/useContentLibraryTabs'
import { sanitizeContentPreserveMarkdown } from '~/utils/text'
import { getApiErrorMessage } from '~/utils/error'
import { aggregateSelectedItemsToPublicationOrThrow } from '~/composables/useContentLibraryPublicationAggregation'
import ContentLibraryTabs from './ContentLibraryTabs.vue'
import ContentLibraryToolbar from './ContentLibraryToolbar.vue'
import ContentLibraryBulkBar from './ContentLibraryBulkBar.vue'
import ContentItemEditor from './ContentItemEditor.vue'
import ContentItemCard from './ContentItemCard.vue'
import AppModal from '~/components/ui/AppModal.vue'
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
const { updateTab, deleteTab } = useContentLibraryTabs()
const { uploadMedia } = useMedia()

const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTabId = ref<string | null>(null)
const activeTab = ref<ContentLibraryTab | null>(null)
const q = ref('')
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const totalUnfiltered = ref(0)
const items = ref<any[]>([])
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

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const selectedIds = ref<string[]>([])
const isBulkDeleting = ref(false)
const isBulkOperationModalOpen = ref(false)
const isMergeConfirmModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'MERGE'>('DELETE')

const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)

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

const contentLibraryTabsRef = ref<any>(null)
const isRenameTabModalOpen = ref(false)
const newTabTitle = ref('')
const isDeleteTabConfirmModalOpen = ref(false)
const tabToDelete = ref<any>(null)
const isRenamingTab = ref(false)
const isDeletingTab = ref(false)

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
            groupId: activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined,
            title: file.name,
            blocks: [{ text, order: 0, meta: {}, media: [] }]
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
            groupId: activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined,
            title: file.name,
            blocks: [{ text: '', order: 0, meta: {}, media: [{ mediaId: media.id, order: 0, hasSpoiler: false }] }]
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

const fetchItems = async (opts?: { reset?: boolean }) => {
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
        scope: props.scope === 'personal' ? 'personal' : 'project',
        projectId: props.scope === 'project' ? props.projectId : undefined,
        groupId: activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined,
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
    totalUnfiltered.value = res.totalUnfiltered || res.total
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
      groupId: activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined,
      blocks: [{ text: '', order: 0, media: [] }]
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

const openRenameTabModal = () => {
  if (!activeTab.value) return
  newTabTitle.value = activeTab.value.title
  isRenameTabModalOpen.value = true
}

const handleRenameTab = async () => {
  if (!activeTab.value || !newTabTitle.value.trim()) return
  isRenamingTab.value = true
  try {
    await updateTab(activeTab.value.id, { scope: props.scope, projectId: props.projectId, title: newTabTitle.value })
    contentLibraryTabsRef.value?.fetchTabs()
    isRenameTabModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename group'), color: 'error' })
  } finally {
    isRenamingTab.value = false
  }
}

const openDeleteTabModal = () => {
  if (!activeTab.value) return
  isDeleteTabConfirmModalOpen.value = true
}

const handleDeleteTab = async () => {
  if (!activeTab.value) return
  isDeletingTab.value = true
  try {
    await deleteTab(activeTab.value.id, props.scope, props.projectId)
    contentLibraryTabsRef.value?.fetchTabs()
    activeTab.value = null
    activeTabId.value = null
    isDeleteTabConfirmModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete group'), color: 'error' })
  } finally {
    isDeletingTab.value = false
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

const extraProjectOptions = computed(() => [
  { value: 'PERSONAL', label: t('contentLibrary.bulk.personalScope'), isPersonal: true }
])

const handleMoveToProject = async () => {
  targetProjectId.value = undefined
  if (projects.value.length === 0) {
    await fetchProjects(false)
  }
  isMoveToProjectModalOpen.value = true
}

const executeMoveToProject = async () => {
  if (selectedIds.value.length === 0) return
  isBulkDeleting.value = true 
  const projectIdToSend = targetProjectId.value === 'PERSONAL' ? null : targetProjectId.value
  try {
    await api.post('/content-library/bulk', {
      ids: selectedIds.value,
      operation: 'SET_PROJECT',
      projectId: projectIdToSend
    })
    toast.add({ title: t('common.success'), description: t('contentLibrary.bulk.success', { count: selectedIds.value.length }), color: 'success' })
    selectedIds.value = []
    isMoveToProjectModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, `Failed to move items`), color: 'error' })
  } finally {
    isBulkDeleting.value = false
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
  const texts = (item.blocks || []).map((b: any) => sanitizeContentPreserveMarkdown(b.text || '').trim()).filter(Boolean)
  createPublicationModalProjectId.value = props.scope === 'project' ? props.projectId : undefined
  createPublicationModalAllowProjectSelection.value = props.scope === 'personal'
  publicationData.value = {
    title: (item.title || '').toString().trim(),
    content: texts.join('\n\n'),
    mediaIds: (item.blocks || []).flatMap((b: any) => (b.media || []).map((m: any) => ({ id: m.mediaId }))).filter((m: any) => !!m.id),
    tags: item.tags || [],
    note: item.note || '',
    contentItemIds: [item.id]
  }
  isCreatePublicationModalOpen.value = true
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

const buildTabConfig = () => {
  if (!activeTab.value) {
    return {}
  }

  const baseConfig = {
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }

  if (activeTab.value.type === 'SAVED_VIEW') {
    return {
      ...baseConfig,
      search: q.value,
      tags: selectedTags.value,
    }
  }

  return baseConfig
}

const persistActiveTabConfig = async () => {
  if (!activeTab.value || isRestoringConfig.value) {
    return
  }

  const nextConfig = buildTabConfig()
  const currentConfig = activeTab.value.config || {}
  if (JSON.stringify(currentConfig) === JSON.stringify(nextConfig)) {
    return
  }

  try {
    await updateTab(activeTab.value.id, {
      scope: props.scope,
      projectId: props.projectId,
      config: nextConfig,
    })
    activeTab.value = {
      ...activeTab.value,
      config: nextConfig,
    }
  } catch {
    // Ignore persistence errors to keep browsing uninterrupted
  }
}

const debouncedPersistActiveTabConfig = useDebounceFn(persistActiveTabConfig, 350)

const restoreTabSettings = () => {
  if (!activeTab.value) return
  isRestoringConfig.value = true
  const config = activeTab.value.config as any || {}
  q.value = activeTab.value.type === 'SAVED_VIEW' ? (config.search || '') : ''
  selectedTags.value = activeTab.value.type === 'SAVED_VIEW' ? (config.tags || []) : []
  if (config.sortBy) sortBy.value = config.sortBy
  if (config.sortOrder) sortOrder.value = config.sortOrder
  setTimeout(() => { isRestoringConfig.value = false }, 100)
}

watch(activeTab, async (newTab, oldTab) => {
  if (newTab?.id !== oldTab?.id) {
    selectedIds.value = []
    if (newTab) restoreTabSettings()
    else {
      q.value = ''
      selectedTags.value = []
      sortBy.value = 'createdAt'
      sortOrder.value = 'desc'
    }
    fetchItems({ reset: true })
  }
})

watch([q, selectedTags, sortBy, sortOrder], () => {
  debouncedPersistActiveTabConfig()
})

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
  selectedTags.value = []
  fetchAvailableTags()
  fetchItems({ reset: true })
})

fetchAvailableTags()
fetchItems({ reset: true })
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
      :total-unfiltered="totalUnfiltered"
      :current-project="currentProject"
      :is-purging="isPurging"
      :active-tab="activeTab"
      :is-start-creating="isStartCreating"
      :available-tags="availableTags"
      :sort-options="sortOptions"
      :current-sort-option="currentSortOption"
      :sort-order-icon="sortOrderIcon"
      :sort-order-label="sortOrderLabel"
      :is-window-file-drag-active="isWindowFileDragActive"
      @purge="isPurgeConfirmModalOpen = true"
      @create="createAndEdit"
      @upload-files="uploadContentFiles"
      @rename-tab="openRenameTabModal"
      @delete-tab="openDeleteTabModal"
      @toggle-sort-order="toggleSortOrder"
    >
      <ContentLibraryTabs
        ref="contentLibraryTabsRef"
        v-model="activeTabId"
        :scope="scope"
        :project-id="props.projectId"
        @update:active-tab="activeTab = $event"
      />
    </ContentLibraryToolbar>

      <!-- Items Grid -->
      <div v-if="isLoading && items.length === 0" class="mt-6 flex justify-center py-8">
        <UiLoadingSpinner />
      </div>

      <div v-else class="mt-6 space-y-4">
        <CommonFoundCount :count="total" :show="q.length > 0 || selectedTags.length > 0" class="mb-2" />
        <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
          {{ error }}
        </div>
        
        <!-- Select All -->
        <div v-if="items.length > 0" class="flex items-center justify-between gap-4 px-2">
          <UCheckbox
            :model-value="isAllSelected"
            :indeterminate="isSomeSelected"
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

    <!-- Bulk Bar -->
    <ContentLibraryBulkBar
      :selected-ids="selectedIds"
      :archive-status="archiveStatus"
      @archive="handleBulkAction('ARCHIVE')"
      @move="handleMoveToProject"
      @merge="handleMerge"
      @create-publication="handleCreatePublicationFromSelection"
      @clear="selectedIds = []"
    />

    <AppModal
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
    </AppModal>
    
    <!-- Move to Project Modal -->
    <AppModal
      v-model:open="isMoveToProjectModalOpen"
      :title="t('contentLibrary.bulk.moveToProjectTitle')"
      :description="t('contentLibrary.bulk.moveToProjectDescription', { count: selectedIds.length })"
      :ui="{ content: 'w-full max-w-xl' }"
      @close="isMoveToProjectModalOpen = false"
    >
      <div ref="moveModalRootRef">
        <CommonProjectSelect
          ref="moveProjectSelectRef"
          v-model="targetProjectId"
          :extra-options="extraProjectOptions"
          searchable
          :placeholder="t('contentLibrary.bulk.selectProject')"
        />
      </div>

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
      :title="t('contentLibrary.tabs.renameTitle', 'Rename group')"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isRenameTabModalOpen = false"
    >
        <UFormField :label="t('common.title', 'Title')">
            <UInput v-model="newTabTitle" autofocus @keydown.enter="handleRenameTab" />
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
      :title="t('contentLibrary.tabs.deleteTitle', 'Delete group')"
      :description="t('contentLibrary.tabs.deleteDescription', 'Are you sure you want to delete this group? This action cannot be undone.')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingTab"
      @confirm="handleDeleteTab"
    />
  </div>
</template>
