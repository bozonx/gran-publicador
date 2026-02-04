<script setup lang="ts">
import { useChannels } from '~/composables/useChannels'
import type { ChannelWithProject } from '~/composables/useChannels'
import { useProjects } from '~/composables/useProjects'
import { useViewMode } from '~/composables/useViewMode'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import ChannelListItem from '~/components/channels/ChannelListItem.vue'
import ChannelCard from '~/components/channels/ChannelCard.vue'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { 
  channels, 
  totalCount,
  fetchChannels, 
  isLoading,
  getSocialMediaIcon,
  getSocialMediaColor,
} = useChannels()

// Pagination
const currentPage = ref(
  route.query.page && typeof route.query.page === 'string' 
    ? Math.max(1, parseInt(route.query.page, 10) || 1)
    : 1
)
const limit = ref(DEFAULT_PAGE_SIZE)

// Filter states
// Initialize filters from URL
const searchQuery = ref(
  (route.query.search as string) || ''
)
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

// Ownership filter
type OwnershipFilter = 'all' | 'own' | 'guest'
const ownershipFilter = ref<OwnershipFilter>(
  (route.query.ownership as OwnershipFilter) || 'all'
)

// Archive filter
// Archive filter
type ArchiveStatus = 'active' | 'archived'
const archiveStatus = ref<ArchiveStatus>(
  route.query.archived === 'true' ? 'archived' : 'active'
)

// Issue type filter
type ChannelIssueFilter = 'all' | 'problematic'
const selectedIssueType = ref<ChannelIssueFilter>(
  (route.query.issue as ChannelIssueFilter) || 'all'
)

// Project filter
const selectedProjectId = ref<string | null>(
  (route.query.projectId as string) || null
)

// Sorting
type SortBy = 'alphabetical' | 'socialMedia' | 'language' | 'postsCount'
const ALLOWED_SORT_BY = ['alphabetical', 'socialMedia', 'language', 'postsCount'] as const
const ALLOWED_SORT_ORDER = ['asc', 'desc'] as const

const SORT_BY_STORAGE_KEY = 'channels-sort-by'
const SORT_ORDER_STORAGE_KEY = 'channels-sort-order'

function parseSortBy(value: unknown): SortBy {
  const v = typeof value === 'string' ? value : ''
  return (ALLOWED_SORT_BY as readonly string[]).includes(v) ? (v as SortBy) : 'alphabetical'
}

function parseSortOrder(value: unknown): 'asc' | 'desc' {
  const v = typeof value === 'string' ? value : ''
  return (ALLOWED_SORT_ORDER as readonly string[]).includes(v) ? (v as 'asc' | 'desc') : 'asc'
}

const sortBy = ref<SortBy>(parseSortBy(route.query.sortBy))
const sortOrder = ref<'asc' | 'desc'>(parseSortOrder(route.query.sortOrder))

// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('channels-view', 'list')

// Projects
const { projects, fetchProjects } = useProjects()

// Fetch channels with current filters
async function loadChannels() {
  await fetchChannels({
    search: debouncedSearch.value || undefined,
    ownership: ownershipFilter.value,
    issueType: selectedIssueType.value,
    projectId: selectedProjectId.value || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    limit: limit.value,
    offset: (currentPage.value - 1) * limit.value,
    archivedOnly: archiveStatus.value === 'archived',
    includeArchived: false,
  })
}

// Fetch on mount
onMounted(async () => {
    if (import.meta.client) {
      const hasSortByInUrl = route.query.sortBy !== undefined
      const hasSortOrderInUrl = route.query.sortOrder !== undefined

      if (!hasSortByInUrl) {
        const storedSortBy = localStorage.getItem(SORT_BY_STORAGE_KEY)
        if (storedSortBy && (ALLOWED_SORT_BY as readonly string[]).includes(storedSortBy)) {
          sortBy.value = storedSortBy as SortBy
        }
      }

      if (!hasSortOrderInUrl) {
        const storedSortOrder = localStorage.getItem(SORT_ORDER_STORAGE_KEY)
        if (storedSortOrder && (ALLOWED_SORT_ORDER as readonly string[]).includes(storedSortOrder)) {
          sortOrder.value = storedSortOrder as 'asc' | 'desc'
        }
      }
    }

    await Promise.all([
        loadChannels(),
        fetchProjects(true) // including archived projects
    ])
})

