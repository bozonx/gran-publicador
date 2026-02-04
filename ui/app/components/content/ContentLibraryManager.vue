<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import yaml from 'js-yaml'
import { VueDraggable } from 'vue-draggable-plus'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import AppModal from '~/components/ui/AppModal.vue'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import ContentBlockEditor from '~/components/forms/content/ContentBlockEditor.vue'
import BulkUploadModal from '~/components/forms/content/BulkUploadModal.vue'

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
  type?: string | null
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
  meta: any
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
// const route = useRoute() // Removed route dependency for projectId
const api = useApi()
const toast = useToast()
const { currentProject, fetchProject } = useProjects()
const { formatDateShort, truncateContent } = useFormatters()

// const projectId = computed(() => route.params.id as string) // Replaced by props.projectId

const isLoading = ref(false)
const error = ref<string | null>(null)

const q = ref('')
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const items = ref<ContentItem[]>([])

const isStartCreating = ref(false)

const isEditModalOpen = ref(false)
const activeItem = ref<ContentItem | null>(null)

const isBulkUploadModalOpen = ref(false)

const isPurging = ref(false)

const isArchiveModalOpen = ref(false)
const itemToArchive = ref<ContentItem | null>(null)

const editForm = ref({
  id: '',
  title: '',
  tags: '',
  note: '',
  blocks: [] as ContentBlock[],
  meta: {} as any,
  metaError: null as string | null
})


const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)

// Selection state
const selectedIds = ref<string[]>([])
const isBulkDeleting = ref(false)
const isBulkOperationModalOpen = ref(false)
const bulkOperationType = ref<'DELETE' | 'ARCHIVE' | 'UNARCHIVE'>('DELETE')

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
    if (editForm.value.metaError) return
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
        search: q.value || undefined,
        limit,
        offset: offset.value,
        archivedOnly: archiveStatus.value === 'archived' ? true : undefined,
        includeArchived: false,
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

const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return
  offset.value += limit
  await fetchItems()
}

const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)

watch(
  () => q.value,
  () => {
    debouncedFetch()
  },
)

watch(
  () => archiveStatus.value,
  () => {
    selectedIds.value = []
    fetchItems({ reset: true })
  },
)

watch(
  () => q.value,
  () => {
    selectedIds.value = []
  }
)

watch(() => props.projectId, (newVal) => {
  if (props.scope === 'project' && newVal) {
    fetchItems({ reset: true })
    fetchProject(newVal)
  }
})

onMounted(() => {
  fetchItems({ reset: true })
  if (props.scope === 'project' && props.projectId) {
    fetchProject(props.projectId)
  }
})

