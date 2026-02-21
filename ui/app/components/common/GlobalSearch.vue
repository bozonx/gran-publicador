<script setup lang="ts">
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import { DEFAULT_PAGE_SIZE } from '~/constants'

const { t } = useI18n()
const router = useRouter()
const isOpen = ref(false)
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)
const isSearching = ref(false)
const hasPerformedSearch = ref(false)
const hasMoreProjects = ref(false)
const hasMoreChannels = ref(false)
const hasMorePublications = ref(false)
const abortController = ref<AbortController | null>(null)
const selectedIndex = ref(-1)

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
    hasMoreProjects.value = false
    hasMoreChannels.value = false
    hasMorePublications.value = false
    selectedIndex.value = -1
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
  if (abortController.value) {
    abortController.value.abort()
  }
  abortController.value = new AbortController()
  const signal = abortController.value.signal

  const api = useApi()
  const results: SearchResult[] = []

  try {
    const [projectsResponse, channelsResponse, publicationsResponse] = await Promise.all([
      api.get<any[]>('/projects', {
        query: { search: query, limit: 6 },
        signal
      }).catch(() => []),
      api.get<any>('/channels', {
        query: { search: query, limit: 5 },
        signal
      }).catch(() => null),
      api.get<any>('/publications', {
        query: { search: query, limit: 5 },
        signal
      }).catch(() => null)
    ])

    if (signal.aborted) return

    // Search projects
    const projects = projectsResponse || []
    hasMoreProjects.value = projects.length > 5
    projects
      .slice(0, 5)
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
    const channels = channelsResponse?.items || []
    hasMoreChannels.value = (channelsResponse?.total || channels.length) > 5
    channels
      .slice(0, 5)
      .forEach((c: any) => {
        results.push({
          type: 'channel',
          id: c.id,
          title: c.name,
          subtitle: c.project?.name,
          link: `/channels/${c.id}`,
          icon: 'i-heroicons-hashtag'
        })
      })

    // Search publications
    const publications = publicationsResponse?.items || []
    hasMorePublications.value = (publicationsResponse?.total || publications.length) > 5
    publications
      .slice(0, 5)
      .forEach((p: any) => {
        results.push({
          type: 'publication',
          id: p.id,
          title: p.title || t('post.untitled'),
          subtitle: p.project?.name,
          link: `/publications/${p.id}`,
          icon: 'i-heroicons-document-text'
        })
      })

    searchResults.value = results
    hasPerformedSearch.value = true
    selectedIndex.value = -1
  } catch (error: any) {
    if (error.name === 'AbortError') return
    console.error('Search error:', error)
    searchResults.value = []
    hasPerformedSearch.value = true
    selectedIndex.value = -1
  }
}

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

interface ViewAllItem {
  type: 'view-all'
  category: 'project' | 'channel' | 'publication'
  link: string
  label: string
}

type NavigableItem = SearchResult | ViewAllItem

const navigableItems = computed<NavigableItem[]>(() => {
  const items: NavigableItem[] = []
  
  if (groupedResults.value.project?.length) {
    items.push(...groupedResults.value.project)
    if (hasMoreProjects.value) {
      items.push({ type: 'view-all', category: 'project', link: '/projects', label: t('common.viewAll') })
    }
  }
  
  if (groupedResults.value.channel?.length) {
    items.push(...groupedResults.value.channel)
    if (hasMoreChannels.value) {
      items.push({ type: 'view-all', category: 'channel', link: `/channels?search=${encodeURIComponent(searchQuery.value)}`, label: t('common.viewAll') })
    }
  }
  
  if (groupedResults.value.publication?.length) {
    items.push(...groupedResults.value.publication)
    if (hasMorePublications.value) {
      items.push({ type: 'view-all', category: 'publication', link: `/publications?search=${encodeURIComponent(searchQuery.value)}`, label: t('common.viewAll') })
    }
  }
  
  return items
})

function selectResult(result: SearchResult) {
  router.push(result.link)
  closeSearch()
}

function isViewAll(item: NavigableItem | undefined, category: string): boolean {
  return item?.type === 'view-all' && (item as ViewAllItem).category === category
}

function selectNavigableItem(item: NavigableItem) {
  router.push(item.link)
  closeSearch()
}

function closeSearch() {
  isOpen.value = false
  searchQuery.value = ''
  searchResults.value = []
  hasMoreProjects.value = false
  hasMoreChannels.value = false
  hasMorePublications.value = false
  selectedIndex.value = -1
}

const props = withDefaults(defineProps<{
  disableShortcut?: boolean
  variant?: 'auto' | 'full' | 'icon'
}>(), {
  variant: 'auto'
})