if (import.meta.client) {
  watch(sortBy, (val) => {
    localStorage.setItem(SORT_BY_STORAGE_KEY, val)
  })

  watch(sortOrder, (val) => {
    localStorage.setItem(SORT_ORDER_STORAGE_KEY, val)
  })
}

// Update URL when filters change
watch(
  [
    ownershipFilter, 
    selectedIssueType, 
    selectedProjectId, 
    debouncedSearch, 
    archiveStatus,
    sortBy,
    sortOrder
  ], 
  () => {
    if (!import.meta.client) return

    const query: any = { ...route.query }
    
    // Helper to set or delete query param
    const updateQuery = (key: string, value: any, defaultValue: any = null) => {
      if (value && value !== defaultValue) {
        query[key] = String(value)
      } else {
        delete query[key]
      }
    }

    updateQuery('search', debouncedSearch.value, '')
    updateQuery('ownership', ownershipFilter.value, 'all')
    updateQuery('issue', selectedIssueType.value, 'all')
    updateQuery('projectId', selectedProjectId.value)
    updateQuery('archived', archiveStatus.value === 'archived' ? 'true' : null, null)
    updateQuery('sortBy', sortBy.value, 'alphabetical')
    updateQuery('sortOrder', sortOrder.value, 'asc')
    
    // Remove page when filters change
    delete query.page

    router.replace({ query })
  }
)

// Watch filters and sorting - reset to page 1 and re-fetch
watch([ownershipFilter, selectedIssueType, selectedProjectId, debouncedSearch, archiveStatus, sortBy, sortOrder], () => {
    currentPage.value = 1
    loadChannels()
})

// Watch page changes - re-fetch with new offset
watch(currentPage, () => {
    loadChannels()
})

// Sync URL with page changes
watch(currentPage, (newPage) => {
    if (!import.meta.client) return
    
    const query = { ...route.query }
    const urlPage = parseInt(String(query.page || '1'), 10)
    
    if (newPage !== urlPage) {
        if (newPage > 1) {
            query.page = String(newPage)
        } else {
            delete query.page
        }
        router.push({ query })
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
})

// Sync page from URL changes
watch(() => route.query.page, (newPage) => {
    const pageNum = parseInt(String(newPage || '1'), 10)
    if (pageNum !== currentPage.value) {
        currentPage.value = pageNum
    }
})

// Sorting computed props for UI
const sortOptionsComputed = computed(() => [
  { id: 'alphabetical', label: t('channel.sort.alphabetical'), icon: 'i-heroicons-bars-3-bottom-left' },
  { id: 'socialMedia', label: t('channel.sort.socialMedia'), icon: 'i-heroicons-share' },
  { id: 'language', label: t('channel.sort.language'), icon: 'i-heroicons-language' },
  { id: 'postsCount', label: t('channel.sort.postsCount'), icon: 'i-heroicons-document-text' }
])

const currentSortOption = computed(() => sortOptionsComputed.value.find(opt => opt.id === sortBy.value))

const sortOrderIcon = computed(() => 
  sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
)

const sortOrderLabel = computed(() => 
  sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')
)

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// Count badge - use server total count
const nonArchivedChannelsCount = computed(() => {
    return totalCount.value
})

// Project filter options
const projectFilterOptions = computed(() => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('project.allProjects') }
  ]
  
  const sortedProjects = [...projects.value].sort((a, b) => a.name.localeCompare(b.name))
  
  sortedProjects.forEach(project => {
    options.push({
      value: project.id,
      label: project.name
    })
  })
  
  return options
})



const hasActiveFilters = computed(() => {
    return searchQuery.value || 
           selectedProjectId.value || 
           ownershipFilter.value !== 'all' || 
           selectedIssueType.value !== 'all' ||
           archiveStatus.value === 'archived'
})

function resetFilters() {
    searchQuery.value = ''
    selectedProjectId.value = null
    ownershipFilter.value = 'all'
    selectedIssueType.value = 'all'
    archiveStatus.value = 'active'
}

const showPagination = computed(() => {
    return totalCount.value > limit.value
})

