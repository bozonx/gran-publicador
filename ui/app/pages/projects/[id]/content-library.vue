<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import yaml from 'js-yaml'
import { VueDraggable } from 'vue-draggable-plus'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import AppModal from '~/components/ui/AppModal.vue'
import ContentBlockEditor from '~/components/forms/content/ContentBlockEditor.vue'

definePageMeta({
  middleware: 'auth',
})

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
const route = useRoute()
const api = useApi()
const toast = useToast()

const projectId = computed(() => route.params.id as string)

const isLoading = ref(false)
const error = ref<string | null>(null)

const q = ref('')
const archiveStatus = ref<'active' | 'archived'>('active')
const limit = 20
const offset = ref(0)
const total = ref(0)
const items = ref<ContentItem[]>([])

const isCreateModalOpen = ref(false)
const isEditModalOpen = ref(false)
const activeItem = ref<ContentItem | null>(null)

const isPurging = ref(false)

const createForm = ref({
  title: '',
  tags: '',
  note: '',
  blocks: [] as ContentBlock[],
  metaYaml: '',
  metaError: null as string | null
})

const editForm = ref({
  id: '',
  title: '',
  tags: '',
  note: '',
  blocks: [] as ContentBlock[],
  metaYaml: '',
  metaError: null as string | null
})

const isSaving = ref(false)
const isArchivingId = ref<string | null>(null)
const isRestoringId = ref<string | null>(null)

