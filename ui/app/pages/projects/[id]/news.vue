<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'
import type { NewsItem } from '~/composables/useNews'
import AppModal from '~/components/ui/AppModal.vue'
import NewsCreatePublicationModal from '~/components/news/CreatePublicationModal.vue'

interface NewsQuery {
  id: string
  name: string
  q: string
  mode?: 'text' | 'vector' | 'hybrid'
  since?: string
  lang?: string
  sourceTags?: string
  newsTags?: string
  minScore: number
  note: string
  isNotificationEnabled: boolean
}

interface NewsTabItem {
  label: string
  id: string
  slot: string
  isNotificationEnabled?: boolean
}

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { currentProject, fetchProject, updateProject, isLoading: isProjectLoading } = useProjects()
const { news, isLoading: isNewsLoading, error, searchNews, hasMore, getQueries, createQuery, updateQuery, deleteQuery } = useNews()

const newsQueries = ref<NewsQuery[]>([])
const activeTabIndex = ref(0)
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const editingTabId = ref('')
const editingTabName = ref('')
const deletingTabId = ref('')
const newTabName = ref('')
const isSaving = ref(false)
const isDeleting = ref(false)
const isLoadMoreLoading = ref(false)
const isCreateModalOpen = ref(false)
const selectedNewsUrl = ref('')

function handleCreatePublication(item: any) {
  selectedNewsUrl.value = item.url
  isCreateModalOpen.value = true
}

// Tabs for UTabs component
const tabs = computed<NewsTabItem[]>(() => {
  return newsQueries.value
    .slice()
    .map((q) => ({
      label: q.name,
      id: q.id,
      isNotificationEnabled: q.isNotificationEnabled,
      slot: 'content'
    }))
})

// Find the real index in newsQueries based on the sorted tabs
const activeQueryIndex = computed(() => {
  const activeTab = tabs.value[activeTabIndex.value]
  if (!activeTab) return -1
  return newsQueries.value.findIndex(q => q.id === activeTab.id)
})

const currentQuery = computed(() => {
  const query = newsQueries.value.find(q => q.id === tabs.value[activeTabIndex.value]?.id)
  return query || null
})

// Initialize news queries from API
async function initQueries() {
  if (projectId.value) {
    if (!currentProject.value || currentProject.value.id !== projectId.value) {
      await fetchProject(projectId.value)
    }
    
    try {
      const queries = await getQueries()
      
      if (queries && queries.length > 0) {
        newsQueries.value = queries
        
        // Note: We don't have default anymore, so just use first one or last active?
        // Let's stick to first one for now, or maybe the one with notifications enabled?
        // For now index 0 is fine as they are not reordered by default flag anymore.
        activeTabIndex.value = 0
      } else {
        // Create initial default query
        const defaultQuery = {
          name: t('news.title'),
          q: currentProject.value?.name || '',
          mode: 'hybrid',
          since: '1d',
          minScore: 0.5,
          minScore: 0.5,
          isNotificationEnabled: false
        }
        
        const created = await createQuery(defaultQuery)
        newsQueries.value = [created]
        activeTabIndex.value = 0
      }
      
      // Initial search
      nextTick(() => {
        if (currentQuery.value?.q) {
          handleSearch()
        }
      })
    } catch (e) {
      console.error('Failed to load news queries:', e)
    }
  }
}

onMounted(initQueries)

// Perform search using current query parameters
async function handleSearch() {
  if (!currentQuery.value?.q.trim()) {
    news.value = []
    return
  }

  await searchNews({
    q: currentQuery.value.q,
    mode: currentQuery.value.mode,
    since: currentQuery.value.since,
    lang: currentQuery.value.lang,
    sourceTags: currentQuery.value.sourceTags,
    newsTags: currentQuery.value.newsTags,
    minScore: currentQuery.value.minScore,
  })
}

