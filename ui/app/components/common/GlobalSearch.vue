<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const isOpen = ref(false)
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)
const isSearching = ref(false)
const hasPerformedSearch = ref(false)

interface SearchResult {
  type: 'project' | 'channel' | 'publication'
  id: string
  title: string
  subtitle?: string
  link: string
  icon: string
}

const searchResults = ref<SearchResult[]>([])

// Watch for search query changes
watch(debouncedSearch, async (query) => {
  if (!query || query.length < 2) {
    searchResults.value = []
    hasPerformedSearch.value = false
    return
  }

  isSearching.value = true
  try {
    await performSearch(query)
  } finally {
    isSearching.value = false
  }
})

async function performSearch(query: string) {
  const api = useApi()
  const results: SearchResult[] = []

  try {
    // Search projects
    const projectsResponse = await api.get<any[]>('/projects', {
      query: { 
        search: query,
        limit: 20
      }
    })
    const projects = projectsResponse || []
    projects
      .slice(0, 10)
      .forEach((p: any) => {
        results.push({
          type: 'project',
          id: p.id,
          title: p.name,
          subtitle: p.description,
          link: `/projects/${p.id}`,
          icon: 'i-heroicons-briefcase'
        })
      })

    // Search channels
    const channelsResponse = await api.get<any>('/channels', {
      query: { 
        search: query,
        limit: 20 
      }
    })
    const channels = channelsResponse?.items || []
    channels
      .slice(0, 10)
      .forEach((c: any) => {
        results.push({
          type: 'channel',
          id: c.id,
          title: c.name,
          subtitle: c.project?.name,
          link: `/projects/${c.projectId}/channels/${c.id}`,
          icon: 'i-heroicons-hashtag'
        })
      })

    // Search publications
    const publicationsResponse = await api.get<any>('/publications', {
      query: { 
        search: query,
        limit: 20 
      }
    })
    const publications = publicationsResponse?.items || []
    publications
      .slice(0, 10)
      .forEach((p: any) => {
        results.push({
          type: 'publication',
          id: p.id,
          title: p.title || t('post.untitled'),
          subtitle: p.project?.name,
          link: `/projects/${p.projectId}/publications/${p.id}`,
          icon: 'i-heroicons-document-text'
        })
      })

    searchResults.value = results
    hasPerformedSearch.value = true
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
    hasPerformedSearch.value = true
  }
}

function selectResult(result: SearchResult) {
  router.push(result.link)
  closeSearch()
}

function closeSearch() {
  isOpen.value = false
  searchQuery.value = ''
  searchResults.value = []
}

// Keyboard shortcut: Cmd+K or Ctrl+K
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.code === 'KeyK')) {
      e.preventDefault()
      isOpen.value = !isOpen.value
    }
    if (e.key === 'Escape' && isOpen.value) {
      closeSearch()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})

const groupedResults = computed(() => {
  const groups: Record<string, SearchResult[]> = {
    project: [],
    channel: [],
    publication: []
  }
  
  searchResults.value.forEach(result => {
    const group = groups[result.type] // Fix for lint error
    if (group) {
      group.push(result)
    }
  })
  
  return groups
})
</script>

<template>
  <div>
    <!-- Search trigger button -->
    <UButton
      variant="outline"
      color="neutral"
      class="hidden sm:flex w-full items-center justify-between"
      @click="isOpen = true"
    >
      <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
        <span class="text-sm">{{ t('common.search') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UKbd>Ctrl</UKbd>
        <UKbd>K</UKbd>
      </div>
    </UButton>

    <!-- Mobile search icon -->
    <UButton
      variant="ghost"
      color="neutral"
      icon="i-heroicons-magnifying-glass"
      class="sm:hidden"
      @click="isOpen = true"
    />

    <!-- Search modal -->
    <UModal
      v-model:open="isOpen"
      :ui="{
        wrapper: 'flex !items-start justify-center min-h-full pt-4 px-4 sm:pt-[12px]',
        content: 'w-full sm:max-w-2xl gap-0',
        body: 'p-0',
        overlay: 'bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm'
      }"
    >
      <template #content>
        <div class="p-4">
          <!-- Search input -->
          <UInput
            v-model="searchQuery"
            :placeholder="t('common.search')"
            size="xl"
            autofocus
            class="w-full"
          >
            <template #leading>
              <UIcon 
                :name="isSearching ? 'i-heroicons-arrow-path' : 'i-heroicons-magnifying-glass'" 
                class="w-5 h-5 text-gray-400"
                :class="{ 'animate-spin': isSearching }"
              />
            </template>
            <template #trailing>
              <UButton
                v-if="searchQuery"
                color="neutral"
                variant="link"
                icon="i-heroicons-x-mark"
                :padded="false"
                @click="searchQuery = ''"
              />
            </template>
          </UInput>

          <!-- Search results area -->
          <div class="mt-4 max-h-96 overflow-y-auto min-h-[100px]">
            
            <!-- Case 1: Has Results (Always show if available, even if reloading) -->
            <div v-if="searchResults.length > 0" class="space-y-4">
              <!-- Projects -->
              <div v-if="groupedResults.project && groupedResults.project.length > 0">
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {{ t('project.titlePlural') }}
                </h3>
                <div class="space-y-1">
                  <button
                    v-for="result in groupedResults.project"
                    :key="result.id"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                    @click="selectResult(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Channels -->
              <div v-if="groupedResults.channel && groupedResults.channel.length > 0">
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {{ t('channel.titlePlural') }}
                </h3>
                <div class="space-y-1">
                  <button
                    v-for="result in groupedResults.channel"
                    :key="result.id"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                    @click="selectResult(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Publications -->
              <div v-if="groupedResults.publication && groupedResults.publication.length > 0">
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {{ t('publication.titlePlural') }}
                </h3>
                <div class="space-y-1">
                  <button
                    v-for="result in groupedResults.publication"
                    :key="result.id"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                    @click="selectResult(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <!-- Case 2: No Results Found (Show only if search was performed and list is empty) -->
            <div v-else-if="hasPerformedSearch" class="text-center py-8">
              <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p class="text-gray-500 dark:text-gray-400">{{ t('common.noData') }}</p>
            </div>

            <!-- Case 3: Initial State / Helper (Before any search) -->
            <div v-else class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              {{ t('common.search') }}...
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
