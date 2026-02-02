<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
import { useUrlFilters } from '~/composables/useUrlQuery'

import { useViewMode } from '~/composables/useViewMode'
import { getSocialMediaOptions, getSocialMediaIcon } from '~/utils/socialMedia'
import type { SocialMedia } from '~/types/socialMedia'
import type { PublicationStatus } from '~/types/posts'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
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
  bulkOperation,
  deletePublication
} = usePublications()

const { projects, fetchProjects } = useProjects()
const { channels, fetchChannels } = useChannels()

// Filters synced with URL
const filters = useUrlFilters<{
  page: number
  status: PublicationStatus | PublicationStatus[] | null
  channelId: string | null
  projectId: string | null
  search: string
  ownership: 'all' | 'own' | 'notOwn'
  issue: 'all' | 'problematic'
  socialMedia: SocialMedia | null
  language: string | null
  archived: string
  sortBy: string
  sortOrder: string
}>({
  page: { defaultValue: 1, deserialize: (v: string) => Math.max(1, parseInt(v) || 1) },
  status: { 
    defaultValue: null, 
    deserialize: (v: string) => (v.includes(',') ? v.split(',') : v) as any,
    serialize: (v: any) => Array.isArray(v) ? v.join(',') : v
  },
  channelId: { defaultValue: null },
  projectId: { defaultValue: null },
  search: { defaultValue: '' },
  ownership: { defaultValue: 'all' },
  issue: { defaultValue: 'all' },
  socialMedia: { defaultValue: null },
  language: { defaultValue: null },
  archived: { defaultValue: 'active' },
  sortBy: { defaultValue: 'chronology' },
  sortOrder: { defaultValue: 'desc' },
})

const currentPage = filters.page
const selectedStatus = filters.status
const selectedChannelId = filters.channelId
const selectedProjectId = filters.projectId
const searchQuery = filters.search
const ownershipFilter = filters.ownership
const selectedIssueType = filters.issue
const selectedSocialMedia = filters.socialMedia
const selectedLanguage = filters.language
const showArchivedFilter = filters.archived
const sortBy = filters.sortBy
const sortOrder = filters.sortOrder

const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)
const limit = ref(DEFAULT_PAGE_SIZE)

// Computed model for status UI
const selectedStatusModel = computed({
  get: () => selectedStatus.value as any,
  set: (v) => { selectedStatus.value = v }
})

// Sorting options
const sortOptionsComputed = computed(() => [
  { id: 'chronology', label: t('publication.sort.chronology'), icon: 'i-heroicons-calendar-days' },
  { id: 'byScheduled', label: t('publication.sort.byScheduled'), icon: 'i-heroicons-clock' },
  { id: 'byPublished', label: t('publication.sort.byPublished'), icon: 'i-heroicons-check-circle' },
  { id: 'createdAt', label: t('publication.sort.createdAt'), icon: 'i-heroicons-plus-circle' },
  { id: 'postDate', label: t('publication.sort.postDate'), icon: 'i-heroicons-calendar' }
])

const currentSortOption = computed(() => 
  sortOptionsComputed.value.find(opt => opt.id === sortBy.value)
)

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('publications-view', 'list')

// Fetch publications with current filters
async function fetchPublications() {
  await fetchUserPublications({
    limit: limit.value,
    offset: (currentPage.value - 1) * limit.value,
    includeArchived: false,
    archivedOnly: showArchivedFilter.value === 'archived',
    sortBy: sortBy.value as any,
    sortOrder: sortOrder.value as any,
    status: selectedStatus.value as any,
    language: selectedLanguage.value || undefined,
    search: debouncedSearch.value || undefined,
    channelId: selectedChannelId.value || undefined,
    projectId: selectedProjectId.value || undefined,
    ownership: ownershipFilter.value as any,
    issueType: selectedIssueType.value as any,
    socialMedia: selectedSocialMedia.value as any,
  })
}

// Initial data load
onMounted(async () => {
    await Promise.all([
        fetchProjects(true),
        fetchChannels()
    ])
    // Fetch publications after projects/channels for proper context if needed
    await fetchPublications()
})

// Reactively re-fetch when any filter changes
watch(
  [selectedStatus, selectedChannelId, selectedProjectId, ownershipFilter, selectedIssueType, selectedSocialMedia, selectedLanguage, debouncedSearch, showArchivedFilter, sortBy, sortOrder, currentPage], 
  () => {
    fetchPublications()
  }
)

// Reset to page 1 on filter change
watch(
  [selectedStatus, selectedChannelId, selectedProjectId, ownershipFilter, selectedIssueType, selectedSocialMedia, selectedLanguage, debouncedSearch, showArchivedFilter, sortBy, sortOrder], 
  () => {
    currentPage.value = 1
  }
)

function goToPublication(pub: PublicationWithRelations) {
    router.push(`/publications/${pub.id}`)
}