// Keyboard shortcut: Cmd+K or Ctrl+K
onMounted(() => {
  if (props.disableShortcut) return

  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.code === 'KeyK')) {
      e.preventDefault()
      isOpen.value = !isOpen.value
    } else if (e.key === 'Escape' && isOpen.value) {
      closeSearch()
    } else if (e.key === 'ArrowDown' && isOpen.value) {
      e.preventDefault()
      if (navigableItems.value.length > 0) {
        selectedIndex.value = (selectedIndex.value + 1) % navigableItems.value.length
      }
    } else if (e.key === 'ArrowUp' && isOpen.value) {
      e.preventDefault()
      if (navigableItems.value.length > 0) {
        selectedIndex.value = selectedIndex.value <= 0 ? navigableItems.value.length - 1 : selectedIndex.value - 1
      }
    } else if (e.key === 'Enter' && isOpen.value) {
      if (selectedIndex.value >= 0 && selectedIndex.value < navigableItems.value.length) {
        e.preventDefault()
        const item = navigableItems.value[selectedIndex.value]
        if (item) {
          selectNavigableItem(item)
        }
      }
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})

// Removed groupedResults from here as it was moved up
</script>

<template>
  <div>
    <!-- Search trigger button -->
    <UButton
      v-if="variant === 'full' || variant === 'auto'"
      variant="outline"
      color="neutral"
      class="w-full items-center justify-between"
      :class="variant === 'auto' ? 'hidden sm:flex' : 'flex'"
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
      v-if="variant === 'icon' || variant === 'auto'"
      variant="ghost"
      color="neutral"
      icon="i-heroicons-magnifying-glass"
      :class="variant === 'auto' ? 'sm:hidden' : ''"
      @click="isOpen = true"
    />

    <!-- Search modal -->
    <UModal
      v-model:open="isOpen"
      scrollable
      :ui="{
        overlay: 'bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm !items-start !justify-items-center pt-20',
        content: 'w-full sm:max-w-2xl gap-0'
      }"
    >
      <template #content>
        <div class="p-4">
          <!-- Search input -->
          <CommonSearchInput
            v-model="searchQuery"
            :placeholder="t('common.search')"
            size="xl"
            autofocus
            :loading="isSearching || (searchQuery.length >= 2 && searchQuery !== debouncedSearch)"
            class="w-full"
          />

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
                    :class="{ 'bg-gray-100 dark:bg-gray-800': navigableItems[selectedIndex] === result }"
                    @click="selectNavigableItem(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                  <button
                    v-if="hasMoreProjects"
                    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-500 font-medium text-sm transition-colors mt-1"
                    :class="{ 'bg-gray-100 dark:bg-gray-800': isViewAll(navigableItems[selectedIndex], 'project') }"
                    @click="selectNavigableItem({ type: 'view-all', category: 'project', link: '/projects', label: t('common.viewAll') })"
                  >
                    {{ t('common.viewAll') }}
                    <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
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
                    :class="{ 'bg-gray-100 dark:bg-gray-800': navigableItems[selectedIndex] === result }"
                    @click="selectNavigableItem(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                  <button
                    v-if="hasMoreChannels"
                    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-500 font-medium text-sm transition-colors mt-1"
                    :class="{ 'bg-gray-100 dark:bg-gray-800': isViewAll(navigableItems[selectedIndex], 'channel') }"
                    @click="selectNavigableItem({ type: 'view-all', category: 'channel', link: `/channels?search=${encodeURIComponent(searchQuery)}`, label: t('common.viewAll') })"
                  >
                    {{ t('common.viewAll') }}
                    <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
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
                    :class="{ 'bg-gray-100 dark:bg-gray-800': navigableItems[selectedIndex] === result }"
                    @click="selectNavigableItem(result)"
                  >
                    <UIcon :name="result.icon" class="w-5 h-5 text-gray-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ result.title }}</div>
                      <div v-if="result.subtitle" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {{ result.subtitle }}
                      </div>
                    </div>
                  </button>
                  <button
                    v-if="hasMorePublications"
                    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-500 font-medium text-sm transition-colors mt-1"
                    :class="{ 'bg-gray-100 dark:bg-gray-800': isViewAll(navigableItems[selectedIndex], 'publication') }"
                    @click="selectNavigableItem({ type: 'view-all', category: 'publication', link: `/publications?search=${encodeURIComponent(searchQuery)}`, label: t('common.viewAll') })"
                  >
                    {{ t('common.viewAll') }}
                    <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
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
