<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { PublicationStatus } from '~/types/posts'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { canGoBack, goBack: navigateBack } = useNavigation()

const projectId = computed(() => route.params.id as string)

const {
  publications,
  isLoading,
  error,
  totalCount,
  fetchPublicationsByProject,
  deletePublication,
  toggleArchive,
  getStatusDisplayName,
  getStatusColor,
} = usePublications()

// Filter state
const selectedStatus = ref<PublicationStatus | null>(null)
const showArchived = ref(false)
// const searchQuery = ref('') // Search depends on backend implementation

// Pagination state
const limit = ref(10)
const offset = ref(0)
const currentPage = computed({
  get: () => Math.floor(offset.value / limit.value) + 1,
  set: (val) => {
    offset.value = (val - 1) * limit.value
  }
})

// Delete modal state
const showDeleteModal = ref(false)
const publicationToDelete = ref<PublicationWithRelations | null>(null)
const isDeleting = ref(false)

// Create modal state
const showCreateModal = ref(false)

function openCreateModal() {
  showCreateModal.value = true
}

function handlePublicationCreated(publicationId: string) {
  // Refresh the list
  fetchPublicationsByProject(projectId.value, {
    includeArchived: showArchived.value,
    limit: limit.value,
    offset: offset.value
  })
}

// Fetch data on mount
onMounted(async () => {
  if (projectId.value) {
    await fetchPublicationsByProject(projectId.value, { 
      includeArchived: showArchived.value,
      limit: limit.value,
      offset: offset.value
    })
  }
})

// Watch for filter/pagination changes
watch([selectedStatus, showArchived, currentPage], () => {
  fetchPublicationsByProject(projectId.value, {
    status: selectedStatus.value || undefined,
    includeArchived: showArchived.value,
    limit: limit.value,
    offset: (currentPage.value - 1) * limit.value
  })
})

const statusFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  { value: 'DRAFT', label: t('postStatus.draft') },
  { value: 'SCHEDULED', label: t('postStatus.scheduled') },
  { value: 'PUBLISHED', label: t('postStatus.published') },
  { value: 'FAILED', label: t('postStatus.failed') },
])

function goToPublication(id: string) {
  // TODO: Create publication details page? Or just edit?
  router.push(`/projects/${projectId.value}/publications/${id}`)
}

function goBack() {
  navigateBack()
}

function confirmDelete(publication: PublicationWithRelations) {
  publicationToDelete.value = publication
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
    // Refresh list ? deletePublication already updates the list locally
  }
}

