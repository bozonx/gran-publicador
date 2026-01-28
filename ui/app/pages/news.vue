<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'
import AppModal from '~/components/ui/AppModal.vue'
import NewsCreatePublicationModal from '~/components/news/CreatePublicationModal.vue'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const { news, isLoading: isNewsLoading, error, searchNews, getDefaultQueries } = useNews()

const activeTabIndex = ref(0)
const isCreateModalOpen = ref(false)
const selectedNewsUrl = ref('')
const defaultQueries = ref<any[]>([])
const isInitialLoading = ref(true)

function handleCreatePublication(item: any) {
  selectedNewsUrl.value = item.url
  isCreateModalOpen.value = true
}

const tabs = computed(() => {
  return defaultQueries.value.map(q => ({
    label: q.projectName || q.name,
    slot: 'content'
  }))
})

const currentDefaultQuery = computed(() => {
  return defaultQueries.value[activeTabIndex.value] || null
})

const isLoading = computed(() => isInitialLoading.value || isNewsLoading.value)

async function handleSearch() {
  if (!currentDefaultQuery.value) return

  await searchNews({
    q: currentDefaultQuery.value.q,
    mode: currentDefaultQuery.value.mode,
    since: currentDefaultQuery.value.since,
    lang: currentDefaultQuery.value.lang,
    sourceTags: currentDefaultQuery.value.sourceTags,
    newsTags: currentDefaultQuery.value.newsTags,
    minScore: currentDefaultQuery.value.minScore,
  }, currentDefaultQuery.value.projectId)
}

watch(activeTabIndex, () => {
  handleSearch()
})

onMounted(async () => {
  isInitialLoading.value = true
  try {
    defaultQueries.value = await getDefaultQueries()
    if (defaultQueries.value.length > 0) {
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
      v-if="!isLoading && defaultQueries.length === 0"
      class="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
    >
      <UIcon name="i-heroicons-newspaper" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
      <p>{{ t('news.noConfiguredProjects') || 'No projects with default news queries found.' }}</p>
      <p class="text-sm mt-2">
        {{ t('news.howToConfigure') || 'Configure default news queries in project settings.' }}
      </p>
    </div>

    <!-- Tabs System -->
    <div v-else-if="defaultQueries.length > 0" class="space-y-6">
      <UTabs 
        v-model="activeTabIndex" 
        :items="tabs" 
        class="w-full"
      >
        <template #content>
          <div v-if="currentDefaultQuery" class="space-y-4">
            <!-- Query Information -->
            <div class="flex items-start justify-between gap-4 py-2 px-1 text-sm text-gray-500 dark:text-gray-400">
              <div class="flex items-start gap-2 flex-1 min-w-0">
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 mt-0.5 shrink-0" />
                <span class="font-medium text-gray-700 dark:text-gray-300 break-all overflow-hidden">{{ currentDefaultQuery.q }}</span>
                
                <div v-if="(currentDefaultQuery as any).since" class="flex items-center gap-1 ml-2 shrink-0">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  <span>{{ (currentDefaultQuery as any).since }}</span>
                </div>
              </div>
              
              <div class="flex items-center gap-1 shrink-0">
                <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
                <span>Score: <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentDefaultQuery.minScore }}</span></span>
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
                :key="item._id"
                :item="item"
                @create-publication="handleCreatePublication"
              />
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
        </template>
      </UTabs>
    </div>

    <!-- Initial loading for projects -->
    <div v-else-if="isLoading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <NewsCreatePublicationModal
      v-model:open="isCreateModalOpen"
      :url="selectedNewsUrl"
      :project-id="currentDefaultQuery?.projectId || ''"
    />
  </div>
</template>

