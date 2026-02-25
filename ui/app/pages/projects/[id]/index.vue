<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjects } from '~/composables/useProjects'
import { ArchiveEntityType } from '~/types/archive.types'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const router = useRouter()
const route = useRoute()
const { canGoBack, goBack: navigateBack } = useNavigation()

const {
  currentProject,
  isLoading,
  error,
  fetchProject,
  clearCurrentProject,
  canEdit,
  unarchiveProject,
} = useProjects()

import { useRoles } from '~/composables/useRoles'
const { getRoleDisplayName } = useRoles()

const {
  publications: draftPublications,
  isLoading: isDraftsLoading,
  totalCount: draftTotal,
  fetchPublicationsByProject: fetchDrafts,
  deletePublication
} = usePublications()

const {
  publications: readyPublications,
  isLoading: isReadyLoading,
  totalCount: readyTotal,
  fetchPublicationsByProject: fetchReady,
} = usePublications()

const {
  publications: scheduledPublications,
  isLoading: isScheduledLoading,
  totalCount: scheduledTotal,
  fetchPublicationsByProject: fetchScheduled,
} = usePublications()

const {
  publications: problemPublications,
  isLoading: isProblemsLoading,
  totalCount: problemsTotal,
  fetchPublicationsByProject: fetchProblems,
} = usePublications()

const {
  publications: publishedPublications,
  isLoading: isPublishedLoading,
  totalCount: publishedTotal,
  fetchPublicationsByProject: fetchPublished,
} = usePublications()

const scheduledOffset = ref(0)
const problemsOffset = ref(0)
const publishedOffset = ref(0)
const LIMIT = 10

const hasMoreScheduled = computed(() => scheduledPublications.value.length < scheduledTotal.value)
const hasMoreProblems = computed(() => problemPublications.value.length < problemsTotal.value)
const hasMorePublished = computed(() => publishedPublications.value.length < publishedTotal.value)

async function loadMoreScheduled() {
  if (isScheduledLoading.value || !hasMoreScheduled.value) return
  scheduledOffset.value += LIMIT
  await fetchScheduled(projectId.value, { 
    status: 'SCHEDULED', 
    limit: LIMIT, 
    offset: scheduledOffset.value,
    sortBy: 'byScheduled',
    sortOrder: 'asc'
  }, { append: true })
}

async function loadMoreProblems() {
  if (isProblemsLoading.value || !hasMoreProblems.value) return
  problemsOffset.value += LIMIT
  await fetchProblems(projectId.value, { 
    status: ['PARTIAL', 'FAILED', 'EXPIRED'], 
    limit: LIMIT, 
    offset: problemsOffset.value,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }, { append: true })
}

async function loadMorePublished() {
  if (isPublishedLoading.value || !hasMorePublished.value) return
  publishedOffset.value += LIMIT
  await fetchPublished(projectId.value, { 
    status: 'PUBLISHED', 
    limit: LIMIT, 
    offset: publishedOffset.value,
    sortBy: 'byPublished',
    sortOrder: 'desc'
  }, { append: true })
}

const projectId = computed(() => {
  const id = route.params.id
  return (Array.isArray(id) ? id[0] : id) || ''
})


// Fetch project on mount
onMounted(async () => {
  if (projectId.value) {
    await initialFetch()
  }
})

// Clean up on unmount
onUnmounted(() => {
  clearCurrentProject()
})

watch(
  projectId,
  async (newId, oldId) => {
    if (!newId || newId === oldId) return
    await initialFetch()
  },
)

async function initialFetch() {
  scheduledOffset.value = 0
  problemsOffset.value = 0
  publishedOffset.value = 0
  
  // 1. Fetch project first to get the summary
  const project = await fetchProject(projectId.value)
  if (!project) return

  // 2. Fetch only necessary sections based on summary
  const summary = project.publicationsSummary || { DRAFT: 0, READY: 0, SCHEDULED: 0, PUBLISHED: 0, ISSUES: 0 }
  
  const tasks: Promise<any>[] = []

  if (summary.DRAFT > 0) tasks.push(fetchDrafts(projectId.value, { status: 'DRAFT', limit: 5 }))
  if (summary.READY > 0) tasks.push(fetchReady(projectId.value, { status: 'READY', limit: 5 }))
  if (summary.PUBLISHED > 0) {
    tasks.push(fetchPublished(projectId.value, { 
      status: 'PUBLISHED', 
      limit: LIMIT,
      sortBy: 'byPublished',
      sortOrder: 'desc'
    }))
  }
  if (summary.SCHEDULED > 0) {
    tasks.push(fetchScheduled(projectId.value, { 
      status: 'SCHEDULED', 
      limit: LIMIT,
      sortBy: 'byScheduled',
      sortOrder: 'asc'
    }))
  }
  if (summary.ISSUES > 0) {
    tasks.push(fetchProblems(projectId.value, { 
      status: ['PARTIAL', 'FAILED', 'EXPIRED'], 
      limit: LIMIT,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }))
  }

  await Promise.all(tasks)
}

