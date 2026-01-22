<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'
import type { NewsItem } from '~/composables/useNews'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { currentProject, fetchProject, isLoading: isProjectLoading } = useProjects()
const { news, isLoading: isNewsLoading, error, searchNews } = useNews()

const searchQuery = ref('')
const limit = ref(20)
const minScore = ref(0.5)

// Fetch project and initial news on mount
onMounted(async () => {
  if (projectId.value) {
    if (!currentProject.value || currentProject.value.id !== projectId.value) {
      await fetchProject(projectId.value)
    }
    
    // Default search by project name
    if (currentProject.value) {
      searchQuery.value = currentProject.value.name
      handleSearch()
    }
  }
})

// Perform search
async function handleSearch() {
  if (!searchQuery.value.trim()) {
    return
  }

  await searchNews({
    q: searchQuery.value,
    limit: limit.value,
    minScore: minScore.value,
  })
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
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <NuxtLink :to="`/projects/${projectId}`" class="hover:text-primary-500">
          {{ currentProject?.name || t('project.title') }}
        </NuxtLink>
        <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        <span>{{ t('news.title') }}</span>
      </div>
      
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('news.title') }}: {{ currentProject?.name }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('news.description') }}
      </p>
    </div>

    <!-- Search form -->
    <div class="app-card p-6 mb-6">
      <form @submit.prevent="handleSearch" class="space-y-4">
        <div>
          <label for="search-query" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.search') }}
          </label>
          <div class="flex gap-2">
            <UInput
              id="search-query"
              v-model="searchQuery"
              :placeholder="t('news.searchPlaceholder')"
              size="lg"
              class="flex-1"
              icon="i-heroicons-magnifying-glass"
            />
            <UButton
              type="submit"
              size="lg"
              :loading="isNewsLoading"
              :disabled="!searchQuery.trim()"
            >
              {{ t('common.search') }}
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="limit" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Limit
            </label>
            <UInput
              id="limit"
              v-model.number="limit"
              type="number"
              min="1"
              max="100"
            />
          </div>
          <div>
            <label for="min-score" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Score
            </label>
            <UInput
              id="min-score"
              v-model.number="minScore"
              type="number"
              min="0"
              max="1"
              step="0.1"
            />
          </div>
        </div>
      </form>
    </div>

    <!-- Error message -->
    <div v-if="error" class="app-card p-6 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isNewsLoading || isProjectLoading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
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
      v-else-if="!isNewsLoading && searchQuery"
      class="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
    >
      <UIcon name="i-heroicons-newspaper" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
      <p>{{ t('news.noResults') }}</p>
    </div>
  </div>
</template>
