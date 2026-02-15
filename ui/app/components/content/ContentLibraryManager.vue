<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
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
const { listTabs, createTab, updateTab, deleteTab } = useContentLibraryTabs()
const { uploadMedia } = useMedia()

const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTabId = ref<string | null>(null)
const activeTab = ref<ContentLibraryTab | null>(null)
const tabs = ref<ContentLibraryTab[]>([])
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

  persistActiveTabConfig()
})

watch(sortBy, () => {
  if (isRestoringConfig.value) {
    return
  }

  persistActiveTabConfig()
})

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
const isRenamingTab = ref(false)
const isDeletingTab = ref(false)
const selectedGroupTreeNodeId = ref<string | null>(null)
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

type GroupBulkMode = 'MOVE_TO_GROUP' | 'LINK_TO_GROUP'

interface GroupTreeNode extends TreeItem {
  label: string
  value: string
  children?: GroupTreeNode[]
}

const handleSidebarGroupNodeSelect = (tabId: string) => {
  selectedGroupTreeNodeId.value = tabId
  handleSelectGroupTab(tabId)
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

const formatGroupTreeLabel = (tab: ContentLibraryTab) => {
  const directItemsCount = Number(tab.directItemsCount ?? 0)
  return `${tab.title} (${directItemsCount})`
}

const canDeleteTab = (tab: ContentLibraryTab | null | undefined) => {
  if (!tab) {
    return false
  }

  return true
}

const canDeleteActiveTab = computed(() => canDeleteTab(activeTab.value))

const isToGroupModalOpen = ref(false)
const isLoadingGroupTabs = ref(false)
const isApplyingToGroup = ref(false)
const isCreatingInlineSubgroup = ref(false)
const allGroupTabs = ref<ContentLibraryTab[]>([])
const toGroupSearchQuery = ref('')
const toGroupTargetId = ref<string | null>(null)
const groupBulkMode = ref<GroupBulkMode>('MOVE_TO_GROUP')
const inlineSubgroupTitle = ref('')
const isActiveGroupTab = computed(() => activeTab.value?.type === 'GROUP')

const allScopeGroupTabs = computed(() => tabs.value.filter(tab => tab.type === 'GROUP'))
const tabsById = computed(() => new Map(tabs.value.map(tab => [tab.id, tab])))

const treeCreateParentLabel = computed(() => {
  if (!treeCreateParentId.value) {
    return '-'
  }

  return tabsById.value.get(treeCreateParentId.value)?.title ?? '-'
})

const treeDeleteTargetLabel = computed(() => {
  if (!treeDeleteTargetId.value) {
    return '-'
  }

  return tabsById.value.get(treeDeleteTargetId.value)?.title ?? '-'
})

const activeRootGroupId = computed(() => {
  if (activeTab.value?.type !== 'GROUP') {
    return null
  }

  let cursor: ContentLibraryTab | undefined = activeTab.value
  const visited = new Set<string>()

  while (cursor?.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    const parent = tabsById.value.get(cursor.parentId)
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

  const rootGroup = tabsById.value.get(activeRootGroupId.value)
  if (!rootGroup || rootGroup.type !== 'GROUP') {
    return []
  }

  const byParent = new Map<string, ContentLibraryTab[]>()

  for (const tab of allScopeGroupTabs.value) {
    const parentId = tab.parentId ?? ''
    const current = byParent.get(parentId) ?? []
    current.push(tab)
    byParent.set(parentId, current)
  }

  const buildTree = (parentId: string): GroupTreeNode[] => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)
    return children.map((tab) => ({
      label: formatGroupTreeLabel(tab),
      value: tab.id,
      slot: 'group-node',
      defaultExpanded: true,
      children: buildTree(tab.id),
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

const toGroupActionLabel = computed(() =>
  groupBulkMode.value === 'MOVE_TO_GROUP'
    ? t('contentLibrary.bulk.moveMode')
    : t('contentLibrary.bulk.linkMode'),
)

const groupTreeItems = computed<GroupTreeNode[]>(() => {
  if (!isActiveGroupTab.value || !activeTab.value) {
    return []
  }

  const rootId = activeTab.value.id
  const descendants = new Set<string>([rootId])
  const queue = [rootId]

  while (queue.length > 0) {
    const parentId = queue.shift()
    if (!parentId) {
      continue
    }

    for (const tab of allGroupTabs.value) {
      if (tab.parentId === parentId && !descendants.has(tab.id)) {
        descendants.add(tab.id)
        queue.push(tab.id)
      }
    }
  }

  const byParent = new Map<string, ContentLibraryTab[]>()
  for (const tab of allGroupTabs.value) {
    if (!descendants.has(tab.id) || tab.id === rootId) {
      continue
    }

    const parentId = tab.parentId ?? ''
    const current = byParent.get(parentId) ?? []
    current.push(tab)
    byParent.set(parentId, current)
  }

  const buildTree = (parentId: string): GroupTreeNode[] => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)
    return children.map((tab) => ({
      label: tab.title,
      value: tab.id,
      defaultExpanded: true,
      onSelect: () => {
        toGroupTargetId.value = tab.id
      },
      children: buildTree(tab.id),
    }))
  }

  return buildTree(rootId)
})

const filteredGroupTreeItems = computed<GroupTreeNode[]>(() => {
  const query = toGroupSearchQuery.value.trim().toLowerCase()
  if (!query) {
    return groupTreeItems.value
  }

  const filterTree = (nodes: GroupTreeNode[]): GroupTreeNode[] => {
    const result: GroupTreeNode[] = []

    for (const node of nodes) {
      const children = node.children ? filterTree(node.children as GroupTreeNode[]) : []
      const matches = node.label.toLowerCase().includes(query)

      if (matches || children.length > 0) {
        result.push({
          ...node,
          children,
        })
      }
    }

    return result
  }

  return filterTree(groupTreeItems.value)
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
  const targetGroupId = activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined
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
            groupId: targetGroupId,
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

const openTreeCreateModal = (parentId: string) => {
  const parentTab = tabsById.value.get(parentId)
  if (!parentTab || parentTab.type !== 'GROUP') {
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
    const newTab = await createTab({
      scope: props.scope,
      projectId: props.projectId,
      type: 'GROUP',
      parentId: treeCreateParentId.value,
      title,
      config: {},
    })

    await contentLibraryTabsRef.value?.fetchTabs()
    activeTabId.value = newTab.id
    activeTab.value = newTab
    selectedGroupTreeNodeId.value = newTab.id
    selectedIds.value = []
    isTreeCreateModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create subgroup'), color: 'error' })
  } finally {
    isCreatingTreeGroup.value = false
  }
}

const openTreeRenameModal = (tabId: string) => {
  const targetTab = tabsById.value.get(tabId)
  if (!targetTab || targetTab.type !== 'GROUP' || !targetTab.parentId) {
    return
  }

  treeRenameTargetId.value = tabId
  treeRenameTitle.value = targetTab.title
  isTreeRenameModalOpen.value = true
}

const handleRenameGroupFromTree = async () => {
  const title = treeRenameTitle.value.trim()
  if (!treeRenameTargetId.value || !title) {
    return
  }

  isRenamingTreeGroup.value = true
  try {
    const updatedTab = await updateTab(treeRenameTargetId.value, {
      scope: props.scope,
      projectId: props.projectId,
      title,
    })

    await contentLibraryTabsRef.value?.fetchTabs()
    
    // Update active tab if it matches renamed one
    if (activeTabId.value === treeRenameTargetId.value) {
      activeTab.value = updatedTab
    }

    isTreeRenameModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename subgroup'), color: 'error' })
  } finally {
    isRenamingTreeGroup.value = false
  }
}

const openTreeDeleteModal = (tabId: string) => {
  const targetTab = tabsById.value.get(tabId)
  if (!targetTab || targetTab.type !== 'GROUP' || !targetTab.parentId) {
    return
  }

  treeDeleteTargetId.value = tabId
  isTreeDeleteConfirmModalOpen.value = true
}

const handleDeleteGroupFromTree = async () => {
  if (!treeDeleteTargetId.value) {
    return
  }

  const targetTab = tabsById.value.get(treeDeleteTargetId.value)
  if (!targetTab) {
    return
  }

  const parentId = targetTab.parentId
  isDeletingTreeGroup.value = true
  try {
    await deleteTab(targetTab.id, props.scope, props.projectId)
    await contentLibraryTabsRef.value?.fetchTabs()

    if (parentId) {
      const parentTab = tabs.value.find(tab => tab.id === parentId)
      if (parentTab) {
        activeTabId.value = parentTab.id
        activeTab.value = parentTab
      }
    }

    if (!parentId) {
      activeTabId.value = null
      activeTab.value = null
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

const getGroupNodeMenuItems = (tabId: string) => {
  const targetTab = tabsById.value.get(tabId)
  const menuItems: Array<{ label: string; icon: string; onSelect: () => void }> = [
    {
      label: t('contentLibrary.tabs.createSubgroup'),
      icon: 'i-heroicons-folder-plus',
      onSelect: () => openTreeCreateModal(tabId),
    },
  ]

  if (targetTab?.parentId) {
    menuItems.push({
      label: t('common.rename'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openTreeRenameModal(tabId),
    })
  }

  if (canDeleteTab(targetTab)) {
    menuItems.push({
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      onSelect: () => openTreeDeleteModal(tabId),
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
  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }
  isLoading.value = true
  error.value = null
  try {
    const baseParams = {
      scope: props.scope === 'personal' ? 'personal' : 'project',
      projectId: props.scope === 'project' ? props.projectId : undefined,
      archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
      includeArchived: false,
    }

    const [res, globalRes] = await Promise.all([
      api.get<any>('/content-library/items', {
        params: {
          ...baseParams,
          groupId: activeTab.value?.type === 'GROUP' ? activeTab.value.id : undefined,
          search: q.value || undefined,
          limit,
          offset: offset.value,
          sortBy: sortBy.value,
          sortOrder: sortOrder.value,
          tags: selectedTags.value || undefined,
        },
      }),
      api.get<any>('/content-library/items', {
        params: {
          ...baseParams,
          limit: 1,
          offset: 0,
        },
      }),
    ])

    if (requestId !== fetchItemsRequestId) {
      return
    }

    total.value = res.total
    totalUnfiltered.value = globalRes.total
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
    const tags = await api.get<string[]>('/content-library/tags', {
      params: {
        scope: props.scope === 'personal' ? 'personal' : 'project',
        projectId: props.scope === 'project' ? props.projectId : undefined,
        groupId: activeRootGroupId.value ?? undefined,
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
  const tabToDelete = activeTab.value
  const parentId = tabToDelete.parentId
  isDeletingTab.value = true
  try {
    await deleteTab(tabToDelete.id, props.scope, props.projectId)
    contentLibraryTabsRef.value?.fetchTabs()

    const parentTab = parentId ? tabs.value.find(tab => tab.id === parentId) : null
    if (parentTab) {
      activeTab.value = parentTab
      activeTabId.value = parentTab.id
    } else {
      activeTab.value = null
      activeTabId.value = null
    }

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

const fetchGroupTabs = async () => {
  if (props.scope === 'project' && !props.projectId) {
    return
  }

  isLoadingGroupTabs.value = true
  try {
    const tabs = await listTabs(props.scope, props.projectId)
    allGroupTabs.value = tabs.filter(tab => tab.type === 'GROUP')
  } finally {
    isLoadingGroupTabs.value = false
  }
}

const handleOpenToGroupModal = async () => {
  if (!isActiveGroupTab.value || !activeTab.value || selectedIds.value.length === 0) {
    return
  }

  toGroupTargetId.value = null
  toGroupSearchQuery.value = ''
  groupBulkMode.value = 'MOVE_TO_GROUP'
  inlineSubgroupTitle.value = ''
  await fetchGroupTabs()
  isToGroupModalOpen.value = true
}

const handleCreateInlineSubgroup = async () => {
  if (!isActiveGroupTab.value || !activeTab.value || !inlineSubgroupTitle.value.trim()) {
    return
  }

  isCreatingInlineSubgroup.value = true
  try {
    const newTab = await createTab({
      scope: props.scope,
      projectId: props.projectId,
      type: 'GROUP',
      parentId: activeTab.value.id,
      title: inlineSubgroupTitle.value.trim(),
      config: {},
    })

    await fetchGroupTabs()
    toGroupTargetId.value = newTab.id
    inlineSubgroupTitle.value = ''
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create subgroup'), color: 'error' })
  } finally {
    isCreatingInlineSubgroup.value = false
  }
}

const handleBulkToGroup = async () => {
  if (!activeTab.value || !toGroupTargetId.value || selectedIds.value.length === 0) {
    return
  }

  isApplyingToGroup.value = true
  const operation = groupBulkMode.value
  try {
    await api.post('/content-library/bulk', {
      ids: selectedIds.value,
      operation,
      groupId: toGroupTargetId.value,
      sourceGroupId: operation === 'MOVE_TO_GROUP' ? activeTab.value.id : undefined,
    })

    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.bulk.success', { count: selectedIds.value.length }),
      color: 'success',
    })
    selectedIds.value = []
    isToGroupModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to add items to group'), color: 'error' })
  } finally {
    isApplyingToGroup.value = false
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

const handleSelectGroupTab = (tabId: string) => {
  if (activeTabId.value === tabId) {
    return
  }

  const targetTab = tabs.value.find(tab => tab.id === tabId)
  if (!targetTab) {
    return
  }

  activeTabId.value = targetTab.id
  activeTab.value = targetTab
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

const getGroupRootTabId = (tab: ContentLibraryTab): string => {
  let cursor: ContentLibraryTab | undefined = tab
  const visited = new Set<string>()

  while (cursor?.type === 'GROUP' && cursor.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    const parent = tabsById.value.get(cursor.parentId)
    if (!parent || parent.type !== 'GROUP') {
      break
    }
    cursor = parent
  }

  return cursor?.id ?? tab.id
}

const isRestoringGroupSelection = ref(false)

const getGroupSelectionStorageKey = (rootGroupId: string) => {
  return `content-library-last-group-${props.scope}-${props.projectId || 'global'}-${rootGroupId}`
}

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

const resolveTabForConfigPersistence = (): ContentLibraryTab | null => {
  if (!activeTab.value) {
    return null
  }

  const canonicalTab = tabsById.value.get(activeTab.value.id) ?? activeTab.value

  if (canonicalTab.type !== 'GROUP') {
    return canonicalTab
  }

  const rootId = getGroupRootTabId(canonicalTab)
  return tabsById.value.get(rootId) ?? canonicalTab
}

const persistActiveTabConfig = async () => {
  const persistenceTab = resolveTabForConfigPersistence()
  if (!persistenceTab || isRestoringConfig.value) {
    return
  }

  const nextConfig = buildTabConfig()
  const currentConfig = persistenceTab.config || {}
  if (JSON.stringify(currentConfig) === JSON.stringify(nextConfig)) {
    return
  }

  try {
    const tabIdToUpdate = persistenceTab.id
    await updateTab(tabIdToUpdate, {
      scope: props.scope,
      projectId: props.projectId,
      config: nextConfig,
    })
    if (activeTab.value?.id === tabIdToUpdate) {
      activeTab.value = {
        ...activeTab.value,
        config: nextConfig,
      }
    }

    tabs.value = tabs.value.map((tab) =>
      tab.id === tabIdToUpdate
        ? { ...tab, config: nextConfig }
        : tab,
    )

    const tabsComponentTabs = contentLibraryTabsRef.value?.tabs
    if (tabsComponentTabs?.value && Array.isArray(tabsComponentTabs.value)) {
      tabsComponentTabs.value = tabsComponentTabs.value.map((tab: ContentLibraryTab) => (
        tab.id === tabIdToUpdate
          ? { ...tab, config: nextConfig }
          : tab
      ))
    }
  } catch (e: any) {
    console.warn('Failed to persist content library tab config', e)

    const now = Date.now()
    if (!lastConfigPersistToastAt.value || now - lastConfigPersistToastAt.value > 5000) {
      lastConfigPersistToastAt.value = now
      toast.add({
        title: t('common.error'),
        description: getApiErrorMessage(e, 'Failed to save tab settings'),
        color: 'error',
      })
    }
  }
}

const lastConfigPersistToastAt = ref<number | null>(null)

const handleActiveTabUpdate = async (nextTab: ContentLibraryTab | null) => {
  if (activeTab.value?.id !== nextTab?.id) {
    await persistActiveTabConfig()
  }

  activeTab.value = nextTab
}

const debouncedPersistActiveTabConfig = useDebounceFn(persistActiveTabConfig, 350)

const restoreTabSettings = () => {
  if (!activeTab.value) return
  isRestoringConfig.value = true
  const configSource = resolveTabForConfigPersistence() ?? activeTab.value
  const config = (configSource.config as any) || {}
  q.value = activeTab.value.type === 'SAVED_VIEW' ? (config.search || '') : ''
  selectedTags.value = activeTab.value.type === 'SAVED_VIEW' ? (config.tags || '') : ''
  if (config.sortBy) sortBy.value = config.sortBy
  if (config.sortOrder) sortOrder.value = config.sortOrder
  setTimeout(() => { isRestoringConfig.value = false }, 100)
}

const persistLastSelectedGroupNode = (tab: ContentLibraryTab) => {
  if (tab.type !== 'GROUP') {
    return
  }

  const rootId = getGroupRootTabId(tab)
  localStorage.setItem(getGroupSelectionStorageKey(rootId), tab.id)
}

const restoreLastSelectedGroupNode = (rootTab: ContentLibraryTab) => {
  if (rootTab.type !== 'GROUP') {
    return
  }

  const rootId = getGroupRootTabId(rootTab)
  const savedId = localStorage.getItem(getGroupSelectionStorageKey(rootId))
  if (!savedId || savedId === rootTab.id) {
    return
  }

  const savedTab = tabsById.value.get(savedId)
  if (!savedTab || savedTab.type !== 'GROUP') {
    return
  }

  isRestoringGroupSelection.value = true
  selectedGroupTreeNodeId.value = savedTab.id
  activeTabId.value = savedTab.id
  activeTab.value = savedTab
  setTimeout(() => { isRestoringGroupSelection.value = false }, 50)
}

watch(activeTab, async (newTab, oldTab) => {
  if (newTab?.id !== oldTab?.id) {
    if (!isRestoringGroupSelection.value) {
      selectedGroupTreeNodeId.value = newTab?.type === 'GROUP' ? newTab.id : null
    }
    selectedIds.value = []
    isToGroupModalOpen.value = false
    if (newTab) {
      if (newTab.type === 'GROUP') {
        if (!isRestoringGroupSelection.value && !newTab.parentId) {
          restoreLastSelectedGroupNode(newTab)
          return
        }

        if (newTab.parentId) {
          persistLastSelectedGroupNode(newTab)
        }
      }

      restoreTabSettings()
    }
    else {
      q.value = ''
      selectedTags.value = ''
      sortBy.value = 'createdAt'
      sortOrder.value = 'desc'
    }
    fetchItems({ reset: true })
  }
})

watch([q, selectedTags, sortBy, sortOrder], () => {
  debouncedPersistActiveTabConfig()
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
      :user-id="projectId ? undefined : useAuth()?.user?.value?.id"
      :group-id="activeRootGroupId ?? undefined"
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
      :can-delete-active-tab="canDeleteActiveTab"
      @purge="isPurgeConfirmModalOpen = true"
      @create="createAndEdit"
      @upload-files="uploadContentFiles"
      @rename-tab="openRenameTabModal"
      @delete-tab="openDeleteTabModal"
      @toggle-sort-order="toggleSortOrder"
    >
      <template #tabs>
        <ContentLibraryTabs
          ref="contentLibraryTabsRef"
          v-model="activeTabId"
          :scope="scope"
          :project-id="props.projectId"
          @update:active-tab="handleActiveTabUpdate($event)"
          @update:tabs="tabs = $event"
        />
      </template>
    </ContentLibraryToolbar>

    <div
      class="mt-6 grid grid-cols-1 gap-6 items-start"
      :class="isActiveGroupTab ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : 'xl:grid-cols-1'"
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
      </div>

      <aside v-if="isActiveGroupTab" class="app-card-lg border border-gray-200/70 dark:border-gray-700/70 space-y-4">
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
            <template #group-node-leading="{ expanded, handleToggle }">
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                :icon="expanded ? 'i-heroicons-folder-open' : 'i-heroicons-folder'"
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

    <AppModal
      v-model:open="isTreeCreateModalOpen"
      :title="t('contentLibrary.tabs.createSubgroupTitle')"
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
    </AppModal>

    <AppModal
      v-model:open="isTreeRenameModalOpen"
      :title="t('contentLibrary.tabs.renameTitle', 'Rename group')"
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
    </AppModal>

    <UiConfirmModal
      v-if="isTreeDeleteConfirmModalOpen"
      v-model:open="isTreeDeleteConfirmModalOpen"
      :title="t('contentLibrary.tabs.deleteTitle')"
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
      :is-group-tab="isActiveGroupTab"
      @archive="handleBulkAction('ARCHIVE')"
      @move="handleMoveToProject"
      @to-group="handleOpenToGroupModal"
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

    <AppModal
      v-model:open="isToGroupModalOpen"
      :title="t('contentLibrary.bulk.toGroupTitle')"
      :description="t('contentLibrary.bulk.toGroupDescription', { count: selectedIds.length })"
      :ui="{ content: 'w-full max-w-2xl' }"
      @close="isToGroupModalOpen = false"
    >
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            :variant="groupBulkMode === 'MOVE_TO_GROUP' ? 'solid' : 'outline'"
            color="primary"
            @click="groupBulkMode = 'MOVE_TO_GROUP'"
          >
            {{ t('contentLibrary.bulk.moveMode') }}
          </UButton>
          <UButton
            size="sm"
            :variant="groupBulkMode === 'LINK_TO_GROUP' ? 'solid' : 'outline'"
            color="neutral"
            @click="groupBulkMode = 'LINK_TO_GROUP'"
          >
            {{ t('contentLibrary.bulk.linkMode') }}
          </UButton>
        </div>

        <UInput
          v-model="toGroupSearchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="t('contentLibrary.bulk.searchGroups')"
        />

        <div class="rounded-md border border-gray-200 dark:border-gray-800 p-3 max-h-72 overflow-auto">
          <div v-if="isLoadingGroupTabs" class="py-4 flex justify-center">
            <UiLoadingSpinner />
          </div>
          <div v-else-if="filteredGroupTreeItems.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('contentLibrary.bulk.noGroupsInContext') }}
          </div>
          <UTree v-else :items="filteredGroupTreeItems" />
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('contentLibrary.bulk.selectedGroupHint', { groupId: toGroupTargetId || '-' }) }}
        </p>

        <UFormField :label="t('contentLibrary.bulk.createSubgroupLabel')">
          <div class="flex items-center gap-2">
            <UInput
              v-model="inlineSubgroupTitle"
              class="flex-1"
              :placeholder="t('contentLibrary.tabs.titlePlaceholder')"
              @keydown.enter="handleCreateInlineSubgroup"
            />
            <UButton
              color="neutral"
              variant="outline"
              :loading="isCreatingInlineSubgroup"
              :disabled="!inlineSubgroupTitle.trim()"
              @click="handleCreateInlineSubgroup"
            >
              {{ t('common.create') }}
            </UButton>
          </div>
        </UFormField>
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isToGroupModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isApplyingToGroup"
          :disabled="!toGroupTargetId"
          @click="handleBulkToGroup"
        >
          {{ toGroupActionLabel }}
        </UButton>
      </template>
    </AppModal>

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