// Load more results
async function loadMore() {
  if (isLoadMoreLoading.value || !hasMore.value || !currentQuery.value) return
  
  isLoadMoreLoading.value = true
  try {
    await searchNews({
      q: currentQuery.value.q,
      mode: currentQuery.value.mode,
      since: currentQuery.value.since,
      lang: currentQuery.value.lang,
      sourceTags: currentQuery.value.sourceTags,
      newsTags: currentQuery.value.newsTags,
      minScore: currentQuery.value.minScore,
    }, undefined, true)
  } finally {
    isLoadMoreLoading.value = false
  }
}

// Watch tab changes to refresh news
watch(activeTabIndex, async (newIndex) => {
  handleSearch()
})

// Watch parameters for auto-search with debounce
watchDebounced(() => [
    currentQuery.value?.q,
    currentQuery.value?.mode,
    currentQuery.value?.since,
    currentQuery.value?.lang,
    currentQuery.value?.sourceTags,
    currentQuery.value?.newsTags,
    currentQuery.value?.minScore
], () => {
    handleSearch()
}, { debounce: 500, deep: true })

// Add new search tab
async function addTab() {
  if (!newTabName.value.trim()) return
  
  const newQuery = {
    name: newTabName.value,
    q: '',
    mode: 'hybrid',
    since: '1d',
    minScore: 0.5,
    isNotificationEnabled: false
  }
  
  try {
    const created = await createQuery(newQuery)
    newsQueries.value.push(created)
    
    await nextTick()
    
    // Find index of the new tab in the rendered tabs
    const newTabIndex = tabs.value.findIndex(t => t.id === created.id)
    if (newTabIndex !== -1) {
      activeTabIndex.value = newTabIndex
    }
    
    newTabName.value = ''
    isAddModalOpen.value = false
  } catch (e) {
    console.error('Failed to create tab:', e)
  }
}

// Open edit modal
function openEditModal(id: string, name: string) {
  editingTabId.value = id
  editingTabName.value = name
  isEditModalOpen.value = true
}

// Save tab name from modal
async function saveTabName() {
  if (!editingTabName.value.trim()) return
  
  const query = newsQueries.value.find(q => q.id === editingTabId.value)
  if (query) {
    // Optimistic update
    const oldName = query.name
    query.name = editingTabName.value
    
    try {
      await updateQuery(query.id, { name: editingTabName.value })
    } catch (e) {
      query.name = oldName // Revert on error
      console.error(e)
    }
  }
  isEditModalOpen.value = false
}

// Open delete confirmation modal
function openDeleteModal(id: string) {
  if (newsQueries.value.length <= 1) return
  deletingTabId.value = id
  isDeleteModalOpen.value = true
}

// Delete tab after confirmation
async function confirmDeleteTab() {
  if (!deletingTabId.value) return
  
  isDeleting.value = true
  try {
    await deleteQuery(deletingTabId.value)
    
    const index = newsQueries.value.findIndex(q => q.id === deletingTabId.value)
    if (index !== -1) {
      newsQueries.value.splice(index, 1)
      if (activeTabIndex.value >= newsQueries.value.length) {
        activeTabIndex.value = newsQueries.value.length - 1
      }
    }
  } catch(e) {
    console.error(e)
  } finally {
    isDeleting.value = false
    isDeleteModalOpen.value = false
    deletingTabId.value = ""
  }
}


