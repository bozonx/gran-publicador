<script setup lang="ts">
import { useNews } from '~/composables/useNews'
import { useProjects } from '~/composables/useProjects'
import type { NewsItem } from '~/composables/useNews'
import AppModal from '~/components/ui/AppModal.vue'

interface NewsQuery {
  id: string
  name: string
  q: string
  limit: number
  minScore: number
  note: string
  isDefault: boolean
}

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { currentProject, fetchProject, updateProject, isLoading: isProjectLoading } = useProjects()
const { news, isLoading: isNewsLoading, error, searchNews } = useNews()

const newsQueries = ref<NewsQuery[]>([])
const activeTabIndex = ref(0)
const isAddModalOpen = ref(false)
const newTabName = ref('')
const isSaving = ref(false)

const currentQuery = computed(() => newsQueries.value[activeTabIndex.value] || null)

// Tabs for UTabs component
const tabs = computed(() => newsQueries.value.map((q, index) => ({
  label: q.name,
  icon: q.isDefault ? 'i-heroicons-star-20-solid' : undefined,
  slot: 'content'
})))

// Initialize news queries from project preferences
async function initQueries() {
  if (projectId.value) {
    if (!currentProject.value || currentProject.value.id !== projectId.value) {
      await fetchProject(projectId.value)
    }
    
    const prefs = currentProject.value?.preferences as any
    if (prefs?.newsQueries?.length > 0) {
      newsQueries.value = JSON.parse(JSON.stringify(prefs.newsQueries))
      
      // Select default tab or first tab
      const defaultIndex = newsQueries.value.findIndex(q => q.isDefault)
      activeTabIndex.value = defaultIndex !== -1 ? defaultIndex : 0
    } else {
      // Create initial default query
      const defaultQuery: NewsQuery = {
        id: crypto.randomUUID(),
        name: t('news.title'),
        q: currentProject.value?.name || '',
        limit: 20,
        minScore: 0.5,
        note: '',
        isDefault: true
      }
      newsQueries.value = [defaultQuery]
      activeTabIndex.value = 0
    }
    
    // Initial search
    if (currentQuery.value?.q) {
      handleSearch()
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
    limit: currentQuery.value.limit,
    minScore: currentQuery.value.minScore,
  })
}

// Watch tab changes to refresh news
watch(activeTabIndex, () => {
  handleSearch()
})

// Add new search tab
async function addTab() {
  if (!newTabName.value.trim()) return
  
  const newQuery: NewsQuery = {
    id: crypto.randomUUID(),
    name: newTabName.value,
    q: '',
    limit: 20,
    minScore: 0.5,
    note: '',
    isDefault: false
  }
  
  newsQueries.value.push(newQuery)
  activeTabIndex.value = newsQueries.value.length - 1
  newTabName.value = ''
  isAddModalOpen.value = false
  
  await saveQueries()
}

// Delete current tab
async function deleteTab(index: number) {
  if (newsQueries.value.length <= 1) return
  
  if (confirm(t('news.deleteTabConfirm'))) {
    newsQueries.value.splice(index, 1)
    if (activeTabIndex.value >= newsQueries.value.length) {
      activeTabIndex.value = newsQueries.value.length - 1
    }
    await saveQueries()
  }
}

// Handle default flag change (only one default allowed)
async function handleDefaultChange(index: number) {
  if (newsQueries.value[index].isDefault) {
    newsQueries.value.forEach((q, i) => {
      if (i !== index) q.isDefault = false
    })
    await saveQueries()
  }
}

