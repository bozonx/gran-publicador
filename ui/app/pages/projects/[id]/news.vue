<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useAutosave } from '~/composables/useAutosave'
import type { NewsItem } from '~/composables/useNews'
import AppModal from '~/components/ui/AppModal.vue'
import AppTabs from '~/components/ui/AppTabs.vue'
import NewsCreatePublicationModal from '~/components/news/CreatePublicationModal.vue'
import NewsSourceSelector from '~/components/news/SourceSelector.vue'
import { useAuth } from '~/composables/useAuth'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import NewsSourceTagSelector from '~/components/news/SourceTagSelector.vue'



interface NewsQuery {
  id: string
  name: string
  q: string
  mode?: 'text' | 'vector' | 'hybrid'
  savedFrom?: string
  savedTo?: string
  lang?: string
  sourceTags?: string
  sources?: string
  minScore: number
  orderBy?: 'relevance' | 'savedAt'
  note: string
  isNotificationEnabled: boolean
}

interface NewsCollectionItem {
  label: string
  id: string
  slot: string
  isNotificationEnabled?: boolean
}

definePageMeta({
  middleware: 'auth',
})

const { t, d, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const projectId = computed(() => route.params.id as string)

const { currentProject, fetchProject, updateProject, isLoading: isProjectLoading } = useProjects()
const { news, isLoading: isNewsLoading, error, searchNews, hasMore, getQueries, createQuery, updateQuery, deleteQuery, reorderQueries } = useNews()
const { fetchPublicationsByProject } = usePublications()
const { user } = useAuth()

const newsQueries = ref<NewsQuery[]>([])

// Collection and Collapse state management
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
const processedNewsMap = ref<Record<string, string>>({}) // newsId -> publicationId

// Toggle collapse state for a query
function toggleCollapse(queryId: string) {
  const current = collapsedQueries.value.get(queryId) ?? true
  collapsedQueries.value.set(queryId, !current)
}

// Check if query is collapsed
function isQueryCollapsed(queryId: string): boolean {
  return collapsedQueries.value.get(queryId) ?? true
}

// Ensure settings are expanded when navigating via Configure button (with id in URL)
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

const currentQuery = computed(() => {
  return newsQueries.value.find(q => q.id === selectedQueryId.value) || null
})

// Initialize news queries from API
const selectedSources = computed({
  get: () => currentQuery.value?.sources?.split(',').filter(Boolean) || [],
  set: (val: string[]) => {
    if (currentQuery.value) {
      currentQuery.value.sources = val.join(',')
    }
  }
})

// Initialize news queries from API
async function initQueries() {
  if (projectId.value) {
    if (!currentProject.value || currentProject.value.id !== projectId.value) {
      await fetchProject(projectId.value)
    }


    // Load publications to mark processed news
    loadProcessedNews()
    
    try {
      isQueriesLoading.value = true
      const queries = await getQueries()
      
      if (queries && queries.length > 0) {
        newsQueries.value = queries
        
        // Initialize collapse state for new queries (default to collapsed)
        queries.forEach(q => {
          if (!collapsedQueries.value.has(q.id)) {
            collapsedQueries.value.set(q.id, true)
          }
        })
        
        // Select query by ID from URL if provided, otherwise stored, otherwise first one
        const queryIdParam = route.query.id as string
        if (queryIdParam) {
          const found = queries.find(q => q.id === queryIdParam)
          if (found) {
            selectedQueryId.value = found.id
          } else {
            selectedQueryId.value = queries[0].id
          }
        } else {
          // Check if stored value is still valid
          const exists = queries.some(q => q.id === selectedQueryId.value)
          if (!exists) {
            selectedQueryId.value = queries[0].id
          }
        }
      }
      
      // Initial search
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
}

async function loadProcessedNews() {
  if (!projectId.value) return
  try {
    const pubs = await fetchPublicationsByProject(projectId.value, { limit: 100 })
    const map: Record<string, string> = {}
    
    pubs.items.forEach(pub => {
      const newsId = pub.newsItemId
      if (newsId) {
        map[newsId] = pub.id
      }
    })
    
    processedNewsMap.value = map
  } catch (e) {
    console.error('Failed to load processed news:', e)
  }
}

onMounted(initQueries)

// Perform search using current query parameters
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
    sources: currentQuery.value?.sources
  })
}