</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('channel.titlePlural') }}
          <CommonCountBadge :count="nonArchivedChannelsCount" :title="t('channel.filter.badgeCountTooltip')" />
        </h1>
      </div>

      <!-- Sorting and view controls -->
      <div class="flex items-center gap-2">
        <CommonViewToggle v-model="viewMode" />

        <USelectMenu
          v-model="sortBy"
          :items="sortOptionsComputed"
          value-key="id"
          label-key="label"
          class="w-56"
          :searchable="false"
        >
          <template #leading>
            <UIcon v-if="currentSortOption" :name="currentSortOption.icon" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <UButton
          :key="sortOrder"
          :icon="sortOrderIcon"
          color="neutral"
          variant="ghost"
          @click="toggleSortOrder"
          :title="sortOrderLabel"
        />
      </div>
    </div>

    <!-- Search and filters -->
    <div class="app-card p-4 space-y-4">
      <!-- Search -->
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            :placeholder="t('common.search')"
            size="md"
            class="w-full"
            :loading="isLoading && searchQuery !== debouncedSearch"
          />
        </div>
        <UButton
          v-if="hasActiveFilters"
          color="neutral"
          variant="subtle"
          icon="i-heroicons-x-mark"
          size="sm"
          @click="resetFilters"
        >
          {{ t('common.resetFilters', 'Reset') }}
        </UButton>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <!-- Ownership Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('channel.filter.ownership.title')">
          <UiAppButtonGroup
            v-model="ownershipFilter"
            :options="[
              { value: 'own', label: t('channel.filter.ownership.own') },
              { value: 'guest', label: t('channel.filter.ownership.guest') },
              { value: 'all', label: t('channel.filter.ownership.all') }
            ]"
            variant="outline"
            active-variant="solid"
          />
          <CommonInfoTooltip :text="t('channel.filter.ownership.tooltip')" />
        </div>

        <!-- Issues Filter (Select) -->
        <!-- Issues Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('channel.filter.problems.title')">
          <UiAppButtonGroup
            v-model="selectedIssueType"
            :options="[
              { value: 'problematic', label: t('channel.filter.problems.onlyProblems') },
              { value: 'all', label: t('common.all') }
            ]"
            variant="outline"
            active-variant="solid"
            color="warning"
          />
           <CommonInfoTooltip :text="t('channel.filter.problems.tooltip')" />
        </div>

        <!-- Archive Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('channel.filter.archiveStatus.tooltip')">
          <UiAppButtonGroup
            v-model="archiveStatus"
            :options="[
              { value: 'archived', label: t('channel.filter.archiveStatus.archived') },
              { value: 'active', label: t('channel.filter.archiveStatus.active') }
            ]"
            variant="outline"
            active-variant="solid"
            color="neutral"
          />
        </div>
        
        <!-- Project Filter (Select) -->
        <USelectMenu
          v-model="selectedProjectId"
          :items="projectFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('channel.filter.project')"
          :title="t('channel.filter.projectTitle')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedProjectId" name="i-heroicons-folder" class="w-4 h-4" />
          </template>
        </USelectMenu>
      </div>
    </div>

    <!-- Channels list view -->
    <div v-if="isListView" class="space-y-4">
       <div v-if="isLoading && channels.length === 0" class="flex items-center justify-center py-12">
          <UiLoadingSpinner size="md" />
       </div>

       <div v-else-if="channels.length === 0" class="app-card text-center py-12">
          <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-hashtag" class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ t('channel.noChannelsFound') }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ searchQuery || hasActiveFilters ? t('channel.adjustFilters', 'Try making your filters less strict') : t('channel.noChannelsDescription') }}
          </p>
       </div>

       <ChannelListItem
         v-for="channel in channels"
         :key="channel.id"
         :channel="channel"
         :show-project="true"
         :is-archived="!!channel.archivedAt"
       />
    </div>

    <!-- Channels cards view -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       <div v-if="isLoading && channels.length === 0" class="col-span-full flex items-center justify-center py-12">
          <UiLoadingSpinner size="md" />
       </div>

       <div v-else-if="channels.length === 0" class="col-span-full app-card text-center py-12">
          <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-hashtag" class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ t('channel.noChannelsFound') }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ searchQuery || hasActiveFilters ? t('channel.adjustFilters', 'Try making your filters less strict') : t('channel.noChannelsDescription') }}
          </p>
       </div>

       <ChannelCard
         v-for="channel in channels"
         :key="channel.id"
         :channel="channel"
         :show-project="true"
         :is-archived="!!channel.archivedAt"
       />
    </div>

    <!-- Pagination -->
    <div v-if="showPagination" class="mt-8 flex justify-center">
      <UPagination
        v-model:page="currentPage"
        :total="totalCount"
        :items-per-page="limit"
        :prev-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-left', label: t('common.prev') }"
        :next-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-right', label: t('common.next'), trailing: true }"
      />
    </div>
  </div>
</template>
