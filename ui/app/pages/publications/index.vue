<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'

import { useViewMode } from '~/composables/useViewMode'
import { getSocialMediaOptions, getSocialMediaIcon } from '~/utils/socialMedia'
import type { SocialMedia } from '~/types/socialMedia'
import type { PublicationStatus } from '~/types/posts'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { LANGUAGE_OPTIONS } from '~/utils/languages'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { user } = useAuth()

const {
  publications,
  isLoading,
  totalCount,
  statusOptions,
  fetchUserPublications,
} = usePublications()

// Initialize currentPage from URL query parameter
const currentPage = ref(
  route.query.page && typeof route.query.page === 'string' 
    ? Math.max(1, parseInt(route.query.page, 10) || 1)
    : 1
)

// Pagination state
const limit = ref(DEFAULT_PAGE_SIZE)

// Filter states
// Initialize filters from URL
const selectedStatus = ref<PublicationStatus | PublicationStatus[] | null>(
  route.query.status 
    ? (typeof route.query.status === 'string' && route.query.status.includes(',') 
        ? route.query.status.split(',') as PublicationStatus[]
        : route.query.status as PublicationStatus)
    : null
)
const selectedChannelId = ref<string | null>(
  (route.query.channelId as string) || null
)
const selectedProjectId = ref<string | null>(
  (route.query.projectId as string) || null
)
const searchQuery = ref(
  (route.query.search as string) || ''
)
const debouncedSearch = refDebounced(searchQuery, 300)

// Ownership filter
type OwnershipFilter = 'all' | 'own' | 'notOwn'
const ownershipFilter = ref<OwnershipFilter>(
  (route.query.ownership as OwnershipFilter) || 'all'
)

// Filter options
const showArchivedFilter = ref(route.query.archived === 'true') 

type IssueFilter = 'all' | 'failed' | 'partial' | 'expired'
const selectedIssueType = ref<IssueFilter>(
  (route.query.issue as IssueFilter) || 'all'
)

const selectedSocialMedia = ref<SocialMedia | null>(
  (route.query.socialMedia as SocialMedia) || null
)
const selectedLanguage = ref<string | null>(
  (route.query.language as string) || null
)

// Sorting options
const sortOptionsComputed = computed(() => [
  { id: 'scheduledAt', label: t('publication.sort.scheduledAt'), icon: 'i-heroicons-clock' },
  { id: 'createdAt', label: t('publication.sort.createdAt'), icon: 'i-heroicons-plus-circle' },
  { id: 'postDate', label: t('publication.sort.postDate'), icon: 'i-heroicons-calendar' }
])



// Manual sorting state synced with URL
type SortField = 'scheduledAt' | 'createdAt' | 'postDate'
const sortBy = ref<SortField>(
  (route.query.sortBy as SortField) || 'createdAt'
)
const sortOrder = ref<'asc' | 'desc'>(
  (route.query.sortOrder as 'asc' | 'desc') || 'desc'
)

const currentSortOption = computed(() => 
  sortOptionsComputed.value.find(opt => opt.id === sortBy.value)
)

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('publications-view', 'list')

// Projects
const { projects, fetchProjects } = useProjects()

// Channels
const { channels, fetchChannels } = useChannels()

// Fetch publications with current filters
async function fetchPublications() {
  const filters: any = {
    limit: limit.value,
    offset: (currentPage.value - 1) * limit.value,
    includeArchived: showArchivedFilter.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }

  // Server-side filters
  if (selectedStatus.value) filters.status = selectedStatus.value
  if (selectedLanguage.value) filters.language = selectedLanguage.value
  if (debouncedSearch.value) filters.search = debouncedSearch.value
  
  if (selectedChannelId.value) filters.channelId = selectedChannelId.value
  
  // New backend filters
  if (selectedProjectId.value) filters.projectId = selectedProjectId.value
  
  if (ownershipFilter.value !== 'all') filters.ownership = ownershipFilter.value
  if (selectedIssueType.value !== 'all') filters.issueType = selectedIssueType.value
  if (selectedSocialMedia.value) filters.socialMedia = selectedSocialMedia.value

  await fetchUserPublications(filters)
}

// Fetch on mount
onMounted(async () => {
    await Promise.all([
        fetchPublications(),
        fetchProjects(true), // включая архивные проекты
        fetchChannels() // получаем все каналы
    ])
})