// Load more results
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
      sources: currentQuery.value?.sources
    }, undefined, true)
  } finally {
    isLoadMoreLoading.value = false
  }
}

// Watch collection changes to refresh news
watch(selectedQueryId, async (newId) => {
  if (newId) {
    handleSearch()
  }
})

// Auto-save setup using composable
const { saveStatus, saveError, lastSavedAt, isDirty, isIndicatorVisible, indicatorStatus, retrySave } = useAutosave({
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
      isNotificationEnabled: query.isNotificationEnabled
    })
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

// Auto-search with debounce (separate from auto-save)
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
  { deep: true }
)

// Add new search collection
async function addCollection() {
  if (!newCollectionName.value.trim()) return
  
  const newQuery = {
    name: newCollectionName.value,
    q: '',
    mode: 'hybrid' as const,
    minScore: 0.5,
    orderBy: 'relevance' as const,
    lang: user.value?.language || locale.value,
    isNotificationEnabled: false
  }
  
  try {
    const created = await createQuery(newQuery) as NewsQuery
    newsQueries.value.push(created)
    
    // Set newly created query as expanded (not collapsed)
    collapsedQueries.value.set(created.id, false)
    
    await nextTick()
    
    // Select the new collection
    selectedQueryId.value = created.id
    
    newCollectionName.value = ''
    isAddModalOpen.value = false
  } catch (e) {
    console.error('Failed to create collection:', e)
  }
}

// Open edit modal
function openEditModal(id: string, name: string) {
  editingCollectionId.value = id
  editingCollectionName.value = name
  isEditModalOpen.value = true
}

// Save collection name from modal
async function saveCollectionName() {
  if (!editingCollectionName.value.trim()) return
  
  const query = newsQueries.value.find(q => q.id === editingCollectionId.value)
  if (query) {
    // Optimistic update
    const oldName = query.name
    query.name = editingCollectionName.value
    
    try {
      await updateQuery(query.id, { name: editingCollectionName.value })
    } catch (e) {
      query.name = oldName // Revert on error
      console.error(e)
    }
  }
  isEditModalOpen.value = false
}

// Open delete confirmation modal
// Open delete confirmation modal
function openDeleteModal(id: string) {
  deletingCollectionId.value = id
  isDeleteModalOpen.value = true
}

// Delete collection after confirmation
async function confirmDeleteCollection() {
  if (!deletingCollectionId.value) return
  
  isDeleting.value = true
  try {
    await deleteQuery(deletingCollectionId.value)
    
    const index = newsQueries.value.findIndex(q => q.id === deletingCollectionId.value)
    if (index !== -1) {
      newsQueries.value.splice(index, 1)
      if (selectedQueryId.value === deletingCollectionId.value) {
        // If we deleted the active collection, select the previous one or the first one
        selectedQueryId.value = newsQueries.value[Math.max(0, index - 1)]?.id || ''
      }
    }
  } catch(e) {
    console.error(e)
  } finally {
    isDeleting.value = false
    isDeleteModalOpen.value = false
    deletingCollectionId.value = ""
  }
}

// Handle collection reordering
async function handleCollectionsUpdate(newItems: any[]) {
  // Update local list to reflect new order immediately
  newsQueries.value = newItems as NewsQuery[]
  
  // Extract IDs in new order
  const ids = newItems.map(item => item.id)
  
  // Save to backend
  try {
    await reorderQueries(ids)
  } catch (e) {
    console.error('Failed to save collection order:', e)
    // Ideally revert the change here if failed
  }
}

