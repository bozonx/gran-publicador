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
const { news, isLoading: isNewsLoading, error, searchNews, getDefaultQueries, hasMore } = useNews()

const activeTabIndex = ref(0)
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
    slot: 'content'
  }))
})

const currentTrackedQuery = computed(() => {
  return trackedQueries.value[activeTabIndex.value] || null
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

watch(activeTabIndex, () => {
  handleSearch()
})

onMounted(async () => {
  isInitialLoading.value = true
  try {
    trackedQueries.value = await getDefaultQueries()
    if (trackedQueries.value.length > 0) {
      // If projectId is provided in URL, try to find matching query
      const projectIdParam = route.query.projectId as string
      if (projectIdParam) {
        const matchingIndex = trackedQueries.value.findIndex(q => q.projectId === projectIdParam)
        if (matchingIndex !== -1) {
          activeTabIndex.value = matchingIndex
        }
      }
      
      // If we are at index 0, we need to manually trigger the first search
      // because the watcher only triggers on change.
      if (activeTabIndex.value === 0) {
        await handleSearch()
      }
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
        v-model="activeTabIndex" 
        :items="tabs" 
        class="w-full"
      />

      <div v-if="currentTrackedQuery" class="space-y-4">
        <!-- Query Information -->
        <div class="flex items-center justify-between gap-4 py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 shrink-0">
              <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              <span class="font-medium">{{ t('news.query') || 'Запрос' }}:</span>
            </div>
            <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ currentTrackedQuery.q }}</span>
            
            <div v-if="currentTrackedQuery.lang" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">
              {{ currentTrackedQuery.lang }}
            </div>
          </div>
          
          <div class="flex items-center gap-4 shrink-0">
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