const statusFilterOptions = computed(() => [
  { value: null, label: t('publication.filter.allStatuses') },
  ...statusOptions.value.map(opt => {
    if (opt.value === 'READY') return { ...opt, label: t('publication.filter.ready') }
    if (opt.value === 'PUBLISHED') return { ...opt, label: t('publication.filter.published') }
    return opt
  }),
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
  { value: null, label: t('publication.filter.allSocialMedia') },
  ...getSocialMediaOptions(t)
])

// Issue filter options
// Issue filter options removed as we switched to button group with static options

// Language filter options
const languageFilterOptions = computed(() => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('publication.filter.allLanguages') }
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
    { value: null, label: t('publication.filter.allProjects') }
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
    { value: null, label: t('publication.filter.allChannels') }
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

// Bulk Operations State
const selectedIds = ref<string[]>([])

const bulkStatusOptions = computed(() => [
  ...statusOptions.value
    .filter(opt => ['DRAFT', 'READY'].includes(opt.value))
    .map(opt => ({
      label: opt.label,
      icon: 'i-heroicons-tag',
      onSelect: () => {
        handleBulkAction('SET_STATUS', opt.value as any)
      }
    }))
])

const isAllSelected = computed(() => {
  return filteredPublications.value.length > 0 && 
         filteredPublications.value.every(pub => selectedIds.value.includes(pub.id))
})

const isSomeSelected = computed(() => {
  return selectedIds.value.length > 0 && !isAllSelected.value
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = filteredPublications.value.map(pub => pub.id)
  }
}