const hasMore = computed(() => items.value.length < total.value)

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
  if (!projectId.value) return

  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }

  isLoading.value = true
  error.value = null

  try {
    const res = await api.get<FindContentItemsResponse>('/content-library/items', {
      params: {
        scope: 'project',
        projectId: projectId.value,
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
    fetchItems({ reset: true })
  },
)

onMounted(() => {
  fetchItems({ reset: true })
})

const resetCreateForm = () => {
  createForm.value = {
    title: '',
    tags: '',
    note: '',
    blocks: [
      { text: '', type: 'plain', order: 0, meta: {}, media: [] }
    ],
    metaYaml: '',
    metaError: null
  }
}

const openCreateModal = () => {
  resetCreateForm()
  isCreateModalOpen.value = true
}

const openEditModal = (item: ContentItem) => {
  activeItem.value = item

  editForm.value = {
    id: item.id,
    title: item.title || '',
    tags: formatTags(item.tags || []),
    note: item.note || '',
    blocks: JSON.parse(JSON.stringify(item.blocks || [])).sort((a: any, b: any) => a.order - b.order),
    metaYaml: item.meta && Object.keys(item.meta).length > 0 ? yaml.dump(item.meta) : '',
    metaError: null
  }

  if (editForm.value.blocks.length === 0) {
    editForm.value.blocks.push({ text: '', type: 'plain', order: 0, meta: {}, media: [] })
  }

  isEditModalOpen.value = true
}

const addBlock = (form: 'create' | 'edit') => {
  const target = form === 'create' ? createForm.value : editForm.value
  const maxOrder = target.blocks.reduce((max, b) => Math.max(max, b.order), -1)
  target.blocks.push({
    text: '',
    type: 'plain',
    order: maxOrder + 1,
    meta: {},
    media: []
  })
}

const removeBlock = (form: 'create' | 'edit', index: number) => {
  const target = form === 'create' ? createForm.value : editForm.value
  target.blocks.splice(index, 1)
}

const handleMetaUpdate = (form: 'create' | 'edit', newYaml: string) => {
  const target = form === 'create' ? createForm.value : editForm.value
  target.metaYaml = newYaml
  if (!newYaml.trim()) {
    target.metaError = null
    return
  }

  try {
    const parsed = yaml.load(newYaml)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      target.metaError = t('validation.invalidYaml')
      return
    }
    target.metaError = null
  } catch (e: any) {
    target.metaError = e.message
  }
}

const createItem = async () => {
  if (!projectId.value) return

  if (createForm.value.blocks.length === 0 || !createForm.value.blocks.some(b => (b.text ?? '').trim())) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('contentLibrary.validation.textRequired', 'Text is required'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  if (createForm.value.metaError) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('validation.invalidYaml'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  isSaving.value = true
  try {
    const itemMeta = createForm.value.metaYaml.trim() ? yaml.load(createForm.value.metaYaml) : {}
    
    await api.post('/content-library/items', {
      scope: 'project',
      projectId: projectId.value,
      title: createForm.value.title || undefined,
      tags: parseTags(createForm.value.tags),
      note: createForm.value.note || undefined,
      meta: itemMeta,
      blocks: createForm.value.blocks.map((b, i) => ({
        ...b,
        order: i,
        text: b.text?.trim() || ''
      })).filter(b => b.text),
    })

    isCreateModalOpen.value = false
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to create content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    isSaving.value = false
  }
}

const updateItem = async () => {
  if (!activeItem.value) return

  const item = activeItem.value
  
  if (editForm.value.blocks.length === 0 || !editForm.value.blocks.some(b => (b.text ?? '').trim())) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('contentLibrary.validation.textRequired', 'Text is required'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  if (editForm.value.metaError) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('validation.invalidYaml'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  isSaving.value = true
  try {
    const itemMeta = editForm.value.metaYaml.trim() ? yaml.load(editForm.value.metaYaml) : {}

    await api.patch(`/content-library/items/${item.id}`, {
      title: editForm.value.title || null,
      tags: parseTags(editForm.value.tags),
      note: editForm.value.note || null,
      meta: itemMeta
    })

    // To simplify, we'll replace all blocks
    // Note: This depends on backend implementation. 
    // Usually it's better to sync them, but for now we'll send the whole list
    // if the backend supports PATCH /items/:id with blocks
    
    // Based on the previous implementation, the backend had separate endpoints for blocks.
    // Let's check if the backend supports bulk update or we need to call individual endpoints.
    
    // Existing code called PATCH /items/:id/blocks/:blockId
    
    const currentBlocks = item.blocks || []
    const nextBlocks = editForm.value.blocks.map((b, i) => ({
      ...b,
      order: i,
      text: b.text?.trim() || ''
    })).filter(b => b.text)

    // Delete blocks that are no longer present
    const blocksToDelete = currentBlocks.filter(cb => !nextBlocks.some(nb => nb.id === cb.id))
    for (const b of blocksToDelete) {
      await api.delete(`/content-library/items/${item.id}/blocks/${b.id}`)
    }

    // Update or create blocks
    for (const b of nextBlocks) {
      if (b.id) {
        await api.patch(`/content-library/items/${item.id}/blocks/${b.id}`, {
          text: b.text,
          type: b.type || 'plain',
          order: b.order,
          meta: b.meta || {}
        })
      } else {
        await api.post(`/content-library/items/${item.id}/blocks`, {
          text: b.text,
          type: b.type || 'plain',
          order: b.order,
          meta: b.meta || {},
          media: []
        })
      }
    }

    isEditModalOpen.value = false
    activeItem.value = null
    await fetchItems({ reset: true })
  } catch (e: any) {
    toast.add({
      title: t('common.error', 'Error'),
      description: getApiErrorMessage(e, 'Failed to update content item'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    isSaving.value = false
  }
}

const archiveItem = async (itemId: string) => {
  isArchivingId.value = itemId
  try {
    await api.post(`/content-library/items/${itemId}/archive`)
    await fetchItems({ reset: true })
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
  if (!projectId.value) return

  isPurging.value = true
  try {
    await api.post(`/content-library/projects/${projectId.value}/purge-archived`)
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

const getItemPreview = (item: ContentItem) => {
  const firstText = item.blocks?.find(b => (b.text ?? '').trim().length > 0)?.text
  if (firstText) {
    return stripHtmlAndSpecialChars(firstText).slice(0, 220)
  }

  if (item.note) {
    return stripHtmlAndSpecialChars(item.note).slice(0, 220)
  }

  const mediaCount = (item.blocks ?? []).reduce((acc, b) => acc + (b.media?.length ?? 0), 0)
  if (mediaCount > 0) {
    return t('contentLibrary.preview.mediaOnly', 'Media only')
  }

  return ''
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
        <p class="text-gray-500 dark:text-gray-400">
          {{ t('contentLibrary.subtitleProject', 'Project scope') }}
        </p>
      </div>

      <UButton
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
                { value: 'archived', label: t('channel.filter.archiveStatus.archived') },
                { value: 'active', label: t('channel.filter.archiveStatus.active') }
              ]"
              variant="outline"
              active-variant="solid"
              color="neutral"
            />
          </div>
          <UButton
            v-if="archiveStatus === 'archived'"
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
            color="primary"
            size="sm"
            icon="i-heroicons-plus"
            @click="openCreateModal"
          >
            {{ t('common.create', 'Create') }}
          </UButton>
        </div>
      </div>

      <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-if="isLoading && items.length === 0" class="mt-6 flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
      </div>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ item.title || t('contentLibrary.untitled', 'Untitled') }}
                </h3>

                <UBadge v-if="item.archivedAt" color="warning" variant="subtle">
                  {{ t('common.archived', 'Archived') }}
                </UBadge>
              </div>

              <p v-if="getItemPreview(item)" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {{ getItemPreview(item) }}
              </p>

              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  {{ d(new Date(item.createdAt), 'short') }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                  {{ t('contentLibrary.blocksCount', { count: item.blocks?.length || 0 }, `${item.blocks?.length || 0} blocks`) }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-photo" class="w-4 h-4" />
                  {{ t('contentLibrary.mediaCount', { count: (item.blocks ?? []).reduce((acc, b) => acc + (b.media?.length ?? 0), 0) || 0 }, `${(item.blocks ?? []).reduce((acc, b) => acc + (b.media?.length ?? 0), 0) || 0} media`) }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-pencil-square"
                :disabled="!!item.archivedAt"
                @click="openEditModal(item)"
              >
                {{ t('common.edit', 'Edit') }}
              </UButton>

              <UButton
                v-if="!item.archivedAt"
                size="xs"
                color="warning"
                variant="ghost"
                icon="i-heroicons-archive-box"
                :loading="isArchivingId === item.id"
                @click="archiveItem(item.id)"
              >
                {{ t('common.archive', 'Archive') }}
              </UButton>

              <UButton
                v-else
                size="xs"
                color="primary"
                variant="ghost"
                icon="i-heroicons-arrow-uturn-left"
                :loading="isRestoringId === item.id"
                @click="restoreItem(item.id)"
              >
                {{ t('common.restore', 'Restore') }}
              </UButton>
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

    <AppModal
      v-model:open="isCreateModalOpen"
      :title="t('contentLibrary.createTitle', 'Create content item')"
    >
      <form @submit.prevent="createItem" class="space-y-6">
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
              @click="addBlock('create')"
            >
              {{ t('contentLibrary.actions.addBlock') }}
            </UButton>
          </div>

          <VueDraggable
            v-model="createForm.blocks"
            handle=".drag-handle"
            class="space-y-3"
          >
            <div v-for="(block, index) in createForm.blocks" :key="index">
              <ContentBlockEditor
                :model-value="createForm.blocks[index]!"
                @update:model-value="createForm.blocks[index] = $event"
                :index="index"
                @remove="removeBlock('create', index)"
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
            </span>
          </template>
          <UInput 
            v-model="createForm.title"
            :placeholder="t('contentLibrary.fields.titlePlaceholder', 'Product announcement, Weekly update...')"
            class="w-full"
          />
        </UFormField>

        <!-- Metadata Section -->
        <div class="pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-5">
          <div class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
            <span>{{ t('contentLibrary.sections.metadata', 'Metadata') }}</span>
          </div>

          <!-- Tags Field -->
          <UFormField 
            :label="t('contentLibrary.fields.tags', 'Tags')"
            :help="t('contentLibrary.fields.tagsHelp', 'Comma-separated tags for search')"
            class="w-full"
          >
            <template #label>
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-heroicons-hashtag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.tags', 'Tags') }}</span>
              </span>
            </template>
            <UInput 
              v-model="createForm.tags" 
              :placeholder="t('contentLibrary.fields.tagsPlaceholder', 'announcement, product, marketing')"
              class="w-full"
            />
          </UFormField>

          <!-- Note Field -->
          <UFormField 
            :label="t('contentLibrary.fields.note', 'Note')"
            :help="t('contentLibrary.fields.noteHelp', 'Internal notes or reminders')"
            class="w-full"
          >
            <template #label>
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.note', 'Note') }}</span>
              </span>
            </template>
            <UTextarea 
              v-model="createForm.note" 
              :rows="3"
              :placeholder="t('contentLibrary.fields.notePlaceholder', 'Internal notes or reminders...')"
              class="w-full"
            />
          </UFormField>

          <!-- YAML Meta (Read-only) -->
          <div v-if="createForm.metaYaml" class="space-y-1">
            <div class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
              <span>{{ t('common.meta') }}</span>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-600 dark:text-gray-400">
              {{ createForm.metaYaml }}
            </div>
          </div>
        </div>
      </form>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="isSaving"
          @click="isCreateModalOpen = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isSaving"
          :disabled="createForm.blocks.length === 0 || createForm.blocks.every(b => !b.text?.trim()) || !!createForm.metaError"
          @click="createItem"
        >
          {{ t('common.create', 'Create') }}
        </UButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="isEditModalOpen"
      :title="t('contentLibrary.editTitle', 'Edit content item')"
    >
      <form @submit.prevent="updateItem" class="space-y-6">
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
              @click="addBlock('edit')"
            >
              {{ t('contentLibrary.actions.addBlock') }}
            </UButton>
          </div>

          <VueDraggable
            v-model="editForm.blocks"
            handle=".drag-handle"
            class="space-y-3"
          >
            <div v-for="(block, index) in editForm.blocks" :key="index">
              <ContentBlockEditor
                :model-value="editForm.blocks[index]!"
                @update:model-value="editForm.blocks[index] = $event"
                :index="index"
                @remove="removeBlock('edit', index)"
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
            </span>
          </template>
          <UInput 
            v-model="editForm.title"
            :placeholder="t('contentLibrary.fields.titlePlaceholder', 'Product announcement, Weekly update...')"
            class="w-full"
          />
        </UFormField>

        <!-- Metadata Section -->
        <div class="pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-5">
          <div class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
            <span>{{ t('contentLibrary.sections.metadata', 'Metadata') }}</span>
          </div>

          <!-- Tags Field -->
          <UFormField 
            :label="t('contentLibrary.fields.tags', 'Tags')"
            :help="t('contentLibrary.fields.tagsHelp', 'Comma-separated tags for search')"
            class="w-full"
          >
            <template #label>
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-heroicons-hashtag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.tags', 'Tags') }}</span>
              </span>
            </template>
            <UInput 
              v-model="editForm.tags" 
              :placeholder="t('contentLibrary.fields.tagsPlaceholder', 'announcement, product, marketing')"
              class="w-full"
            />
          </UFormField>

          <!-- Note Field -->
          <UFormField 
            :label="t('contentLibrary.fields.note', 'Note')"
            :help="t('contentLibrary.fields.noteHelp', 'Internal notes or reminders')"
            class="w-full"
          >
            <template #label>
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.note', 'Note') }}</span>
              </span>
            </template>
            <UTextarea 
              v-model="editForm.note" 
              :rows="3"
              :placeholder="t('contentLibrary.fields.notePlaceholder', 'Internal notes or reminders...')"
              class="w-full"
            />
          </UFormField>

          <!-- YAML Meta (Read-only) -->
          <div v-if="editForm.metaYaml" class="space-y-1">
            <div class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
              <span>{{ t('common.meta') }}</span>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-600 dark:text-gray-400">
              {{ editForm.metaYaml }}
            </div>
          </div>
        </div>
      </form>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="isSaving"
          @click="isEditModalOpen = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isSaving"
          :disabled="editForm.blocks.length === 0 || editForm.blocks.every(b => !b.text?.trim()) || !!editForm.metaError"
          @click="updateItem"
        >
          {{ t('common.save', 'Save') }}
        </UButton>
      </template>
    </AppModal>
  </div>
</template>