// Update URL when filters change
watch(
  [
    selectedStatus, 
    selectedChannelId, 
    selectedProjectId, 
    ownershipFilter, 
    selectedIssueType, 
    selectedSocialMedia, 
    selectedLanguage, 
    debouncedSearch, 
    showArchivedFilter,
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

    updateQuery('status', Array.isArray(selectedStatus.value) ? selectedStatus.value.join(',') : selectedStatus.value)
    updateQuery('channelId', selectedChannelId.value)
    updateQuery('projectId', selectedProjectId.value)
    updateQuery('search', debouncedSearch.value, '')
    updateQuery('ownership', ownershipFilter.value, 'all')
    updateQuery('issue', selectedIssueType.value, 'all')
    updateQuery('socialMedia', selectedSocialMedia.value)
    updateQuery('language', selectedLanguage.value)
    updateQuery('archived', showArchivedFilter.value, false)
    updateQuery('sortBy', sortBy.value, 'createdAt')
    updateQuery('sortOrder', sortOrder.value, 'desc')
    
    // Remove page when filters change (reset to 1 happen in the other watcher)
    delete query.page

    router.replace({ query })
  }
)

// Watch filters and sorting - reset to page 1 and re-fetch
watch([selectedStatus, selectedChannelId, selectedProjectId, ownershipFilter, selectedIssueType, selectedSocialMedia, selectedLanguage, debouncedSearch, showArchivedFilter, sortBy, sortOrder], () => {
    currentPage.value = 1
    fetchPublications()
})

// Watch page changes - re-fetch with new offset
watch(currentPage, () => {
    fetchPublications()
})

// Sync URL with page changes
watch(currentPage, (newPage) => {
    if (!import.meta.client) return
    
    // Check if we need to update URL
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

function goToPublication(pub: PublicationWithRelations) {
    router.push(`/projects/${pub.projectId}/publications/${pub.id}`)
}

const statusFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  ...statusOptions.value,
])

const hasActiveFilters = computed(() => {
  return selectedStatus.value || 
         selectedChannelId.value || 
         searchQuery.value || 
         selectedProjectId.value || 
         ownershipFilter.value !== 'all' || 
         selectedIssueType.value !== 'all' || 
         selectedSocialMedia.value ||
         selectedLanguage.value
})

function resetFilters() {
  selectedStatus.value = null
  selectedChannelId.value = null
  selectedProjectId.value = null
  searchQuery.value = ''
  ownershipFilter.value = 'all'
  selectedIssueType.value = 'all'
  selectedSocialMedia.value = null
  selectedLanguage.value = null
}


// Sorting computed props for UI
const sortOrderIcon = computed(() => 
  sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
)

const sortOrderLabel = computed(() => 
  sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')
)

// Social media filter options
const socialMediaFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  ...getSocialMediaOptions(t)
])

// Issue filter options
const issueFilterOptions = computed(() => [
  { value: 'all', label: t('publication.filter.problems.all') },
  { value: 'failed', label: t('publication.filter.problems.failed') },
  { value: 'partial', label: t('publication.filter.problems.partial') },
  { value: 'expired', label: t('publication.filter.problems.expired') }
])

// Language filter options
const languageFilterOptions = computed(() => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('common.all') }
  ]
  
  LANGUAGE_OPTIONS.forEach(lang => {
    options.push({
      value: lang.value,
      label: lang.label
    })
  })
  
  return options
})

// Project filter options
const projectFilterOptions = computed(() => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('common.all') }
  ]
  
  // Sort and add all projects
  const sortedProjects = [...projects.value].sort((a, b) => a.name.localeCompare(b.name))
  
  sortedProjects.forEach(project => {
    options.push({
      value: project.id,
      label: project.name
    })
  })
  
  return options
})

// Channel filter options
const channelFilterOptions = computed(() => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('common.all') }
  ]
  
  // Sort and add all channels
  const sortedChannels = [...channels.value].sort((a, b) => a.name.localeCompare(b.name))
  
  sortedChannels.forEach(channel => {
    // Get project name for better context
    const project = projects.value.find(p => p.id === channel.projectId)
    const projectName = project ? ` (${project.name})` : ''
    
    options.push({
      value: channel.id,
      label: `${channel.name}${projectName}`
    })
  })
  
  return options
})

// Count for badge - use server total count
const filteredCount = computed(() => totalCount.value)