// Format date
function formatDate(dateString: string) {
  try {
    return d(new Date(dateString), 'short')
  } catch {
    return dateString
  }
}

// Format score as percentage
function formatScore(score: number) {
  return `${Math.round(score * 100)}%`
}

const sourcesTooltipText = computed(() => {
  return `${t('news.sourcesDescription')}\n\n${t('news.search_not_required_with_sources')}`
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <NuxtLink :to="`/projects/${projectId}`" class="hover:text-primary-500 transition-colors flex items-center gap-1">
            <UIcon name="i-heroicons-folder" class="w-4 h-4" />
            {{ currentProject?.name || t('project.title') }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
          <span>{{ t('news.news_selections') }}</span>
        </div>
        
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center flex-wrap gap-x-3 gap-y-2">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-newspaper" class="w-8 h-8 text-primary-500" />
            {{ t('news.news_selections') }}
          </div>
          
          <template v-if="currentProject">
            <span class="hidden md:block text-gray-300 dark:text-gray-700 font-normal">·</span>
            <NuxtLink 
              :to="`/projects/${projectId}`" 
              class="flex items-center gap-1.5 text-lg font-medium text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"
            >
              <UIcon name="i-heroicons-folder" class="w-5 h-5 mt-0.5" />
              {{ currentProject.name }}
            </NuxtLink>
          </template>
        </h1>
      </div>


    </div>

    <!-- Collections System -->
    <div v-if="newsQueries.length > 0" class="flex flex-col gap-6">
      
      <!-- Draggable Collections Header -->
      <AppTabs
        v-model="selectedQueryId"
        :items="newsQueries"
        draggable
        @update:items="handleCollectionsUpdate"
      >
        <template #tab-trailing="{ item, selected }">
           <UIcon 
            v-if="item.isNotificationEnabled" 
            name="i-heroicons-bell-alert" 
            class="w-3.5 h-3.5"
            :class="selected ? 'text-primary-500' : 'text-gray-400'"
          />
        </template>
        
        <template #append>
          <UButton
            icon="i-heroicons-plus"
            color="neutral"
            variant="soft"
            size="sm"
            @click="isAddModalOpen = true"
          />
        </template>
      </AppTabs>

      <!-- Collection Content -->
      <div v-if="currentQuery" class="space-y-6">
        <!-- Search settings card -->
        <div 
          class="news-config-card overflow-hidden transition-all duration-300"
          :class="{ 
            'cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800': isQueryCollapsed(currentQuery.id)
          }"
          @click="isQueryCollapsed(currentQuery.id) && toggleCollapse(currentQuery.id)"
        >
          <!-- Card Header with Caret Button -->
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {{ currentQuery.name }}
                <UIcon 
                  v-if="currentQuery.isNotificationEnabled" 
                  name="i-heroicons-bell-alert" 
                  class="w-4 h-4 text-primary-500"
                />
              </h2>
            </div>
            <UButton
              :icon="isQueryCollapsed(currentQuery.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
              color="neutral"
              variant="ghost"
              size="sm"
              :title="isQueryCollapsed(currentQuery.id) ? t('common.expand') : t('common.collapse')"
              @click.stop="toggleCollapse(currentQuery.id)"
            />
          </div>

          <!-- Collapsed Summary View -->
          <div v-if="isQueryCollapsed(currentQuery.id)" class="px-6 pb-6 space-y-3">
            <!-- Search Query Preview -->
            <div v-if="currentQuery.q" class="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 mt-0.5 shrink-0" />
              <span class="truncate">
                {{ currentQuery.q.length > 200 ? currentQuery.q.slice(0, 200) + '...' : currentQuery.q }}
              </span>
            </div>

            <!-- Key Parameters -->
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <!-- Mode -->
              <div class="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 rounded-md border border-primary-100 dark:border-primary-800">
                <UIcon name="i-heroicons-magnifying-glass" class="w-3.5 h-3.5" />
                <span class="font-medium">
                  {{ currentQuery.mode === 'text' ? t('news.modeText') : currentQuery.mode === 'vector' ? t('news.modeVector') : t('news.modeHybrid') }}
                </span>
              </div>

              <!-- Language -->
              <div v-if="currentQuery.lang" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-language" class="w-3.5 h-3.5" />
                <span>{{ currentQuery.lang }}</span>
              </div>

              <!-- Date Range -->
              <div v-if="currentQuery.savedFrom || currentQuery.savedTo" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                <span>
                  {{ currentQuery.savedFrom || '...' }} — {{ currentQuery.savedTo || '...' }}
                </span>
              </div>

              <!-- Sources -->
              <div v-if="currentQuery.sources" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-globe-alt" class="w-3.5 h-3.5" />
                <span class="truncate max-w-[200px]">{{ currentQuery.sources }}</span>
              </div>

              <!-- Source Tags -->
              <div v-if="currentQuery.sourceTags" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5" />
                <span class="truncate max-w-[200px]">{{ currentQuery.sourceTags }}</span>
              </div>

              <!-- Min Score -->
              <div class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" />
                <span>{{ currentQuery.minScore }}</span>
              </div>
            </div>
          </div>

          <!-- Expanded Full Form -->
          <div v-else class="px-6 pb-6 space-y-6">
            <!-- Search row (Query input) -->
            <div class="w-full">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('news.searchPlaceholder') }}
              </label>
              <UTextarea
                v-model="currentQuery.q"
                :placeholder="t('news.searchPlaceholder')"
                size="lg"
                class="w-full"
                :rows="3"
                autoresize
                @keydown.enter.ctrl.prevent="handleSearch"
                @keydown.enter.meta.prevent="handleSearch"
              />
            </div>


            <!-- Search Mode Selection -->
            <div class="w-full">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('news.mode') }}
              </label>
              <UiAppButtonGroup
                v-model="currentQuery.mode"
                :options="[
                  { value: 'text', label: t('news.modeText') },
                  { value: 'vector', label: t('news.modeVector') },
                  { value: 'hybrid', label: t('news.modeHybrid') }
                ]"
                variant="outline"
                active-variant="solid"
                fluid
                size="lg"
              />
            </div>

            <!-- Language & Score -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.language') }}
                </label>
                <CommonLanguageSelect
                  v-model="currentQuery.lang"
                  mode="all"
                  searchable
                />
              </div>

              <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Min Score
                </label>
                <div class="flex flex-col gap-2 pt-2">
                  <input
                    v-model.number="currentQuery.minScore"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500 mt-2"
                  />
                  <div class="flex justify-between text-xs text-gray-500 font-medium">
                    <span>0.0</span>
                    <span class="text-primary-500 font-bold text-sm bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded border border-primary-100 dark:border-primary-800">{{ currentQuery.minScore }}</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sources & Source Tags -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-if="currentQuery" class="w-full">
                <label class="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.sources') }}
                  <CommonInfoTooltip :text="sourcesTooltipText" />
                </label>
                <NewsSourceSelector v-model="selectedSources" />
              </div>

               <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.sourceTags') }}
                </label>
                <NewsSourceTagSelector
                  v-model="currentQuery.sourceTags"
                  :placeholder="t('news.sourceTagsPlaceholder')"
                />
              </div>
            </div>

            <!-- Saved From & To -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.savedFrom') }}
                </label>
                <UInput
                  v-model="currentQuery.savedFrom"
                  type="date"
                  size="lg"
                  icon="i-heroicons-calendar"
                />
              </div>

              <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.savedTo') }}
                </label>
                <UInput
                  v-model="currentQuery.savedTo"
                  type="date"
                  size="lg"
                  icon="i-heroicons-calendar"
                />
              </div>
            </div>

            <!-- Order By -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-if="currentQuery">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('news.orderBy') }}
                </label>
                <UiAppButtonGroup
                  v-model="currentQuery.orderBy"
                  :options="[
                    { value: 'relevance', label: t('news.orderByRelevance') },
                    { value: 'savedAt', label: t('news.orderBySavedAt') }
                  ]"
                  variant="outline"
                  active-variant="solid"
                  fluid
                  size="lg"
                />
              </div>
            </div>

            <!-- Note Row -->
            <div class="pt-4 border-t border-gray-100 dark:border-gray-800 w-full">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('news.note') }}
              </label>
              <UTextarea
                v-model="currentQuery.note"
                :placeholder="t('news.notePlaceholder')"
                :rows="6"
                size="lg"
                autoresize
                class="w-full"
              />
            </div>

            <!-- Toolbar: Notifications & Actions -->
            <div class="flex justify-between items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div class="flex items-center gap-1.5 px-1">
                <UCheckbox 
                  v-model="currentQuery.isNotificationEnabled" 
                  size="md"
                  color="primary"
                >
                  <template #label>
                    <div class="flex items-center gap-2 cursor-pointer select-none">
                      <UIcon 
                        :name="currentQuery.isNotificationEnabled ? 'i-heroicons-bell-alert' : 'i-heroicons-bell'" 
                        class="w-5 h-5 transition-colors"
                        :class="currentQuery.isNotificationEnabled ? 'text-primary-500' : 'text-gray-400'"
                      />
                      <span class="text-sm font-medium" :class="currentQuery.isNotificationEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'">
                        {{ t('news.notifications') }}
                      </span>
                    </div>
                  </template>
                </UCheckbox>
              </div>

              <div class="flex items-center gap-3">
                <UiSaveStatusIndicator
                  :status="indicatorStatus"
                  :visible="isIndicatorVisible"
                  :error="saveError"
                  show-retry
                  @retry="retrySave"
                />

                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-pencil-square"
                  @click="currentQuery && openEditModal(currentQuery.id, currentQuery.name)"
                >
                  {{ t('common.rename') }}
                </UButton>
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  @click="currentQuery && openDeleteModal(currentQuery.id)"
                >
                  {{ t('common.delete') }}
                </UButton>
              </div>
            </div>

          </div>
        </div>

        <!-- Results Section -->
        <div class="space-y-4">
          <CommonFoundCount :count="news.length" :show="news.length > 0" class="mb-4" />
          
          <!-- Loading state initial -->
          <div v-if="isNewsLoading && news.length === 0" class="flex flex-col items-center justify-center py-24 space-y-4">
            <UiLoadingSpinner size="xl" color="primary" :label="t('news.loading')" centered />
          </div>

          <!-- News list -->
          <div v-else-if="news.length > 0" class="space-y-4">
            <NewsItem
              v-for="item in news"
              :key="item.id"
              :item="item"
              :publication-id="processedNewsMap[item.id]"
              @create-publication="handleCreatePublication"
            />
            
            <!-- Load More Button -->
            <div v-if="hasMore" class="flex justify-center pt-4 pb-8">
              <UButton
                size="lg"
                variant="soft"
                color="neutral" 
                :loading="isLoadMoreLoading"
                icon="i-heroicons-arrow-down"
                @click="loadMore"
              >
                {{ t('common.loadMore') }}
              </UButton>
            </div>
          </div>

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

    <!-- Initial state when project is loading -->
    <!-- Empty State (No Queries) -->
    <div v-else-if="!isQueriesLoading && !isProjectLoading && newsQueries.length === 0" class="flex flex-col items-center justify-center py-24 space-y-6 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
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

    <!-- Initial state when project is loading -->
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
          <UButton
            color="neutral"
            variant="ghost"
            @click="isAddModalOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :disabled="!newCollectionName.trim()"
          >
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
          <UButton
            color="neutral"
            variant="ghost"
            @click="isEditModalOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :disabled="!editingCollectionName.trim()"
          >
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