const activeDraftsCollection = ref('DRAFT')
const currentDraftsPublications = computed(() => activeDraftsCollection.value === 'DRAFT' ? draftPublications.value : readyPublications.value)
const currentDraftsTotal = computed(() => activeDraftsCollection.value === 'DRAFT' ? draftTotal.value : readyTotal.value)
const isCurrentDraftsLoading = computed(() => activeDraftsCollection.value === 'DRAFT' ? isDraftsLoading.value : isReadyLoading.value)
const currentDraftsViewAllLink = computed(() => `/publications?projectId=${projectId.value}&status=${activeDraftsCollection.value}`)

/**
 * Navigate back to projects list
 */
function goBack() {
  navigateBack()
}

/**
 * Get role badge color based on role
 */
import { getRoleBadgeColor } from '~/utils/roles'

/**
 * Get unique languages from project channels
 */
const availableLanguages = computed(() => {
  const langs = currentProject.value?.languages
  if (!langs || langs.length === 0) return []
  return [...langs].sort()
})


const { getPublicationDisplayTitle, formatDateWithTime } = useFormatters()

function goToPublication(pub: PublicationWithRelations) {
    router.push(`/publications/${pub.id}`)
}

// Create Modal State
const isCreateModalOpen = ref(false)
const selectedLanguage = ref<string>('en-US')

function openCreateModal(lang: string) {
    selectedLanguage.value = lang
    isCreateModalOpen.value = true
}

function handleCreateSuccess(publicationId: string) {
    isCreateModalOpen.value = false
    // Navigate to the new publication or refresh list
    // The user wanted the modal to just work. Navigate to the new publication seems appropriate.
    router.push(`/publications/${publicationId}/edit`)
}

// Project problems detection
const { 
  getPublicationProblems, 
  getPublicationProblemLevel 
} = usePublications()

const { 
  getProjectProblems 
} = useProjects()

const projectProblems = computed(() => {
  if (!currentProject.value) return []
  return getProjectProblems(currentProject.value)
})

// Delete Publication Logic
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
    if (activeDraftsCollection.value === 'DRAFT') {
      fetchDrafts(projectId.value, { status: 'DRAFT', limit: 5 })
    } else {
      fetchReady(projectId.value, { status: 'READY', limit: 5 })
    }
  }
}
</script>