function cancelDelete() {
  showDeleteModal.value = false
  publicationToDelete.value = null
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function truncateContent(content: string | null | undefined, maxLength = 150): string {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

const hasActiveFilters = computed(() => {
  return selectedStatus.value
})

function resetFilters() {
  selectedStatus.value = null
  offset.value = 0
  fetchPublicationsByProject(projectId.value, { limit: limit.value, offset: 0 })
}
</script>

<template>
  <div>
    <!-- Back button -->
    <div class="mb-6">
      <UButton 
        variant="ghost" 
        color="neutral" 
        icon="i-heroicons-arrow-left" 
        :disabled="!canGoBack"
        @click="goBack"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('publication.titlePlural', 'Publications') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
           {{ totalCount }} {{ t('publication.titlePlural', 'Publications').toLowerCase() }}
        </p>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
        {{ t('publication.create') }}
      </UButton>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Status filter -->
        <USelectMenu
          v-model="selectedStatus"
          :items="statusFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('post.status')"
        />
        
        <div v-if="hasActiveFilters" class="flex items-center">
            <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-heroicons-x-mark"
            @click="resetFilters"
            >
            {{ t('common.reset') }}
            </UButton>
        </div>
      </div>
    </div>

    <!-- Archived Toggle -->
    <div class="flex items-center justify-end mb-4 px-1">
        <UToggle 
            v-model="showArchived" 
            color="primary"
        >
             <template #label>
                 <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.showArchived', 'Show Archived') }}</span>
             </template>
        </UToggle>
    </div>

    <!-- Error state -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <div class="flex items-center gap-3">
        <UIcon
          name="i-heroicons-exclamation-circle"
          class="w-5 h-5 text-red-600 dark:text-red-400"
        />
        <p class="text-red-700 dark:text-red-300">{{ error }}</p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading && publications.length === 0" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="publications.length === 0"
      class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center"
    >
      <UIcon
        name="i-heroicons-document-text"
        class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ t('post.noPostsFound', 'No publications found') }}
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6">
         {{ hasActiveFilters ? t('post.noPostsFiltered') : t('publication.createDescription') }}
      </p>
      <UButton v-if="!hasActiveFilters" icon="i-heroicons-plus" @click="openCreateModal">
        {{ t('publication.create') }}
      </UButton>
    </div>

    <!-- List -->
    <div v-else class="space-y-4">
      <div
        v-for="publication in publications"
        :key="publication.id"
        class="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
        :class="{ 'opacity-75 grayscale-[0.5]': publication.archivedAt }"
        @click="goToPublication(publication.id)"
      >
        <div class="p-4 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
               <!-- Title and status -->
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white truncate">
                  {{ publication.title || t('post.untitled', 'Untitled') }}
                </h3>
                <UBadge :color="getStatusColor(publication.status)" size="xs" variant="subtle">
                  {{ getStatusDisplayName(publication.status) }}
                </UBadge>
              </div>
              
              <!-- Content preview -->
              <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                {{ truncateContent(publication.content) }}
              </p>
              
               <!-- Meta info -->
              <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <!-- Author -->
                <span v-if="publication.creator" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-user" class="w-3.5 h-3.5" />
                  {{ publication.creator.fullName || publication.creator.telegramUsername || 'User' }}
                </span>

                <!-- Created date -->
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                  {{ formatDate(publication.createdAt) }}
                </span>
                
                <!-- Posts count (if available) -->
                <span v-if="publication._count?.posts" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-document-duplicate" class="w-3.5 h-3.5" />
                    {{ publication._count.posts }} {{ t('post.titlePlural').toLowerCase() }}
                </span>
                
                 <!-- Tags -->
                <div v-if="publication.tags" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5" />
                  <span>{{ publication.tags }}</span>
                </div>
              </div>
            </div>
            
             <!-- Actions -->
            <div class="flex items-center gap-2" @click.stop>
               <!-- Archive / Restore -->
              <UButton
                v-if="!publication.archivedAt"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-archive-box"
                size="sm"
                :title="t('common.archive', 'Archive')"
                @click="toggleArchive(publication.id, false)"
              />
              <UButton
                v-else
                color="primary"
                variant="ghost"
                icon="i-heroicons-arrow-uturn-left"
                size="sm"
                :title="t('common.restore', 'Restore')"
                @click="toggleArchive(publication.id, true)"
              />

              <!-- Hard Delete (only if archived) -->
              <UButton
                v-if="publication.archivedAt"
                color="error"
                variant="ghost"
                icon="i-heroicons-trash"
                size="sm"
                :title="t('common.deletePermanently', 'Delete Permanently')"
                @click="confirmDelete(publication)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalCount > limit" class="mt-8 flex justify-center">
      <UPagination
        v-model:model-value="currentPage"
        :total="totalCount"
        :page-count="limit"
        :prev-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-left', label: t('common.prev') }"
        :next-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-right', label: t('common.next'), trailing: true }"
      />
    </div>
    
    <!-- Create Publication Modal -->
    <ModalsCreatePublicationModal
      v-model:open="showCreateModal"
      :project-id="projectId"
      @success="handlePublicationCreated"
    />
    
    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-6 h-6 text-red-600 dark:text-red-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('post.deletePost', 'Delete Publication') }}
            </h3>
          </div>

          <p class="text-gray-600 dark:text-gray-400 mb-6">
            {{ t('post.deleteConfirm', 'Are you sure?') }}
          </p>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton color="error" :loading="isDeleting" @click="handleDelete">
              {{ t('common.delete') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