function toggleSelection(pubId: string) {
  const index = selectedIds.value.indexOf(pubId)
  if (index === -1) {
    selectedIds.value.push(pubId)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

// Reset selection on filter change
watch([selectedStatus, selectedChannelId, selectedProjectId, ownershipFilter, selectedIssueType, selectedSocialMedia, selectedLanguage, debouncedSearch, showArchivedFilter, sortBy, sortOrder, currentPage], () => {
    selectedIds.value = []
})

const showBulkDeleteModal = ref(false)
const showBulkStatusModal = ref(false)
const bulkActionPending = ref(false)
const bulkStatusToSet = ref<PublicationStatus | null>(null)

async function handleBulkAction(operation: string, status?: string) {
  if (selectedIds.value.length === 0) return

  bulkActionPending.value = true
  const success = await bulkOperation(selectedIds.value, operation, status)
  bulkActionPending.value = false

  if (success) {
    showBulkDeleteModal.value = false
    showBulkStatusModal.value = false
    selectedIds.value = []
    fetchPublications()
  }
}

const showDeleteModal = ref(false)
const publicationToDelete = ref<PublicationWithRelations | null>(null)
const isDeleting = ref(false)



function confirmDelete(pub: PublicationWithRelations) {
  publicationToDelete.value = pub
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!publicationToDelete.value) return
  
  isDeleting.value = true
  const success = await deletePublication(publicationToDelete.value.id)
  isDeleting.value = false
  
  if (success) {
    showDeleteModal.value = false
    publicationToDelete.value = null
    // Manually refresh publications list
    fetchPublications()
  }
}
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
          {{ t('common.resetFilters', 'Reset') }}
        </UButton>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Ownership Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('publication.filter.ownership.title')">
          <UiAppButtonGroup
            v-model="ownershipFilter"
            :options="[
              { value: 'own', label: t('publication.filter.ownership.own') },
              { value: 'notOwn', label: t('publication.filter.ownership.notOwn') },
              { value: 'all', label: t('publication.filter.ownership.all') }
            ]"
            variant="outline"
            active-variant="solid"
          />
          <UPopover :popper="{ placement: 'top' }">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
            <template #content>
              <div class="p-4 max-w-xs">
                <p class="text-sm whitespace-pre-line">{{ t('publication.filter.ownership.tooltip') }}</p>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Issues Filter (Button group) -->
        <div class="flex items-center gap-2" :title="t('publication.filter.problems.title')">
          <UiAppButtonGroup
            v-model="selectedIssueType"
            :options="[
              { value: 'problematic', label: t('publication.filter.problems.onlyProblems') },
              { value: 'all', label: t('common.all') }
            ]"
            variant="outline"
            active-variant="solid"
            color="warning"
          />
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
          <UiAppButtonGroup
            v-model="showArchivedFilter"
            :options="[
              { value: 'archived', label: t('channel.filter.archiveStatus.archived') },
              { value: 'active', label: t('channel.filter.archiveStatus.active') },
            ]"
            variant="outline"
            active-variant="solid"
            color="neutral"
          />
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
            <UIcon
              :name="selectedSocialMedia ? getSocialMediaIcon(selectedSocialMedia) : 'i-heroicons-share'"
              class="w-4 h-4"
            />
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
        >
          <template #leading>
            <UIcon name="i-heroicons-language" class="w-4 h-4" />
          </template>
        </USelectMenu>

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
            <UIcon name="i-heroicons-folder" class="w-4 h-4" />
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
            <UIcon name="i-heroicons-megaphone" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <!-- Status Filter (Select) -->
        <USelectMenu
          v-model="selectedStatusModel"
          :items="statusFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('post.statusLabel')"
          :title="t('publication.filter.statusTitle')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon name="i-heroicons-tag" class="w-4 h-4" />
          </template>
        </USelectMenu>
      </div>
    </div>

    <!-- Publications list -->
    <div v-if="isLoading && publications.length === 0" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="filteredPublications.length === 0" class="app-card p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('publication.noPublicationsFound', 'No publications found') }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          {{ hasActiveFilters ? t('post.noPostsFiltered') : t('publication.noPublicationsDescription', 'You have no publications created yet.') }}
        </p>
    </div>

    <!-- Bulk operations and select all -->
    <div v-if="filteredPublications.length > 0" class="flex items-center gap-4 px-2">
      <UCheckbox
        :model-value="isAllSelected"
        :indeterminate="isSomeSelected"
        @update:model-value="toggleSelectAll"
        :label="isAllSelected ? t('common.deselectAll', 'Deselect all') : t('common.selectAll', 'Select all')"
      />
    </div>

    <!-- Publications list view -->
    <div v-if="isListView" class="space-y-4">
        <PublicationsPublicationListItem
          v-for="pub in filteredPublications"
          :key="pub.id"
          :publication="pub"
          :selected="selectedIds.includes(pub.id)"
          show-project-info
          @click="goToPublication"
          @delete="confirmDelete"
          @update:selected="toggleSelection(pub.id)"
        />
    </div>

    <!-- Publications cards view -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <PublicationsPublicationCard
          v-for="pub in filteredPublications"
          :key="pub.id"
          :publication="pub"
          :selected="selectedIds.includes(pub.id)"
          show-project-info
          @click="goToPublication"
          @delete="confirmDelete"
          @update:selected="toggleSelection(pub.id)"
        />
    </div>

    <!-- Bulk Action Bar -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-full opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-full opacity-0"
    >
      <div v-if="selectedIds.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-full shadow-2xl border border-gray-700 flex items-center gap-6 min-w-max">
        <div class="flex items-center gap-2 border-r border-gray-700 pr-6 mr-2">
          <span class="text-sm font-medium">{{ t('common.selected', { count: selectedIds.length }) }}</span>
          <UButton 
            color="neutral" 
            variant="ghost" 
            size="xs" 
            icon="i-heroicons-x-mark" 
            @click="selectedIds = []" 
            :title="t('common.clearSelection', 'Clear')"
          />
        </div>

        <div class="flex items-center gap-2">
          <!-- Archive / Unarchive -->
          <UButton
            v-if="showArchivedFilter !== 'archived'"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-archive-box"
            size="sm"
            @click="handleBulkAction('ARCHIVE')"
            :loading="bulkActionPending"
          >
            {{ t('common.archive') }}
          </UButton>
          <UButton
            v-else
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            size="sm"
            @click="handleBulkAction('UNARCHIVE')"
            :loading="bulkActionPending"
          >
            {{ t('common.restore') }}
          </UButton>

          <UDropdownMenu
            :items="bulkStatusOptions"
            :popper="{ placement: 'top' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-adjustments-horizontal"
              size="sm"
              :loading="bulkActionPending"
            >
              {{ t('post.statusLabel') }}
            </UButton>
          </UDropdownMenu>

          <!-- Delete -->
          <UButton
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            size="sm"
            @click="showBulkDeleteModal = true"
            :loading="bulkActionPending"
          >
            {{ t('common.delete') }}
          </UButton>
        </div>
      </div>
    </Transition>

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

  <!-- Delete Confirmation Modal -->
  <UiConfirmModal
    v-if="showDeleteModal"
    v-model:open="showDeleteModal"
    :title="t('publication.deleteConfirm')"
    :description="t('publication.deleteCascadeWarning')"
    :confirm-text="t('common.delete')"
    color="error"
    icon="i-heroicons-exclamation-triangle"
    :loading="isDeleting"
    @confirm="handleDelete"
  />

  <!-- Bulk Delete Confirmation Modal -->
  <UiConfirmModal
    v-if="showBulkDeleteModal"
    v-model:open="showBulkDeleteModal"
    :title="t('publication.bulkDeleteConfirm', { count: selectedIds.length })"
    :description="t('publication.deleteCascadeWarning')"
    :confirm-text="t('common.delete')"
    color="error"
    icon="i-heroicons-exclamation-triangle"
    :loading="bulkActionPending"
    @confirm="handleBulkAction('DELETE')"
  />
</template>
