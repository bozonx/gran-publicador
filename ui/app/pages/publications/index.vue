<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/types/publications'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
import { useUrlFilters } from '~/composables/useUrlQuery'
import { useViewMode } from '~/composables/useViewMode'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import { mapStatusGroupToApiStatus, type PublicationsStatusGroupFilter } from './statusGroupFilter'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const router = useRouter()
const { user } = useAuth()

const {
  publications, isLoading, totalCount, totalUnfilteredCount,
  fetchPublications, bulkOperation, deletePublication
} = usePublications()

const { projects, fetchProjects } = useProjects()
const { channels, fetchChannels } = useChannels()

// Filters state
const filters = useUrlFilters({
  page: { defaultValue: 1, deserialize: (v: string) => Math.max(1, parseInt(v) || 1) },
  status: { defaultValue: 'active' as PublicationsStatusGroupFilter },
  channelId: { defaultValue: null as string | null },
  projectId: { defaultValue: null as string | null },
  search: { defaultValue: '' },
  ownership: { defaultValue: 'all' as 'all' | 'own' | 'notOwn' },
  socialMedia: { defaultValue: null as any },
  language: { defaultValue: null as string | null },
  archived: { defaultValue: 'active' },
  sortBy: { defaultValue: 'chronology' },
  sortOrder: { defaultValue: 'desc' },
  tags: { defaultValue: '' },
})

const debouncedSearch = refDebounced(computed(() => filters.search.value), SEARCH_DEBOUNCE_MS)

const hasActiveFilters = computed(() => 
  filters.status.value !== 'active' || filters.channelId.value || filters.search.value || 
  filters.projectId.value || filters.ownership.value !== 'all' || filters.socialMedia.value ||
  filters.language.value || filters.tags.value
)

function resetFilters() {
  filters.status.value = 'active'
  filters.channelId.value = null
  filters.projectId.value = null
  filters.search.value = ''
  filters.ownership.value = 'all'
  filters.socialMedia.value = null
  filters.language.value = null
  filters.tags.value = ''
}

// Data fetching
async function loadPublications(options: { append?: boolean } = {}) {
  await fetchPublications({
    limit: DEFAULT_PAGE_SIZE,
    offset: options.append ? publications.value.length : (filters.page.value - 1) * DEFAULT_PAGE_SIZE,
    archivedOnly: filters.archived.value === 'archived',
    sortBy: filters.sortBy.value,
    sortOrder: filters.sortOrder.value as any,
    status: mapStatusGroupToApiStatus(filters.status.value as any) as any,
    language: filters.language.value || undefined,
    search: debouncedSearch.value || undefined,
    channelId: filters.channelId.value || undefined,
    projectId: filters.projectId.value || undefined,
    ownership: filters.ownership.value as any,
    socialMedia: filters.socialMedia.value as any,
    tags: filters.tags.value || undefined,
  }, options)
}

onMounted(async () => {
  await Promise.all([fetchProjects(true), fetchChannels()])
  await loadPublications()
})

watch([filters.status, filters.channelId, filters.projectId, filters.ownership, filters.socialMedia, filters.language, filters.tags, debouncedSearch, filters.archived, filters.sortBy, filters.sortOrder], () => {
  filters.page.value = 1
  loadPublications()
})

// Bulk operations
const selectedIds = ref<string[]>([])
const showBulkDeleteModal = ref(false)
const showBulkMoveModal = ref(false)
const targetProjectIdForBulk = ref<string>()
const bulkActionPending = ref(false)

async function handleBulkAction(operation: string, status?: string) {
  bulkActionPending.value = true
  if (await bulkOperation(selectedIds.value, operation, status)) {
    selectedIds.value = []
    showBulkDeleteModal.value = false
    loadPublications()
  }
  bulkActionPending.value = false
}

async function handleBulkMove() {
  if (!targetProjectIdForBulk.value) return
  bulkActionPending.value = true
  if (await bulkOperation(selectedIds.value, 'MOVE', undefined, targetProjectIdForBulk.value)) {
    selectedIds.value = []
    showBulkMoveModal.value = false
    loadPublications()
  }
  bulkActionPending.value = false
}

// Single delete
const showDeleteModal = ref(false)
const pubToDelete = ref<PublicationWithRelations | null>(null)
const isDeleting = ref(false)

async function handleDelete() {
  if (!pubToDelete.value) return
  isDeleting.value = true
  if (await deletePublication(pubToDelete.value.id)) {
    showDeleteModal.value = false
    loadPublications()
  }
  isDeleting.value = false
}

const { viewMode, isListView } = useViewMode('publications-view', 'list')
const publicationTagsSuggestions = computed(() => {
  return Array.from(new Set(publications.value.flatMap(p => p.tags || [])))
})
</script>

