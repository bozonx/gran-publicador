<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'
import AppModal from '~/components/ui/AppModal.vue'
import AppTabs from '~/components/ui/AppTabs.vue'
import NewsCreatePublicationModal from '~/components/news/CreatePublicationModal.vue'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { t, d } = useI18n()
const { user } = useAuth()
const { news, isLoading: isNewsLoading, error, searchNews, getDefaultQueries, hasMore, updateNewsQueryOrder } = useNews()

const activeTabId = ref<string | number>(0)
const isCreateModalOpen = ref(false)
const selectedNewsUrl = ref('')
const selectedNewsItem = ref<any | null>(null)
const trackedQueries = ref<any[]>([])
const isInitialLoading = ref(true)
const isLoadMoreLoading = ref(false)

function handleCreatePublication(item: any) {
  selectedNewsUrl.value = item.url
  selectedNewsItem.value = item
  isCreateModalOpen.value = true
}

const tabs = computed(() => {
  return trackedQueries.value.map(q => ({
    label: `${q.projectName} - ${q.name}`,
    slot: 'content',
    id: q.id
  }))
})

const currentTrackedQuery = computed(() => {
  if (trackedQueries.value.length === 0) return null
  if (typeof activeTabId.value === 'number') {
    // If it's a number, treat as index (fallback)
    return trackedQueries.value[activeTabId.value] || trackedQueries.value[0]
  }
  return trackedQueries.value.find(q => q.id === activeTabId.value) || null
})

const isLoading = computed(() => isInitialLoading.value || isNewsLoading.value)

async function handleSearch() {
  if (!currentTrackedQuery.value) return
  const query = currentTrackedQuery.value
  
  // Sanitize mode: map 'all' to 'hybrid', ensures it's one of the allowed values
  const validModes = ['text', 'vector', 'hybrid']
  let mode = query.mode
  if (mode === 'all' || !validModes.includes(mode)) {
    mode = 'hybrid'
  }

  // Sanitize sourceTags: ensure it's a string
  const sourceTags = Array.isArray(query.sourceTags) 
    ? query.sourceTags.join(',') 
    : query.sourceTags

  await searchNews({
    q: query.q,
    mode: mode,
    savedFrom: query.savedFrom || query.since, // Fallback
    savedTo: query.savedTo,
    lang: query.lang,
    sourceTags: sourceTags,
    orderBy: query.orderBy
  }, query.projectId)
}

async function loadMore() {
  if (isLoadMoreLoading.value || !hasMore.value || !currentTrackedQuery.value) return
  
  const query = currentTrackedQuery.value
  
  // Sanitize params for load more too
  const validModes = ['text', 'vector', 'hybrid']
  let mode = query.mode
  if (mode === 'all' || !validModes.includes(mode)) {
    mode = 'hybrid'
  }

  const sourceTags = Array.isArray(query.sourceTags) 
    ? query.sourceTags.join(',') 
    : query.sourceTags

  isLoadMoreLoading.value = true
  try {
    await searchNews({
      q: query.q,
      mode: mode,
      savedFrom: query.savedFrom || query.since,
      savedTo: query.savedTo,
      lang: query.lang,
      sourceTags: sourceTags
    }, query.projectId, true)
  } finally {
    isLoadMoreLoading.value = false
  }
}

watch(activeTabId, () => {
  handleSearch()
})

async function handleTabsUpdate(newItems: any[]) {
  // newItems contains the tabs in new order
  const newOrder = newItems.map(t => t.id)
  
  // Reorder trackedQueries to match newOrder
  const newQueries: any[] = []
  for (const id of newOrder) {
    const q = trackedQueries.value.find(x => x.id === id)
    if (q) newQueries.push(q)
  }
  // Add any missing ones (safety)
  trackedQueries.value.forEach(q => {
    if (!newOrder.includes(q.id)) newQueries.push(q)
  })
  
  trackedQueries.value = newQueries
  
  // Persist order
  await updateNewsQueryOrder(newOrder)
}

onMounted(async () => {
  isInitialLoading.value = true
  try {
    const queries = await getDefaultQueries()
    
    // Sort based on user preference
    if (user.value?.newsQueryOrder && Array.isArray(user.value.newsQueryOrder)) {
       const order = user.value.newsQueryOrder
       queries.sort((a, b) => {
          const indexA = order.indexOf(a.id)
          const indexB = order.indexOf(b.id)
          
          if (indexA === -1 && indexB === -1) return 0
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          
          return indexA - indexB
       })
    }
    
    trackedQueries.value = queries

    if (trackedQueries.value.length > 0) {
      // If projectId is provided in URL, try to find matching query
      const projectIdParam = route.query.projectId as string
      let found = false
      
      if (projectIdParam) {
        const matching = trackedQueries.value.find(q => q.projectId === projectIdParam)
        if (matching) {
          activeTabId.value = matching.id
          found = true
        }
      }
      
      // Default to first if not found
      if (!found) {
        activeTabId.value = trackedQueries.value[0].id
      }
      
      // Trigger search immediately
      await handleSearch()
    }
  } finally {
    isInitialLoading.value = false
  }
})

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
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('news.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('news.description') }}
      </p>
    </div>

    <!-- No projects with news queries state -->
    <div
      v-if="!isLoading && trackedQueries.length === 0"
      class="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
    >
      <UIcon name="i-heroicons-newspaper" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
      <p>{{ t('news.noConfiguredProjects') || 'No tracked news queries found.' }}</p>
      <p class="text-sm mt-2">
        {{ t('news.howToConfigure') || 'Enable notifications for news queries in project settings.' }}
      </p>
    </div>

    <!-- Tabs System -->
    <div v-if="trackedQueries.length > 0" class="space-y-6">
      <AppTabs 
        v-model="activeTabId" 
        :items="tabs" 
        :draggable="true"
        class="w-full"
        @update:items="handleTabsUpdate"
      />

      <div v-if="currentTrackedQuery" class="space-y-4">
        <!-- Query Information -->
        <div class="flex items-center justify-between gap-4 py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 shrink-0">
              <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />

            </div>
            <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ currentTrackedQuery.q }}</span>
            

          </div>
          
          <div class="flex items-center gap-4 shrink-0">
             <div v-if="currentTrackedQuery.lang" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">
              {{ currentTrackedQuery.lang }}
            </div>
             <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
              <span>Score: <span class="font-bold text-gray-900 dark:text-gray-100">{{ currentTrackedQuery.minScore }}</span></span>
            </div>

            <UButton
              :to="`/projects/${currentTrackedQuery.projectId}/news?id=${currentTrackedQuery.id}`"
              icon="i-heroicons-cog-6-tooth"
              size="xs"
              color="neutral"
              variant="soft"
              class="rounded-lg"
            >
              {{ t('common.configure') || 'Настроить' }}
            </UButton>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="error" class="app-card p-6 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
            <span>{{ error }}</span>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="isNewsLoading" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary-500 animate-spin" />
        </div>

        <!-- News list -->
          <div v-else-if="news.length > 0" class="space-y-4">
            <NewsItem
              v-for="item in news"
              :key="item.id"
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
          v-else
          class="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
        >
          <UIcon name="i-heroicons-newspaper" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>{{ t('news.noResults') }}</p>
        </div>
      </div>
    </div>

    <!-- Initial loading for projects -->
    <div v-else-if="isLoading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <NewsCreatePublicationModal
      v-model:open="isCreateModalOpen"
      v-model:url="selectedNewsUrl"
      :source-news-item="selectedNewsItem || undefined"
      :project-id="currentTrackedQuery?.projectId || ''"
    />
  </div>
</template>