// Save current query settings
async function saveQueries() {
  if (!currentQuery.value) return
  
  isSaving.value = true
  try {
    await updateQuery(currentQuery.value.id, {
        q: currentQuery.value.q,
        mode: currentQuery.value.mode,
        since: currentQuery.value.since,
        lang: currentQuery.value.lang,
        sourceTags: currentQuery.value.sourceTags,
        newsTags: currentQuery.value.newsTags,
        minScore: currentQuery.value.minScore,
        note: currentQuery.value.note,
        isNotificationEnabled: currentQuery.value.isNotificationEnabled
    })
  } finally {
    isSaving.value = false
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

const timeRangeOptions = [
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '12h', value: '12h' },
  { label: '1d', value: '1d' },
  { label: '2d', value: '2d' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <NuxtLink :to="`/projects/${projectId}`" class="hover:text-primary-500 transition-colors">
            {{ currentProject?.name || t('project.title') }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
          <span>{{ t('news.title') }}</span>
        </div>
        
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <UIcon name="i-heroicons-newspaper" class="w-8 h-8 text-primary-500" />
          {{ t('news.title') }}
        </h1>
      </div>

      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-check"
          color="primary"
          :loading="isSaving"
          @click="saveQueries"
        >
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <!-- Tabs System -->
    <div v-if="newsQueries.length > 0" class="flex items-start gap-4">
      <UTabs 
        v-model="activeTabIndex" 
        :items="tabs" 
        class="flex-1 min-w-0"
      >
        <template #default="{ item, index }">
          <div class="flex items-center gap-2">
            <UIcon 
              v-if="item.isNotificationEnabled" 
              name="i-heroicons-bell-alert" 
              class="w-4 h-4 text-primary-500"
            />
            <span class="truncate max-w-[120px] md:max-w-none">{{ item.label }}</span>
            
            <div v-if="activeTabIndex === index" class="flex items-center gap-0.5 -mr-1">
              <UButton
                icon="i-heroicons-pencil-square"
                size="xs"
                color="neutral"
                variant="ghost"
                @click.stop="openEditModal(item.id, newsQueries.find(q => q.id === item.id)?.name || '')"
              />
              <UButton
                v-if="newsQueries.length > 1"
                icon="i-heroicons-trash"
                size="xs"
                color="neutral"
                variant="ghost"
                @click.stop="openDeleteModal(item.id)"
              />
            </div>
          </div>
        </template>

        <template #content>
          <div v-if="currentQuery" class="space-y-6">
            <!-- Search settings card -->
            <div class="news-config-card overflow-hidden">
              <div class="p-6 space-y-6">
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
                    {{ t('news.mode') || 'Search Mode' }}
                  </label>
                  <div class="flex gap-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="currentQuery.mode"
                        type="radio"
                        value="text"
                        class="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('news.modeText') || 'Text' }}</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="currentQuery.mode"
                        type="radio"
                        value="vector"
                        class="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('news.modeVector') || 'Vector' }}</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="currentQuery.mode"
                        type="radio"
                        value="hybrid"
                        class="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('news.modeHybrid') || 'Hybrid' }}</span>
                    </label>
                  </div>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('news.modeHelp') || 'Text: keyword matching, Vector: semantic similarity, Hybrid: combines both' }}
                  </p>
                </div>

                <!-- Filters Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                       {{ t('news.since') || 'Time Range' }}
                    </label>
                    <USelect
                      v-model="currentQuery.since"
                      :options="timeRangeOptions"
                      icon="i-heroicons-clock"
                      size="lg"
                    />
                  </div>
                  <div>
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

                <!-- Additional Filters Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {{ t('news.language') || 'Language' }}
                    </label>
                    <UInput
                      v-model="currentQuery.lang"
                      :placeholder="t('news.languagePlaceholder') || 'Language code (e.g., en, ru)'"
                      icon="i-heroicons-language"
                      size="lg"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {{ t('news.sourceTags') || 'Source Tags' }}
                    </label>
                    <UInput
                      v-model="currentQuery.sourceTags"
                      :placeholder="t('news.sourceTagsPlaceholder') || 'Comma-separated source tags'"
                      icon="i-heroicons-tag"
                      size="lg"
                    />
                  </div>
                </div>

                <!-- News Tags -->
                <div class="w-full">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ t('news.newsTags') || 'News Tags' }}
                  </label>
                  <UInput
                    v-model="currentQuery.newsTags"
                    :placeholder="t('news.newsTagsPlaceholder') || 'Comma-separated news tags'"
                    icon="i-heroicons-tag"
                    size="lg"
                  />
                </div>

                <!-- Notifications Toggle -->
                <div class="w-full flex items-center justify-between p-4 bg-primary-50/30 dark:bg-primary-950/20 rounded-xl border border-primary-100/50 dark:border-primary-900/30">
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                      <UIcon name="i-heroicons-bell" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('news.notifications') || 'Query Notifications' }}</h4>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('news.notificationsHelp') || 'Get notified when new news matches this query' }}</p>
                    </div>
                  </div>
                  <UCheckbox 
                    v-model="currentQuery.isNotificationEnabled" 
                    size="lg"
                    color="primary"
                  />
                </div>

                <!-- Search Actions Area -->
                <div class="flex justify-between items-center gap-4 pt-4">
                  <div class="flex items-center gap-2">
                    <UButton
                      size="lg"
                      :loading="isNewsLoading"
                      :disabled="!currentQuery.q.trim()"
                      icon="i-heroicons-magnifying-glass"
                      @click="handleSearch"
                    >
                      {{ t('common.search') }}
                    </UButton>
                    
                    <UTooltip :text="t('news.vectorSearchInfo')" :popper="{ placement: 'right' }">
                      <UButton
                        icon="i-heroicons-information-circle"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        class="opacity-50 hover:opacity-100"
                      />
                    </UTooltip>
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
              </div>
            </div>

            <!-- Results Section -->
            <div class="space-y-4">
              <!-- Loading state initial -->
              <div v-if="isNewsLoading && news.length === 0" class="flex flex-col items-center justify-center py-24 space-y-4">
                <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-primary-500 animate-spin" />
                <p class="text-gray-500 dark:text-gray-400 animate-pulse">{{ t('news.loading') }}</p>
              </div>

              <!-- News list -->
              <div v-else-if="news.length > 0" class="space-y-4">
                <NewsItem
                  v-for="item in news"
                  :key="item._id"
                  :item="item"
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
                    {{ t('common.loadMore') || 'Load More' }}
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
        </template>
      </UTabs>

      <!-- Add Tab Button (External) -->
      <UButton
        icon="i-heroicons-plus"
        color="neutral"
        variant="soft"
        class="mt-1"
        @click="isAddModalOpen = true"
      />
    </div>

    <!-- Initial state when project is loading -->
    <div v-else-if="isProjectLoading" class="flex justify-center py-24">
      <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-primary-500 animate-spin" />
    </div>

    <!-- Add Tab Modal -->
    <AppModal 
      v-model:open="isAddModalOpen"
      :title="t('news.addTab')"
    >
      <form @submit.prevent="addTab" class="space-y-4">
        <UFormField :label="t('news.tabName')">
          <UInput
            v-model="newTabName"
            :placeholder="t('news.tabNamePlaceholder')"
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
            :disabled="!newTabName.trim()"
          >
            {{ t('common.create') }}
          </UButton>
        </div>
      </form>
    </AppModal>

    <!-- Edit Tab Modal -->
    <AppModal 
      v-model:open="isEditModalOpen"
      :title="t('news.editTab')"
      :description="t('news.editTabDescription')"
    >
      <form @submit.prevent="saveTabName" class="space-y-4">
        <UFormField :label="t('news.tabName')">
          <UInput
            v-model="editingTabName"
            :placeholder="t('news.tabNamePlaceholder')"
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
            :disabled="!editingTabName.trim()"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </form>
    </AppModal>

    <!-- Delete Tab Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('common.confirmDelete')"
      :description="t('news.deleteTabConfirm')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeleting"
      @confirm="confirmDeleteTab"
    />

    <NewsCreatePublicationModal
      v-model:open="isCreateModalOpen"
      :url="selectedNewsUrl"
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
