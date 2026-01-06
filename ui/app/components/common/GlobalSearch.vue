<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const isOpen = ref(false)
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)
const isSearching = ref(false)

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
    const projectsResponse = await api.get<any>('/projects', {
      params: { limit: 5 }
    })
    const projects = projectsResponse?.data || []
    projects
      .filter((p: any) => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3)
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
      params: { limit: 5 }
    })
    const channels = channelsResponse?.data?.items || []
    channels
      .filter((c: any) => 
        c.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3)
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
      params: { limit: 5 }
    })
    const publications = publicationsResponse?.data?.items || []
    publications
      .filter((p: any) => 
        p.title?.toLowerCase().includes(query.toLowerCase()) ||
        p.content?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3)
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
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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
    if (groups[result.type]) {
      groups[result.type].push(result)
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
      icon="i-heroicons-magnifying-glass"
      class="hidden sm:flex"
      @click="isOpen = true"
    >
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.search') }}</span>
      <UKbd class="ml-auto">⌘K</UKbd>
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
    <UModal v-model:open="isOpen">
      <template #content>
        <div class="p-4">
          <!-- Search input -->
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            :placeholder="t('common.search')"
            size="lg"
            autofocus
            :loading="isSearching"
          />

          <!-- Search results -->
          <div v-if="searchQuery.length >= 2" class="mt-4 max-h-96 overflow-y-auto">
            <!-- No results -->
            <div v-if="searchResults.length === 0 && !isSearching" class="text-center py-8">
              <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p class="text-gray-500 dark:text-gray-400">{{ t('common.noData') }}</p>
            </div>

            <!-- Loading -->
            <div v-if="isSearching" class="text-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin" />
            </div>

            <!-- Results grouped by type -->
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
          </div>

          <!-- Helper text -->
          <div v-if="searchQuery.length < 2" class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('common.search') }}...
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