<template>
  <div>
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
      <div class="mt-4">
        <UButton variant="outline" color="neutral" to="/">
          {{ t('common.toHome') }}
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading && !currentProject" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Project not found -->
    <div
      v-else-if="!currentProject"
      class="app-card p-6 sm:p-12 text-center"
    >
      <UIcon
        name="i-heroicons-document-magnifying-glass"
        class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ t('errors.notFound') }}
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6">
        The project you're looking for doesn't exist or you don't have access to it.
      </p>
      <UButton to="/">
        {{ t('common.toHome') }}
      </UButton>
    </div>

    <!-- View mode -->
    <div v-else>
      <!-- Page header -->
      <div class="app-card mb-6 overflow-hidden">
        <div class="p-4 sm:p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {{ currentProject.name }}
                </h1>
                <UBadge :color="getRoleBadgeColor(currentProject.role)" variant="subtle">
                  {{ getRoleDisplayName(currentProject.role) }}
                </UBadge>
              </div>

              <p v-if="currentProject.note" class="text-gray-600 dark:text-gray-400 mb-4">
                {{ currentProject.note }}
              </p>

              <div
                class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400"
              >
                <span v-if="currentProject.owner" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-user" class="w-4 h-4" />
                  {{ t('project.owner') }}:
                  {{ currentProject.owner.fullName || currentProject.owner.telegramUsername || 'Unknown' }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-users" class="w-4 h-4" />
                  {{ t('project.members') }}: {{ currentProject.memberCount || 0 }}
                </span>

                <div v-if="currentProject.lastPublicationAt" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  <span>{{ t('project.lastPublication', 'Last publication') }}:</span>
                  <NuxtLink 
                    :to="`/publications/${currentProject.lastPublicationId}`"
                    class="text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-colors font-medium border-b border-dotted border-primary-500/50"
                  >
                    {{ formatDateWithTime(currentProject.lastPublicationAt) }}
                  </NuxtLink>
                </div>
              </div>

            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 ml-4">
              <UButton
                v-if="canEdit(currentProject)"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-cog-6-tooth"
                :to="`/projects/${currentProject.id}/settings`"
              />
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div v-if="availableLanguages.length > 0" class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="lang in availableLanguages"
              :key="lang"
              color="primary"
              variant="solid"
              size="sm"
              icon="i-heroicons-plus"
              @click="openCreateModal(lang)"
            >
              {{ t('publication.create_for_lang', { lang }, `Publication ${lang}`) }}
            </UButton>
          </div>

          <!-- Quick filters -->
          <div class="flex flex-wrap gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-newspaper"
              :to="`/projects/${currentProject.id}/news`"
            >
              {{ t('news.news_selections') }}
            </UButton>

            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-archive-box"
              :to="`/projects/${currentProject.id}/content-library`"
            >
              {{ t('contentLibrary.title', 'Content library') }}
            </UButton>
            
            <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 self-center mx-1" />

            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              :to="`/publications?projectId=${projectId}`"
            >
              {{ t('publication.filter.all') }}
            </UButton>
            <UButton
              variant="ghost"
              color="warning"
              size="sm"
              :to="`/publications?projectId=${projectId}&status=READY`"
            >
              {{ t('publication.filter.ready') }}
            </UButton>
            <UButton
              variant="ghost"
              color="success"
              size="sm"
              :to="`/publications?projectId=${projectId}&status=PUBLISHED`"
            >
              {{ t('publication.filter.published') }}
            </UButton>
          </div>
        </div>
      </div>
 
      <!-- Archived Status Banner -->
      <CommonArchivedBanner
        v-if="currentProject.archivedAt"
        :title="t('project.archived_notice', 'Project is archived')"
        :description="t('project.archived_info_banner', 'Archived projects are hidden from the main list but their data is preserved.')"
        :entity-type="ArchiveEntityType.PROJECT"
        :entity-id="currentProject.id"
        @restore="() => fetchProject(projectId)"
      />

      <!-- Problems Banner -->
      <div v-if="projectProblems.length > 0" class="mt-6">
        <CommonProblemBanner
          :problems="projectProblems"
          entity-type="project"
        />
      </div>

      <!-- Publications Section -->
      <div class="space-y-6 mt-6">
        <PublicationsDraftsSection
          v-if="currentProject?.publicationsSummary && (currentProject.publicationsSummary.DRAFT > 0 || currentProject.publicationsSummary.READY > 0)"
          v-model:active-collection="activeDraftsCollection"
          :publications="currentDraftsPublications"
          :total-count="currentDraftsTotal"
          :loading="isCurrentDraftsLoading"
          :view-all-to="currentDraftsViewAllLink"
          @delete="confirmDelete"
        />

        <!-- Scheduled and Problems Columns -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Scheduled Column -->
          <PublicationsInfiniteBlock
            v-if="(currentProject?.publicationsSummary?.SCHEDULED ?? 0) > 0 || isScheduledLoading"
            :title="t('publicationStatus.scheduled')"
            icon="i-heroicons-clock"
            icon-color="text-sky-500"
            :publications="scheduledPublications"
            :total-count="scheduledTotal"
            :loading="isScheduledLoading"
            :has-more="hasMoreScheduled"
            :view-all-to="`/publications?projectId=${projectId}&status=SCHEDULED&sortBy=byScheduled&sortOrder=asc`"
            show-date
            date-type="scheduled"
            @load-more="loadMoreScheduled"
          />

          <!-- Problem Column -->
          <PublicationsInfiniteBlock
            v-if="(currentProject?.publicationsSummary?.ISSUES ?? 0) > 0 || isProblemsLoading"
            :title="t('publication.filter.showIssuesOnly')"
            icon="i-heroicons-exclamation-triangle"
            icon-color="text-red-500"
            :publications="problemPublications"
            :total-count="problemsTotal"
            :loading="isProblemsLoading"
            :has-more="hasMoreProblems"
            :view-all-to="`/publications?projectId=${projectId}&status=PARTIAL,FAILED,EXPIRED&sortBy=createdAt&sortOrder=desc`"
            show-status
            show-date
            date-type="scheduled"
            is-problematic
            @load-more="loadMoreProblems"
          />
        </div>

        <!-- Published Section -->
        <PublicationsInfiniteBlock
          v-if="(currentProject?.publicationsSummary?.PUBLISHED ?? 0) > 0 || isPublishedLoading"
          :title="t('publication.filter.published')"
          icon="i-heroicons-check-circle"
          icon-color="text-green-500"
          :publications="publishedPublications"
          :total-count="publishedTotal"
          :loading="isPublishedLoading"
          :has-more="hasMorePublished"
          :view-all-to="`/publications?projectId=${projectId}&status=PUBLISHED&sortBy=byPublished&sortOrder=desc`"
          show-date
          date-type="scheduled"
          @load-more="loadMorePublished"
        />

        <!-- Create Publication Modal (reused) -->
        <ModalsCreatePublicationModal
          v-if="isCreateModalOpen"
          v-model:open="isCreateModalOpen"
          :project-id="projectId"
          :preselected-language="selectedLanguage"
          @success="handleCreateSuccess"
        />
      </div>

      <!-- Channels Section -->
      <div id="channels-section" class="app-card mt-6 p-4 sm:p-6">
        <FeaturesChannelsList :project-id="currentProject.id" />
      </div>
      </div>
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
  </div>
</template>
