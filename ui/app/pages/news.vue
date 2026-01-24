<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const { news, isLoading: isNewsLoading, error, searchNews } = useNews()
const { projects, fetchProjects, isLoading: isProjectsLoading } = useProjects()

const activeTabIndex = ref(0)

// Projects that have at least one default news query
const filteredProjects = computed(() => {
  return projects.value.filter(project => {
    const prefs = project.preferences as any
    return prefs?.newsQueries?.some((q: any) => q.isDefault)
  })
})

const tabs = computed(() => {
  return filteredProjects.value.map(project => ({
    label: project.name,
    slot: 'content'
  }))
})

const currentProject = computed(() => filteredProjects.value[activeTabIndex.value])

const currentDefaultQuery = computed(() => {
  if (!currentProject.value) return null
  const prefs = currentProject.value.preferences as any
  return prefs.newsQueries.find((q: any) => q.isDefault)
})

const isLoading = computed(() => isProjectsLoading.value || isNewsLoading.value)

async function handleSearch() {
  if (!currentDefaultQuery.value || !currentProject.value) return

  await searchNews({
    q: currentDefaultQuery.value.q,
    limit: currentDefaultQuery.value.limit,
    minScore: currentDefaultQuery.value.minScore,
    since: (currentDefaultQuery.value as any).since,
  }, currentProject.value.id)
}

watch(activeTabIndex, () => {
  handleSearch()
})

onMounted(async () => {
  await fetchProjects()
  if (filteredProjects.value.length > 0) {
    handleSearch()
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
      v-if="!isProjectsLoading && filteredProjects.length === 0"
      class="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
    >
      <UIcon name="i-heroicons-newspaper" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
      <p>{{ t('news.noConfiguredProjects') || 'No projects with default news queries found.' }}</p>
      <p class="text-sm mt-2">
        {{ t('news.howToConfigure') || 'Configure default news queries in project settings.' }}
      </p>
    </div>

    <!-- Tabs System -->
    <div v-else-if="filteredProjects.length > 0" class="space-y-6">
      <UTabs 
        v-model="activeTabIndex" 
        :items="tabs" 
        class="w-full"
      >
        <template #content>
          <div v-if="currentDefaultQuery" class="space-y-4">
            <!-- Query Information -->
            <div class="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-4 py-2 px-1">
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentDefaultQuery.q }}</span>
              </div>
              <div v-if="(currentDefaultQuery as any).since" class="flex items-center gap-1">
                <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                <span>Range: <span class="font-medium text-gray-700 dark:text-gray-300">{{ (currentDefaultQuery as any).since }}</span></span>
              </div>
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
                <span>Score: <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentDefaultQuery.minScore }}</span></span>
              </div>
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
                <span>Limit: <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentDefaultQuery.limit }}</span></span>
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
              <div
                v-for="item in news"
                :key="item._id"
                class="app-card p-6 hover:shadow-lg transition-shadow"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      <a
                        :href="item.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {{ item.title }}
                      </a>
                    </h3>
                    
                    <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {{ item.description }}
                    </p>

                    <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                        <span>{{ formatDate(item.date) }}</span>
                      </div>
                      
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-newspaper" class="w-4 h-4" />
                        <span>{{ item._source }}</span>
                      </div>

                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
                        <span>{{ formatScore(item._score) }}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <UButton
                      :to="item.url"
                      target="_blank"
                      variant="ghost"
                      size="sm"
                      icon="i-heroicons-arrow-top-right-on-square"
                      trailing
                    >
                      {{ t('common.view') }}
                    </UButton>
                  </div>
                </div>
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
        </template>
      </UTabs>
    </div>

    <!-- Initial loading for projects -->
    <div v-else-if="isProjectsLoading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  </div>
</template>