const createAndEdit = async () => {
  if (props.scope === 'project' && !props.projectId) return

  isStartCreating.value = true
  try {
    const payload: any = {
      scope: props.scope === 'personal' ? 'personal' : 'project',
      blocks: [
        { text: '', type: 'plain', order: 0, meta: {}, media: [] }
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
    meta: item.meta || {},
    metaError: null
  }

  if (editForm.value.blocks.length === 0) {
    editForm.value.blocks.push({ text: '', type: 'plain', order: 0, meta: {}, media: [] })
  }

  isEditModalOpen.value = true
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
      type: 'plain',
      order: maxOrder + 1,
      meta: {},
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

const handleMetaUpdate = (newMeta: any) => {
  editForm.value.meta = newMeta
}

const saveItem = async (formData: typeof editForm.value) => {
  if (!activeItem.value) return

  await api.patch(`/content-library/items/${formData.id}`, {
    title: formData.title || null,
    tags: parseTags(formData.tags),
    note: formData.note || null,
    meta: formData.meta
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
        type: b.type || 'plain',
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
  // if (!projectId.value) return
  if (props.scope === 'project' && !props.projectId) return

  isPurging.value = true
  try {
    // API might serve purge for project only?
    if (props.scope === 'project' && props.projectId) {
      await api.post(`/content-library/projects/${props.projectId}/purge-archived`)
    } else {
      // Personal purge? Need to check if endpoint supports it.
      // Looking at content-library.service.ts: 
      // public async purgeArchivedByProject(projectId: string, userId: string)
      // There is no purgeArchivedByPerson.
      // So maybe disable purge button for personal scope for now or implement it.
      // I'll disable it for personal scope for now to be safe, or just hide the button.
      // Actually the button is conditional on archiveStatus === 'archived'.
      // I'll assume purge is project-only feature for now unless I update backend.
      // The requirement didn't specify purge.
      toast.add({
        title: t('common.note', 'Note'),
        description: 'Purge not implemented for personal library',
        color: 'primary'
      })
      return
    }
    
    await fetchItems({ reset: true })
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

const getAllItemMedia = (item: ContentItem) => {
  const mediaLinks: Array<{ media?: any; order: number }> = []
  let order = 0
  
  for (const block of (item.blocks || [])) {
    for (const m of (block.media || [])) {
      mediaLinks.push({
        media: m.media,
        order: order++
      })
    }
  }
  
  return mediaLinks
}

const getItemTextBlocks = (item: ContentItem) => {
  const texts = (item.blocks || [])
    .map(b => stripHtmlAndSpecialChars(b.text).trim())
    .filter(Boolean)
    
  if (texts.length === 0 && item.note) {
    const noteClean = stripHtmlAndSpecialChars(item.note).trim()
    if (noteClean) texts.push(noteClean)
  }
  
  return texts
}

const handleBulkAction = async (operation: 'DELETE' | 'ARCHIVE' | 'UNARCHIVE') => {
  bulkOperationType.value = operation
  
  if (operation === 'DELETE') {
    isBulkOperationModalOpen.value = true
    return
  }
  
  await executeBulkOperation()
}

const executeBulkOperation = async () => {
  if (selectedIds.value.length === 0) return
  
  const operation = bulkOperationType.value
  if (operation === 'DELETE') isBulkDeleting.value = true
  
  try {
    await api.post('/content-library/bulk', {
      ids: selectedIds.value,
      operation
    })
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.bulk.success', { count: selectedIds.value.length }),
      color: 'success'
    })
    
    selectedIds.value = []
    isBulkOperationModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, `Failed to perform bulk ${operation}`),
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
            :to="`/projects/${projectId}`"
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
        v-if="scope === 'project' && projectId"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        :to="`/projects/${projectId}`"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <div class="app-card p-6">
      <div class="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <UInput
          v-model="q"
          :placeholder="t('contentLibrary.searchPlaceholder', 'Search by title, note, tags, text...')"
          icon="i-heroicons-magnifying-glass"
          class="w-full md:max-w-xl"
        />

        <div class="flex items-center gap-3 justify-between md:justify-end">
          <div class="flex items-center gap-2" :title="t('channel.filter.archiveStatus.tooltip')">
            <UiAppButtonGroup
              v-model="archiveStatus"
              :options="[
                { value: 'archived', label: t('contentLibrary.filter.archived') },
                { value: 'active', label: t('contentLibrary.filter.active') }
              ]"
              variant="outline"
              active-variant="solid"
              color="neutral"
            />
          </div>
          <UButton
            v-if="archiveStatus === 'archived' && scope === 'project'"
            size="sm"
            color="warning"
            variant="outline"
            icon="i-heroicons-trash"
            :loading="isPurging"
            @click="purgeArchived"
          >
            {{ t('contentLibrary.actions.purgeArchived', 'Empty trash') }}
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

          <UButton
            color="primary"
            size="sm"
            icon="i-heroicons-plus"
            :loading="isStartCreating"
            @click="createAndEdit"
          >
            {{ t('contentLibrary.actions.createEmpty', 'Create') }}
          </UButton>
        </div>
      </div>

      <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-if="isLoading && items.length === 0" class="mt-6 flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
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
          <div
            v-for="item in items"
            :key="item.id"
            class="app-card app-card-hover p-4 cursor-pointer group flex flex-col h-full relative"
            :class="{ 'ring-2 ring-primary-500 rounded-lg': selectedIds.includes(item.id) }"
            @click="openEditModal(item)"
          >
            <!-- Checkbox for selection -->
            <div class="absolute top-2 left-2 z-10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity" :class="{ 'opacity-100': selectedIds.includes(item.id) }" @click.stop>
              <UCheckbox
                :model-value="selectedIds.includes(item.id)"
                @update:model-value="toggleSelection(item.id)"
              />
            </div>
            <!-- Header: Title, Tags, Delete -->
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex-1 min-w-0">
                <h3 
                  class="font-semibold text-gray-900 dark:text-white truncate text-base leading-snug mb-1"
                  :class="{ 'italic text-gray-500 font-medium': !item.title }"
                >
                  {{ item.title || t('contentLibrary.untitled', 'Untitled') }}
                </h3>
                
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UBadge v-if="item.archivedAt" color="warning" size="xs" variant="subtle">
                    {{ t('common.archived', 'Archived') }}
                  </UBadge>
                </div>
              </div>

              <div class="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton
                  v-if="!item.archivedAt"
                  size="xs"
                  color="warning"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  :loading="isArchivingId === item.id"
                  :title="t('contentLibrary.actions.moveToTrash')"
                  class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  @click.stop="openArchiveModal(item)"
                />
                <UButton
                  v-else
                  size="xs"
                  color="primary"
                  variant="ghost"
                  icon="i-heroicons-arrow-uturn-left"
                  :loading="isRestoringId === item.id"
                  :title="t('common.restore')"
                  class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  @click.stop="restoreItem(item.id)"
                />
              </div>
            </div>

            <!-- Media preview -->
            <div v-if="getAllItemMedia(item).length > 0" class="mb-3 flex justify-center h-48">
              <MediaStack
                :media="getAllItemMedia(item)"
                size="md"
                :clickable="false"
              />
            </div>

            <!-- Content preview -->
            <div v-if="getItemTextBlocks(item).length > 0" class="mb-3 space-y-2">
              <p 
                v-for="(text, idx) in getItemTextBlocks(item)"
                :key="idx"
                class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed"
              >
                {{ truncateContent(text, 150) }}
              </p>
            </div>

            <!-- Footer: Date, Stats, Tags -->
            <div class="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-1 shrink-0">
                  <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                  <span>{{ formatDateShort(item.createdAt) }}</span>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1" :title="t('contentLibrary.blocksCount', { count: item.blocks?.length || 0 })">
                    <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
                    <span>{{ item.blocks?.length || 0 }}</span>
                  </div>
                  <div class="flex items-center gap-1" :title="t('contentLibrary.mediaCount', { count: getAllItemMedia(item).length })">
                    <UIcon name="i-heroicons-photo" class="w-3.5 h-3.5" />
                    <span>{{ getAllItemMedia(item).length }}</span>
                  </div>
                </div>
              </div>

              <!-- Tags if present -->
              <div v-if="item.tags && item.tags.length > 0" class="flex items-center gap-1 text-xs text-gray-400 italic">
                <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ formatTags(item.tags) }}</span>
              </div>
            </div>
          </div>
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
          {{ t('common.selectedCount', { count: selectedIds.length }) }}
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
            {{ t('common.archive') }}
          </UButton>
          <UButton
            v-else
            color="primary"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="handleBulkAction('UNARCHIVE')"
          >
            {{ t('common.restore') }}
          </UButton>

          <UButton
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            size="sm"
            class="text-white hover:bg-red-900/50"
            @click="handleBulkAction('DELETE')"
          >
            {{ t('common.delete') }}
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
                @remove="removeBlock(index)"
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

        <!-- Additional Metadata -->
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
          <CommonYamlEditor 
            v-model="editForm.meta"
            :error="editForm.metaError"
            label="Metadata (YAML)"
          />
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-between items-center w-full">
           <div class="text-xs text-gray-500">
             <!-- Left side footer content if any -->
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
      @uploaded="fetchItems({ reset: true })"
    />
  </div>
</template>