<template>
  <div class="page-spacing">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        {{ t('publication.titlePlural') }}
        <CommonCountBadge :count="totalUnfilteredCount" />
      </h1>
      <div class="flex items-center gap-2">
        <CommonViewToggle v-model="viewMode" />
        <USelectMenu
          v-model="filters.sortBy.value"
          :items="[
            { id: 'chronology', label: t('publication.sort.chronology') },
            { id: 'byScheduled', label: t('publication.sort.byScheduled') },
            { id: 'byPublished', label: t('publication.sort.byPublished') },
            { id: 'createdAt', label: t('publication.sort.createdAt') },
            { id: 'postDate', label: t('publication.sort.postDate') }
          ]"
          value-key="id"
          label-key="label"
        />
        <UButton :icon="filters.sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'" color="neutral" variant="ghost" @click="filters.sortOrder.value = filters.sortOrder.value === 'asc' ? 'desc' : 'asc'" />
      </div>
    </div>

    <PublicationsFilterBar
      v-model:status="filters.status.value"
      v-model:ownership="filters.ownership.value"
      v-model:archived="filters.archived.value"
      v-model:social-media="filters.socialMedia.value"
      v-model:language="filters.language.value"
      v-model:tags="filters.tags.value"
      v-model:project-id="filters.projectId.value"
      v-model:channel-id="filters.channelId.value"
      v-model:search="filters.search.value"
      :is-loading="isLoading"
      :has-active-filters="hasActiveFilters"
      :publication-tags-suggestions="publicationTagsSuggestions"
      @reset="resetFilters"
    />

    <div v-if="publications.length === 0 && !isLoading" class="app-card p-12 text-center">
      <h3 class="text-lg font-medium">{{ t('publication.noPublicationsFound') }}</h3>
    </div>

    <div v-if="publications.length > 0" class="flex items-center justify-between mb-4 px-2">
      <UCheckbox :model-value="selectedIds.length === publications.length" :indeterminate="selectedIds.length > 0 && selectedIds.length < publications.length" @update:model-value="(v: any) => { if (v === 'indeterminate') return; selectedIds = (v as boolean) ? publications.map(p => p.id) : [] }" />
      <CommonFoundCount :count="totalCount" :show="hasActiveFilters" />
    </div>

    <CommonInfiniteList :is-loading="isLoading" :has-more="publications.length < totalCount" @load-more="loadPublications({ append: true })">
      <div v-if="isListView" class="space-y-4">
        <PublicationsPublicationListItem
          v-for="pub in publications" :key="pub.id"
          :publication="pub" :selected="selectedIds.includes(pub.id)"
          show-project-info
          @click="router.push(`/publications/${pub.id}`)"
          @delete="(p: PublicationWithRelations) => { pubToDelete = p; showDeleteModal = true }"
          @update:selected="(v: boolean) => v ? selectedIds.push(pub.id) : selectedIds = selectedIds.filter(id => id !== pub.id)"
        />
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PublicationsPublicationCard
          v-for="pub in publications" :key="pub.id"
          :publication="pub" :selected="selectedIds.includes(pub.id)"
          show-project-info
          @click="router.push(`/publications/${pub.id}`)"
          @delete="(p: PublicationWithRelations) => { pubToDelete = p; showDeleteModal = true }"
          @update:selected="(v: boolean) => v ? selectedIds.push(pub.id) : selectedIds = selectedIds.filter(id => id !== pub.id)"
        />
      </div>
    </CommonInfiniteList>

    <PublicationsBulkToolbar
      :selected-ids="selectedIds"
      :is-archived-view="filters.archived.value === 'archived'"
      :pending="bulkActionPending"
      @clear="selectedIds = []"
      @archive="handleBulkAction('ARCHIVE')"
      @restore="handleBulkAction('UNARCHIVE')"
      @set-status="s => handleBulkAction('SET_STATUS', s)"
      @move="showBulkMoveModal = true"
      @delete="showBulkDeleteModal = true"
    />

    <UiConfirmModal v-model:open="showDeleteModal" :title="t('publication.deleteConfirm')" color="error" :loading="isDeleting" @confirm="handleDelete" />
    <UiConfirmModal v-model:open="showBulkDeleteModal" :title="t('publication.bulkDeleteConfirm', { count: selectedIds.length })" color="error" :loading="bulkActionPending" @confirm="handleBulkAction('DELETE')" />
    
    <UiConfirmModal v-model:open="showBulkMoveModal" :title="t('publication.bulk.moveTitle')" :loading="bulkActionPending" @confirm="handleBulkMove">
      <USelectMenu v-model="targetProjectIdForBulk" :items="projects.map(p => ({ id: p.id, name: p.name }))" value-key="id" label-key="name" class="mt-4" />
    </UiConfirmModal>
  </div>
</template>
