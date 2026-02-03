<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import AppModal from '~/components/ui/AppModal.vue'

definePageMeta({
  middleware: 'auth',
})

interface ContentText {
  id: string
  content: string
  type?: string
  order: number
}

interface ContentItemMedia {
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

interface ContentItem {
  id: string
  title: string | null
  note: string | null
  tags: string[]
  createdAt: string
  archivedAt: string | null
  texts: ContentText[]
  media: ContentItemMedia[]
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
const showArchivedOnly = ref(false)
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
  text: '',
})

const editForm = ref({
  title: '',
  tags: '',
  note: '',
  text: '',
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
        archivedOnly: showArchivedOnly.value ? true : undefined,
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
  () => showArchivedOnly.value,
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
    text: '',
  }
}

const openCreateModal = () => {
  resetCreateForm()
  isCreateModalOpen.value = true
}

const openEditModal = (item: ContentItem) => {
  activeItem.value = item

  const firstText = item.texts?.[0]?.content || ''

  editForm.value = {
    title: item.title || '',
    tags: formatTags(item.tags || []),
    note: item.note || '',
    text: firstText,
  }

  isEditModalOpen.value = true
}

const createItem = async () => {
  if (!projectId.value) return

  const text = createForm.value.text.trim()
  if (!text) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('contentLibrary.validation.textRequired', 'Text is required'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  isSaving.value = true
  try {
    await api.post('/content-library/items', {
      scope: 'project',
      projectId: projectId.value,
      title: createForm.value.title || undefined,
      tags: parseTags(createForm.value.tags),
      note: createForm.value.note || undefined,
      texts: [
        {
          content: text,
          type: 'plain',
        },
      ],
      media: [],
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
  const firstText = item.texts?.[0]
  const nextTextValue = editForm.value.text.trim()

  if (!nextTextValue) {
    toast.add({
      title: t('common.error', 'Error'),
      description: t('contentLibrary.validation.textRequired', 'Text is required'),
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  isSaving.value = true
  try {
    await api.patch(`/content-library/items/${item.id}`, {
      title: editForm.value.title || null,
      tags: parseTags(editForm.value.tags),
      note: editForm.value.note || null,
    })

    if (firstText) {
      await api.patch(`/content-library/items/${item.id}/texts/${firstText.id}`, {
        content: nextTextValue,
        type: firstText.type || 'plain',
      })
    } else {
      await api.post(`/content-library/items/${item.id}/texts`, {
        content: nextTextValue,
        type: 'plain',
      })
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
  const firstText = item.texts?.[0]?.content
  if (firstText) {
    return stripHtmlAndSpecialChars(firstText).slice(0, 220)
  }

  if (item.note) {
    return stripHtmlAndSpecialChars(item.note).slice(0, 220)
  }

  if ((item.media?.length ?? 0) > 0) {
    return t('contentLibrary.preview.mediaOnly', 'Media only')
  }

  return ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
          {{ t('contentLibrary.title', 'Content library') }}
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
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            :icon="showArchivedOnly ? 'i-heroicons-archive-box' : 'i-heroicons-inbox'"
            @click="showArchivedOnly = !showArchivedOnly"
          >
            {{
              showArchivedOnly
                ? t('contentLibrary.filters.archivedOnly', 'Archived')
                : t('contentLibrary.filters.activeOnly', 'Active')
            }}
          </UButton>

          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('common.total', { count: total }, `Total: ${total}`) }}
          </div>

          <UButton
            v-if="showArchivedOnly"
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
                  {{ t('contentLibrary.textsCount', { count: item.texts?.length || 0 }, `${item.texts?.length || 0} texts`) }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-photo" class="w-4 h-4" />
                  {{ t('contentLibrary.mediaCount', { count: item.media?.length || 0 }, `${item.media?.length || 0} media`) }}
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
        <!-- Text Field (Primary - Required) -->
        <UFormField 
          :label="t('contentLibrary.fields.text', 'Text')" 
          required
          :help="t('contentLibrary.fields.textHelp', 'Main content of the item')"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-primary-500" />
              <span class="font-semibold">{{ t('contentLibrary.fields.text', 'Text') }}</span>
              <span class="text-red-500 text-base">*</span>
            </div>
          </template>
          <UTextarea 
            v-model="createForm.text" 
            :rows="10"
            :placeholder="t('contentLibrary.fields.textPlaceholder', 'Enter the main content here...')"
            autofocus
            class="font-mono"
          />
        </UFormField>

        <!-- Title Field -->
        <UFormField 
          :label="t('contentLibrary.fields.title', 'Title')"
          :help="t('contentLibrary.fields.titleHelp', 'Optional title for easier identification')"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>{{ t('contentLibrary.fields.title', 'Title') }}</span>
            </div>
          </template>
          <UInput 
            v-model="createForm.title"
            :placeholder="t('contentLibrary.fields.titlePlaceholder', 'Product announcement, Weekly update...')"
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
          >
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-hashtag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.tags', 'Tags') }}</span>
              </div>
            </template>
            <UInput 
              v-model="createForm.tags" 
              :placeholder="t('contentLibrary.fields.tagsPlaceholder', 'announcement, product, marketing')"
            />
          </UFormField>

          <!-- Note Field -->
          <UFormField 
            :label="t('contentLibrary.fields.note', 'Note')"
            :help="t('contentLibrary.fields.noteHelp', 'Internal notes or reminders')"
          >
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.note', 'Note') }}</span>
              </div>
            </template>
            <UTextarea 
              v-model="createForm.note" 
              :rows="3"
              :placeholder="t('contentLibrary.fields.notePlaceholder', 'Internal notes or reminders...')"
            />
          </UFormField>
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
          :disabled="!createForm.text.trim()"
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
        <!-- Text Field (Primary - Required) -->
        <UFormField 
          :label="t('contentLibrary.fields.text', 'Text')" 
          required
          :help="t('contentLibrary.fields.textHelp', 'Main content of the item')"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-primary-500" />
              <span class="font-semibold">{{ t('contentLibrary.fields.text', 'Text') }}</span>
              <span class="text-red-500 text-base">*</span>
            </div>
          </template>
          <UTextarea 
            v-model="editForm.text" 
            :rows="10"
            :placeholder="t('contentLibrary.fields.textPlaceholder', 'Enter the main content here...')"
            autofocus
            class="font-mono"
          />
        </UFormField>

        <!-- Title Field -->
        <UFormField 
          :label="t('contentLibrary.fields.title', 'Title')"
          :help="t('contentLibrary.fields.titleHelp', 'Optional title for easier identification')"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>{{ t('contentLibrary.fields.title', 'Title') }}</span>
            </div>
          </template>
          <UInput 
            v-model="editForm.title"
            :placeholder="t('contentLibrary.fields.titlePlaceholder', 'Product announcement, Weekly update...')"
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
          >
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-hashtag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.tags', 'Tags') }}</span>
              </div>
            </template>
            <UInput 
              v-model="editForm.tags" 
              :placeholder="t('contentLibrary.fields.tagsPlaceholder', 'announcement, product, marketing')"
            />
          </UFormField>

          <!-- Note Field -->
          <UFormField 
            :label="t('contentLibrary.fields.note', 'Note')"
            :help="t('contentLibrary.fields.noteHelp', 'Internal notes or reminders')"
          >
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{{ t('contentLibrary.fields.note', 'Note') }}</span>
              </div>
            </template>
            <UTextarea 
              v-model="editForm.note" 
              :rows="3"
              :placeholder="t('contentLibrary.fields.notePlaceholder', 'Internal notes or reminders...')"
            />
          </UFormField>
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
          :disabled="!editForm.text.trim()"
          @click="updateItem"
        >
          {{ t('common.save', 'Save') }}
        </UButton>
      </template>
    </AppModal>
  </div>
</template>