// Client-side filters removed - data comes filtered from backend
const filteredPublications = computed(() => publications.value)

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
          {{ t('publication.titlePlural') }}
          <CommonCountBadge :count="filteredCount" :title="t('publication.filter.badgeCountTooltip')" />
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
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
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
          {{ t('common.resetFilters', 'Сбросить') }}
        </UButton>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Ownership Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('publication.filter.ownership.title')">
          <div class="flex -space-x-px">
            <UButton 
              :color="ownershipFilter === 'all' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'all' ? 'solid' : 'outline'"
              class="rounded-r-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'all'"
            >
              {{ t('publication.filter.ownership.all') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'own' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'own' ? 'solid' : 'outline'"
              class="rounded-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'own'"
            >
              {{ t('publication.filter.ownership.own') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'notOwn' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'notOwn' ? 'solid' : 'outline'"
              class="rounded-l-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'notOwn'"
            >
              {{ t('publication.filter.ownership.notOwn') }}
            </UButton>
          </div>
          <UPopover :popper="{ placement: 'top' }">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
            <template #content>
              <div class="p-4 max-w-xs">
                <p class="text-sm whitespace-pre-line">{{ t('publication.filter.ownership.tooltip') }}</p>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Issues Filter (Select) -->
        <div class="flex items-center gap-2">
          <USelectMenu
            v-model="selectedIssueType"
            :items="issueFilterOptions"
            value-key="value"
            label-key="label"
            class="w-full sm:w-48"
            :title="t('publication.filter.problems.title')"
          >
            <template #leading>
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-orange-500" />
            </template>
          </USelectMenu>
          <UPopover :popper="{ placement: 'top' }">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
            <template #content>
              <div class="p-4 max-w-xs">
                <p class="text-sm whitespace-pre-line">{{ t('publication.filter.problems.tooltip') }}</p>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Archive Filter (Checkbox) - moved to end -->
        <div class="flex items-center gap-1.5" :title="t('publication.filter.archiveStatus.tooltip')">
          <UCheckbox 
            v-model="showArchivedFilter" 
            :label="t('publication.filter.showArchived')"
            :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
          />
          <UPopover :popper="{ placement: 'top' }">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
            <template #content>
              <div class="p-4 max-w-xs">
                <p class="text-sm">{{ t('publication.filter.archiveStatus.tooltip') }}</p>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Social Media Filter (Select) -->
        <USelectMenu
          v-model="selectedSocialMedia"
          :items="socialMediaFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.socialMedia')"
          :title="t('publication.filter.socialMediaTitle')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedSocialMedia" :name="getSocialMediaIcon(selectedSocialMedia)" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <!-- Language Filter (Select) -->
        <USelectMenu
          v-model="selectedLanguage"
          :items="languageFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.language')"
          :title="t('publication.filter.languageTitle')"
          class="w-full sm:w-40"
        />

        <!-- Project Filter (Select) -->
        <USelectMenu
          v-model="selectedProjectId"
          :items="projectFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.project')"
          :title="t('publication.filter.projectTitle')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedProjectId" name="i-heroicons-folder" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <!-- Channel Filter (Select) -->
        <USelectMenu
          v-model="selectedChannelId"
          :items="channelFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.channel')"
          :title="t('publication.filter.channelTitle')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedChannelId" name="i-heroicons-megaphone" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <!-- Status Filter (Select) -->
        <USelectMenu
          v-model="selectedStatus as any"
          :items="statusFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('post.status')"
          :title="t('publication.filter.statusTitle')"
          class="w-full sm:w-48"
        />
      </div>
    </div>

    <!-- Publications list -->
    <div v-if="isLoading && publications.length === 0" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="filteredPublications.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('publication.noPublicationsFound', 'Публикации не найдены') }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          {{ hasActiveFilters ? t('post.noPostsFiltered') : t('publication.noPublicationsDescription', 'У вас еще нет созданных публикаций.') }}
        </p>
    </div>

    <!-- Publications list view -->
    <div v-if="isListView" class="space-y-4">
        <PublicationsPublicationListItem
          v-for="pub in filteredPublications"
          :key="pub.id"
          :publication="pub"
          show-project-info
          @click="goToPublication"
        />
    </div>

    <!-- Publications cards view -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <PublicationsPublicationCard
          v-for="pub in filteredPublications"
          :key="pub.id"
          :publication="pub"
          show-project-info
          @click="goToPublication"
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
