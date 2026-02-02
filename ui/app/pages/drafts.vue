<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { useViewMode } from '~/composables/useViewMode'
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import { LANGUAGE_OPTIONS } from '~/utils/languages'
import { SPACING, CARD_STYLES, GRID_LAYOUTS } from '~/utils/design-tokens'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const {
  publications,
  isLoading,
  totalCount,
  fetchUserDrafts,
  deletePublication
} = usePublications()

const currentPage = ref(
  route.query.page && typeof route.query.page === 'string' 
    ? Math.max(1, parseInt(route.query.page, 10) || 1)
    : 1
)

const limit = ref(DEFAULT_PAGE_SIZE)
const searchQuery = ref((route.query.search as string) || '')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

const scope = ref<'personal' | 'projects' | 'all'>((route.query.scope as any) || 'personal')
const statusFilter = ref<'DRAFT' | 'READY' | 'all'>((route.query.status as any) || 'DRAFT')

const sortBy = ref((route.query.sortBy as string) || 'createdAt')
const sortOrder = ref<'asc' | 'desc'>((route.query.sortOrder as 'asc' | 'desc') || 'desc')

const { viewMode, isListView } = useViewMode('drafts-view', 'cards')

const scopeOptions = [
  { label: t('drafts.filters.scope.personal'), value: 'personal' },
  { label: t('drafts.filters.scope.projects'), value: 'projects' },
  { label: t('drafts.filters.scope.all'), value: 'all' },
]

const statusOptionsByStatus = [
  { label: t('drafts.filters.status.draft'), value: 'DRAFT' },
  { label: t('drafts.filters.status.ready'), value: 'READY' },
  { label: t('drafts.filters.status.all'), value: 'all' },
]

// Reactive fetch with automatic refetch on dependency changes
watch([debouncedSearch, sortBy, sortOrder, currentPage, scope, statusFilter], async () => {
  await fetchUserDrafts({
    limit: limit.value,
    offset: (currentPage.value - 1) * limit.value,
    search: debouncedSearch.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    scope: scope.value,
    status: statusFilter.value === 'all' ? ['DRAFT', 'READY'] : statusFilter.value,
  })

  // Update URL
  router.replace({
    query: {
      ...route.query,
      search: searchQuery.value || undefined,
      scope: scope.value,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      page: currentPage.value > 1 ? String(currentPage.value) : undefined,
    }
  })
}, { immediate: true })

// Reset to page 1 when search/sort/filters change
watch([debouncedSearch, sortBy, sortOrder, scope, statusFilter], () => {
  currentPage.value = 1
})

function goToDraft(pub: PublicationWithRelations) {
    router.push(`/publications/${pub.id}`)
}

const isCreateModalOpen = ref(false)

function openCreateModal() {
    isCreateModalOpen.value = true
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
    // Refetch will happen automatically via watch
  }
}
</script>

<template>
  <div :class="SPACING.cardGap">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('drafts.page_title') }}
          <CommonCountBadge :count="totalCount" />
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('drafts.description') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <CommonViewToggle v-model="viewMode" />
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          @click="openCreateModal"
        >
          {{ t('common.create') }}
        </UButton>
      </div>
    </div>

    <div :class="[CARD_STYLES.base, CARD_STYLES.paddingNormal, 'flex flex-col md:flex-row gap-4']">
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
      <div class="flex flex-wrap gap-2">
        <UiAppButtonGroup
          v-model="scope"
          :options="scopeOptions"
          size="md"
        />
        <UiAppButtonGroup
          v-model="statusFilter"
          :options="statusOptionsByStatus"
          size="md"
        />
      </div>
    </div>

    <div v-if="isLoading && publications.length === 0" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="publications.length === 0" :class="[CARD_STYLES.base, 'p-12 text-center']">
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-pencil-square" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('drafts.no_drafts') }}
        </h3>
        <UButton color="primary" variant="subtle" @click="openCreateModal">
          {{ t('drafts.create_first') }}
        </UButton>
    </div>

    <div v-else :class="isListView ? SPACING.cardGap : GRID_LAYOUTS.threeColumn">
        <template v-if="isListView">
          <PublicationsPublicationListItem
            v-for="pub in publications"
            :key="pub.id"
            :publication="pub"
            @click="goToDraft"
            @delete="confirmDelete"
          />
        </template>
        <template v-else>
          <PublicationsPublicationCard
            v-for="pub in publications"
            :key="pub.id"
            :publication="pub"
            @click="goToDraft"
            @delete="confirmDelete"
          />
        </template>
    </div>

    <div v-if="totalCount > limit" class="flex justify-center mt-6">
      <UPagination
        v-model="currentPage"
        :total="totalCount"
        :page-count="limit"
      />
    </div>

    <UiConfirmModal
      v-if="showDeleteModal"
      v-model:open="showDeleteModal"
      :title="t('publication.delete')"
      :description="t('publication.deleteConfirm')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="handleDelete"
    />

    <ModalsCreatePublicationModal
      v-if="isCreateModalOpen"
      v-model:open="isCreateModalOpen"
    />
  </div>
</template>