// Save all queries to project preferences
async function saveQueries() {
  if (!currentProject.value) return
  
  isSaving.value = true
  try {
    const updatedPrefs = {
      ...(currentProject.value.preferences as any),
      newsQueries: newsQueries.value
    }
    
    await updateProject(currentProject.value.id, {
      preferences: updatedPrefs
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
          icon="i-heroicons-plus"
          color="gray"
          variant="ghost"
          @click="isAddModalOpen = true"
        >
          {{ t('news.addTab') }}
        </UButton>
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
    <div v-if="newsQueries.length > 0" class="space-y-6">
      <UTabs 
        v-model="activeTabIndex" 
        :items="tabs" 
        class="w-full"
        :ui="{ wrapper: 'space-y-6', list: { height: 'h-10', padding: 'p-1' } }"
      >
        <template #default="{ item, index, selected }">
          <div class="flex items-center gap-2">
            <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 text-primary-500" />
            <span>{{ item.label }}</span>
            <UButton
              v-if="selected && newsQueries.length > 1"
              icon="i-heroicons-x-mark"
              size="xs"
              color="gray"
              variant="ghost"
              class="-mr-1"
              @click.stop="deleteTab(index)"
            />
          </div>
        </template>

        <template #content>
          <div v-if="currentQuery" class="space-y-6">
            <!-- Search settings card -->
            <div class="news-config-card overflow-hidden">
              <div class="p-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-primary-500" />
                  <h2 class="font-semibold text-gray-900 dark:text-white">
                    {{ t('news.tabName') }}: {{ currentQuery.name }}
                  </h2>
                </div>
                
                <UCheckbox
                  v-model="currentQuery.isDefault"
                  :label="t('news.defaultQuery')"
                  @change="handleDefaultChange(activeTabIndex)"
                />
              </div>

              <div class="p-6 space-y-6">
                <!-- Search row -->
                <form @submit.prevent="handleSearch" class="flex gap-2">
                  <UInput
                    v-model="currentQuery.q"
                    :placeholder="t('news.searchPlaceholder')"
                    size="lg"
                    class="flex-1"
                    icon="i-heroicons-magnifying-glass"
                  />
                  <UButton
                    type="submit"
                    size="lg"
                    :loading="isNewsLoading"
                    :disabled="!currentQuery.q.trim()"
                  >
                    {{ t('common.search') }}
                  </UButton>
                </form>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Limit
                    </label>
                    <UInput
                      v-model.number="currentQuery.limit"
                      type="number"
                      min="1"
                      max="100"
                      icon="i-heroicons-list-bullet"
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
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {{ t('news.tabName') }}
                    </label>
                    <UInput
                      v-model="currentQuery.name"
                      icon="i-heroicons-pencil-square"
                      size="lg"
                    />
                  </div>
                </div>

                <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ t('news.note') }}
                  </label>
                  <UTextarea
                    v-model="currentQuery.note"
                    :placeholder="t('news.notePlaceholder')"
                    :rows="5"
                    size="lg"
                    autoresize
                  />
                </div>
              </div>
            </div>

            <!-- Results Section -->
            <div class="space-y-4">
              <!-- Error message -->
              <div v-if="error" class="news-config-card p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
                  <span>{{ error }}</span>
                </div>
              </div>

              <!-- Loading state -->
              <div v-if="isNewsLoading" class="flex flex-col items-center justify-center py-24 space-y-4">
                <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-primary-500 animate-spin" />
                <p class="text-gray-500 dark:text-gray-400 animate-pulse">{{ t('news.loading') }}</p>
              </div>

              <!-- News list -->
              <div v-else-if="news.length > 0" class="grid grid-cols-1 gap-4">
                  <div
                    v-for="item in news"
                    :key="item._id"
                    class="news-config-card p-6 group hover:ring-2 hover:ring-primary-500/50 transition-all duration-300 transform hover:-translate-y-1"
                  >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-2">
                        <UBadge variant="soft" color="primary" size="xs">
                          {{ item._source }}
                        </UBadge>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {{ formatDate(item.date) }}
                        </span>
                      </div>
                      
                      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                        <a
                          :href="item.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          {{ item.title }}
                        </a>
                      </h3>
                      
                      <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {{ item.description }}
                      </p>

                      <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          <UIcon name="i-heroicons-chart-bar" class="w-4 h-4 text-green-500" />
                          <span>{{ formatScore(item._score) }} {{ t('news.score') }}</span>
                        </div>
                      </div>
                    </div>

                    <UButton
                      :to="item.url"
                      target="_blank"
                      variant="ghost"
                      color="gray"
                      size="sm"
                      icon="i-heroicons-arrow-top-right-on-square"
                      class="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
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
        <UFormGroup :label="t('news.tabName')">
          <UInput
            v-model="newTabName"
            :placeholder="t('news.tabNamePlaceholder')"
            autofocus
            size="lg"
          />
        </UFormGroup>
        
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
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.news-config-card {
  @apply bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-200;
}
</style>
