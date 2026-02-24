<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useAutosave } from '~/composables/useAutosave'
import type { NewsItem } from '~/composables/useNews'
import AppModal from '~/components/ui/AppModal.vue'
import NewsCreatePublicationModal from '~/components/news/CreatePublicationModal.vue'
import CommonDraggableTabs from '~/components/common/CommonDraggableTabs.vue'
import NewsProjectHeader from '~/components/news/ProjectNewsHeader.vue'
import NewsQuerySettingsForm from '~/components/news/QuerySettingsForm.vue'
import type { NewsQuery } from '~/components/news/QuerySettingsForm.vue'
import { useAuth } from '~/composables/useAuth'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'

definePageMeta({
  middleware: 'auth',
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const projectId = computed(() => route.params.id as string)

const { currentProject, fetchProject, isLoading: isProjectLoading } = useProjects()
const { news, isLoading: isNewsLoading, error, searchNews, hasMore, getQueries, createQuery, updateQuery, deleteQuery, reorderQueries } = useNews()
const { fetchPublicationsByProject } = usePublications()
const { user } = useAuth()

const newsQueries = ref<NewsQuery[]>([])

const selectedQueryId = useLocalStorage<string>(`project-${projectId.value}-news-selected-query`, '')
const collapsedQueries = ref<Map<string, boolean>>(new Map())

const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const editingCollectionId = ref('')
const editingCollectionName = ref('')
const deletingCollectionId = ref('')
const newCollectionName = ref('')
const isDeleting = ref(false)
const isLoadMoreLoading = ref(false)
const isQueriesLoading = ref(true)
const isCreateModalOpen = ref(false)
const selectedNewsUrl = ref('')
const selectedNewsItem = ref<NewsItem | null>(null)
const processedNewsMap = ref<Record<string, string>>({})

function toggleCollapse(queryId: string) {
  const current = collapsedQueries.value.get(queryId) ?? true
  collapsedQueries.value.set(queryId, !current)
}

function isQueryCollapsed(queryId: string): boolean {
  return collapsedQueries.value.get(queryId) ?? true
}

watch(() => route.query.id, (newId) => {
  if (newId) {
    collapsedQueries.value.set(newId as string, false)
  }
}, { immediate: true })

function handleCreatePublication(item: NewsItem) {
  selectedNewsUrl.value = item.url
  selectedNewsItem.value = item
  isCreateModalOpen.value = true
}

const currentQuery = computed(
  () => newsQueries.value.find(q => q.id === selectedQueryId.value) || null
)

async function initQueries() {
  if (!projectId.value) return

  if (!currentProject.value || currentProject.value.id !== projectId.value) {
    await fetchProject(projectId.value)
  }

  loadProcessedNews()

  try {
    isQueriesLoading.value = true
    const queries = await getQueries()

    if (queries && queries.length > 0) {
      newsQueries.value = queries

      queries.forEach((q: NewsQuery) => {
        if (!collapsedQueries.value.has(q.id)) {
          collapsedQueries.value.set(q.id, true)
        }
      })

      const queryIdParam = route.query.id as string
      if (queryIdParam) {
        const found = queries.find((q: NewsQuery) => q.id === queryIdParam)
        selectedQueryId.value = found ? found.id : queries[0].id
      } else {
        const exists = queries.some((q: NewsQuery) => q.id === selectedQueryId.value)
        if (!exists) {
          selectedQueryId.value = queries[0].id
        }
      }
    }

    nextTick(() => {
      if (currentQuery.value?.q) {
        handleSearch()
      }
    })
  } catch (e) {
    console.error('Failed to load news queries:', e)
  } finally {
    isQueriesLoading.value = false
  }
}

async function loadProcessedNews() {
  if (!projectId.value) return
  try {
    const pubs = await fetchPublicationsByProject(projectId.value, { limit: 100 })
    const map: Record<string, string> = {}
    pubs.items.forEach((pub: any) => {
      if (pub.newsItemId) {
        map[pub.newsItemId] = pub.id
      }
    })
    processedNewsMap.value = map
  } catch (e) {
    console.error('Failed to load processed news:', e)
  }
}

onMounted(initQueries)

async function handleSearch() {
  const hasQuery = currentQuery.value?.q?.trim()
  const hasSources = currentQuery.value?.sources?.trim()

  if (!hasQuery && !hasSources) {
    news.value = []
    return
  }

  await searchNews({
    q: currentQuery.value?.q || '',
    mode: currentQuery.value?.mode,
    lang: currentQuery.value?.lang,
    sourceTags: currentQuery.value?.sourceTags,
    savedFrom: currentQuery.value?.savedFrom,
    savedTo: currentQuery.value?.savedTo,
    orderBy: currentQuery.value?.orderBy,
    minScore: currentQuery.value?.minScore,
    sources: currentQuery.value?.sources,
  })
}

async function loadMore() {
  if (isLoadMoreLoading.value || !hasMore.value || !currentQuery.value) return

  isLoadMoreLoading.value = true
  try {
    await searchNews({
      q: currentQuery.value?.q || '',
      mode: currentQuery.value?.mode,
      lang: currentQuery.value?.lang,
      sourceTags: currentQuery.value?.sourceTags,
      savedFrom: currentQuery.value?.savedFrom,
      savedTo: currentQuery.value?.savedTo,
      orderBy: currentQuery.value?.orderBy,
      minScore: currentQuery.value?.minScore,
      sources: currentQuery.value?.sources,
    }, undefined, true)
  } finally {
    isLoadMoreLoading.value = false
  }
}

watch(selectedQueryId, async (newId) => {
  if (newId) {
    handleSearch()
  }
})

// Auto-save via composable
const { saveError, isDirty, isIndicatorVisible, indicatorStatus } = useAutosave({
  data: currentQuery,
  saveFn: async (query) => {
    if (!query) return { saved: false, skipped: true }
    await updateQuery(query.id, {
      q: query.q,
      mode: query.mode,
      lang: query.lang,
      sourceTags: query.sourceTags,
      savedFrom: query.savedFrom,
      savedTo: query.savedTo,
      sources: query.sources,
      minScore: query.minScore,
      orderBy: query.orderBy,
      note: query.note,
      isNotificationEnabled: query.isNotificationEnabled,
    })
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const debouncedSearch = useDebounceFn(handleSearch, SEARCH_DEBOUNCE_MS)

watch(
  () => [
    currentQuery.value?.q,
    currentQuery.value?.mode,
    currentQuery.value?.lang,
    currentQuery.value?.sourceTags,
    currentQuery.value?.sources,
    currentQuery.value?.savedFrom,
    currentQuery.value?.savedTo,
    currentQuery.value?.minScore,
    currentQuery.value?.orderBy,
  ],
  () => {
    const hasQuery = currentQuery.value?.q?.trim()
    const hasSources = currentQuery.value?.sources?.trim()
    if (hasQuery || hasSources) {
      debouncedSearch()
    }
  },
  { deep: true },
)

// Query updates from child form component
function handleQueryUpdate(updated: NewsQuery) {
  const idx = newsQueries.value.findIndex(q => q.id === updated.id)
  if (idx !== -1) {
    newsQueries.value[idx] = updated
  }
}

// Add collection
async function addCollection() {
  if (!newCollectionName.value.trim()) return

  const newQuery = {
    name: newCollectionName.value,
    q: '',
    mode: 'hybrid' as const,
    minScore: 0.5,
    orderBy: 'relevance' as const,
    lang: user.value?.language || locale.value,
    isNotificationEnabled: false,
  }

  try {
    const created = await createQuery(newQuery) as NewsQuery
    newsQueries.value.push(created)
    collapsedQueries.value.set(created.id, false)
    await nextTick()
    selectedQueryId.value = created.id
    newCollectionName.value = ''
    isAddModalOpen.value = false
  } catch (e) {
    console.error('Failed to create collection:', e)
  }
}

// Rename handlers
function openRenameModal(id: string, name: string) {
  editingCollectionId.value = id
  editingCollectionName.value = name
  isEditModalOpen.value = true
}

async function saveCollectionName() {
  if (!editingCollectionName.value.trim()) return

  const query = newsQueries.value.find(q => q.id === editingCollectionId.value)
  if (query) {
    const oldName = query.name
    query.name = editingCollectionName.value
    try {
      await updateQuery(query.id, { name: editingCollectionName.value })
    } catch (e) {
      query.name = oldName
      console.error(e)
    }
  }
  isEditModalOpen.value = false
}

// Delete handlers
function openDeleteModal(id: string) {
  deletingCollectionId.value = id
  isDeleteModalOpen.value = true
}

async function confirmDeleteCollection() {
  if (!deletingCollectionId.value) return

  isDeleting.value = true
  try {
    await deleteQuery(deletingCollectionId.value)
    const index = newsQueries.value.findIndex(q => q.id === deletingCollectionId.value)
    if (index !== -1) {
      newsQueries.value.splice(index, 1)
      if (selectedQueryId.value === deletingCollectionId.value) {
        selectedQueryId.value = newsQueries.value[Math.max(0, index - 1)]?.id || ''
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    isDeleting.value = false
    isDeleteModalOpen.value = false
    deletingCollectionId.value = ''
  }
}

async function handleCollectionsUpdate(newItems: any[]) {
  newsQueries.value = newItems as NewsQuery[]
  const ids = newItems.map(item => item.id)
  try {
    await reorderQueries(ids)
  } catch (e) {
    console.error('Failed to save collection order:', e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <NewsProjectHeader
      :project-id="projectId"
      :project-name="currentProject?.name"
    />

    <!-- Collections System -->
    <div v-if="newsQueries.length > 0" class="flex flex-col gap-6">
      <!-- Draggable Collections Header -->
      <CommonDraggableTabs
        v-model="selectedQueryId"
        v-model:items="newsQueries"
        draggable
        @add="isAddModalOpen = true"
        @update:items="handleCollectionsUpdate"
      >
        <template #tab="{ item, selected, select }">
          <UButton
            :color="selected ? 'primary' : 'neutral'"
            :variant="selected ? 'solid' : 'outline'"
            size="sm"
            class="transition-all duration-200 drag-handle cursor-pointer"
            @click="select"
          >
            {{ item.name }}
            <template #trailing>
              <UIcon
                v-if="item.isNotificationEnabled"
                name="i-heroicons-bell-alert"
                class="w-3.5 h-3.5"
                :class="selected ? 'text-primary-500' : 'text-gray-400'"
              />
            </template>
          </UButton>
        </template>
      </CommonDraggableTabs>

      <!-- Collection Content -->
      <div v-if="currentQuery" class="space-y-6">
        <!-- Query Settings Form -->
        <NewsQuerySettingsForm
          :query="currentQuery"
          :is-collapsed="isQueryCollapsed(currentQuery.id)"
          :indicator-status="indicatorStatus"
          :is-indicator-visible="isIndicatorVisible"
          :save-error="saveError"
          @update:query="handleQueryUpdate"
          @update:is-collapsed="val => collapsedQueries.set(currentQuery!.id, val)"
          @rename="openRenameModal"
          @delete="openDeleteModal"
          @search="handleSearch"
        />

        <!-- Results Section -->
        <div class="space-y-4">
          <CommonFoundCount :count="news.length" :show="news.length > 0" class="mb-4" />

          <!-- Loading state initial -->
          <div v-if="isNewsLoading && news.length === 0" class="flex flex-col items-center justify-center py-24 space-y-4">
            <UiLoadingSpinner size="xl" color="primary" :label="t('news.loading')" centered />
          </div>

          <!-- News list -->
          <CommonInfiniteList
            v-else-if="news.length > 0"
            :is-loading="isLoadMoreLoading"
            :has-more="hasMore"
            :item-count="news.length"
            @load-more="loadMore"
          >
            <div class="space-y-4">
              <NewsItem
                v-for="item in news"
                :key="item.id"
                :item="item"
                :publication-id="processedNewsMap[item.id]"
                @create-publication="handleCreatePublication"
              />
            </div>
          </CommonInfiniteList>

          <!-- Empty state -->
          <div
            v-else-if="!isNewsLoading && currentQuery.q"
            class="text-center py-24 news-config-card bg-gray-50/50 dark:bg-gray-800/30 border-dashed"
          >
            <div class="inline-flex p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <UIcon name="i-heroicons-newspaper" class="w-12 h-12 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">{{ t('news.noResults') }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('channel.adjustFilters') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (No Queries) -->
    <div
      v-else-if="!isQueriesLoading && !isProjectLoading && newsQueries.length === 0"
      class="flex flex-col items-center justify-center py-24 space-y-6 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800"
    >
      <div class="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <UIcon name="i-heroicons-newspaper" class="w-12 h-12 text-primary-500" />
      </div>
      <div class="text-center max-w-md space-y-2 px-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('news.noQueriesTitle') }}</h3>
        <p class="text-gray-500 dark:text-gray-400">{{ t('news.noQueriesDescription') }}</p>
      </div>
      <UButton
        size="lg"
        color="primary"
        icon="i-heroicons-plus"
        @click="isAddModalOpen = true"
      >
        {{ t('news.createFirstQuery') }}
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-else-if="isProjectLoading || isQueriesLoading" class="flex justify-center py-24">
      <UiLoadingSpinner size="xl" color="primary" />
    </div>

    <!-- Add Collection Modal -->
    <AppModal
      v-model:open="isAddModalOpen"
      :title="t('news.addCollection')"
    >
      <form class="space-y-4" @submit.prevent="addCollection">
        <UFormField :label="t('news.collectionName')">
          <UInput
            v-model="newCollectionName"
            :placeholder="t('news.collectionNamePlaceholder')"
            autofocus
            size="lg"
          />
        </UFormField>
        <div class="flex justify-end gap-3 mt-6">
          <UButton color="neutral" variant="ghost" @click="isAddModalOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :disabled="!newCollectionName.trim()">
            {{ t('common.create') }}
          </UButton>
        </div>
      </form>
    </AppModal>

    <!-- Edit Collection Modal -->
    <AppModal
      v-model:open="isEditModalOpen"
      :title="t('news.editCollection')"
      :description="t('news.editCollectionDescription')"
    >
      <form class="space-y-4" @submit.prevent="saveCollectionName">
        <UFormField :label="t('news.collectionName')">
          <UInput
            v-model="editingCollectionName"
            :placeholder="t('news.collectionNamePlaceholder')"
            autofocus
            size="lg"
          />
        </UFormField>
        <div class="flex justify-end gap-3 mt-6">
          <UButton color="neutral" variant="ghost" @click="isEditModalOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :disabled="!editingCollectionName.trim()">
            {{ t('common.save') }}
          </UButton>
        </div>
      </form>
    </AppModal>

    <!-- Delete Collection Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('common.confirmDelete')"
      :description="t('news.deleteCollectionConfirm')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeleting"
      @confirm="confirmDeleteCollection"
    />

    <NewsCreatePublicationModal
      v-model:open="isCreateModalOpen"
      v-model:url="selectedNewsUrl"
      :source-news-item="selectedNewsItem || undefined"
      :project-id="projectId"
    />
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.news-config-card {
  @apply bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-200;
}
</style>
