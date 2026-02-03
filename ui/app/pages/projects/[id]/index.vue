<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { eventBus } from '~/utils/events'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
import { ArchiveEntityType } from '~/types/archive.types'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { isChannelCredentialsEmpty } from '~/utils/channels'

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
  fetchPublicationsByProject: fetchRecentPublished,
} = usePublications()

const {
  channels,
  fetchChannels,
} = useChannels()

const projectId = computed(() => {
  const id = route.params.id
  return (Array.isArray(id) ? id[0] : id) || ''
})


// Fetch project on mount
onMounted(async () => {
  if (projectId.value) {
    await initialFetch()
  }
  eventBus.on('channel:created', handleChannelCreatedEvent)
})

// Clean up on unmount
onUnmounted(() => {
  clearCurrentProject()
  eventBus.off('channel:created', handleChannelCreatedEvent)
})

async function initialFetch() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await Promise.all([
    fetchProject(projectId.value),
    fetchDrafts(projectId.value, { status: 'DRAFT', limit: 5 }),
    fetchReady(projectId.value, { status: 'READY', limit: 5 }),
    fetchRecentPublished(projectId.value, { 
      status: 'PUBLISHED', 
      publishedAfter: yesterday,
      limit: 10,
      sortBy: 'byPublished',
      sortOrder: 'desc'
    }),
    fetchScheduled(projectId.value, { status: 'SCHEDULED', limit: 5 }),
    fetchProblems(projectId.value, { status: ['PARTIAL', 'FAILED', 'EXPIRED'], limit: 5 }),
    fetchChannels({ projectId: projectId.value, limit: 100 })
  ])
}

const activeDraftsTab = ref('DRAFT')
const currentDraftsPublications = computed(() => activeDraftsTab.value === 'DRAFT' ? draftPublications.value : readyPublications.value)
const currentDraftsTotal = computed(() => activeDraftsTab.value === 'DRAFT' ? draftTotal.value : readyTotal.value)
const isCurrentDraftsLoading = computed(() => activeDraftsTab.value === 'DRAFT' ? isDraftsLoading.value : isReadyLoading.value)
const currentDraftsViewAllLink = computed(() => `/publications?projectId=${projectId.value}&status=${activeDraftsTab.value}`)

function handleChannelCreatedEvent(channel: any) {
  if (channel && channel.projectId === projectId.value) {
    // We only need to refresh channels specifically
    fetchChannels({ projectId: projectId.value, limit: 100 })
  }
}

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
  if (!channels.value || channels.value.length === 0) return []
  
  const languagesSet = new Set(channels.value.map(ch => ch.language))
  return Array.from(languagesSet).sort()
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

const { 
  getChannelProblems, 
  getChannelProblemLevel 
} = useChannels()

const projectProblems = computed(() => {
  if (!currentProject.value) return []
  const problems = getProjectProblems(currentProject.value)

  // Enrich with locally loaded channels data if available
  // This ensures missing credentials problems are shown even if project stats are incomplete
  if (channels.value && channels.value.length > 0) {
     const noCredsCount = channels.value.filter(c => isChannelCredentialsEmpty(c.credentials, c.socialMedia)).length
     
     // Update or add 'noCredentials' problem
     const existingProblem = problems.find(p => p.key === 'noCredentials')
     if (existingProblem) {
         existingProblem.count = noCredsCount
     } else if (noCredsCount > 0) {
         problems.push({ type: 'critical', key: 'noCredentials', count: noCredsCount })
     }
  }

  return problems
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
    if (activeDraftsTab.value === 'DRAFT') {
      fetchDrafts(projectId.value, { status: 'DRAFT', limit: 5 })
    } else {
      fetchReady(projectId.value, { status: 'READY', limit: 5 })
    }
  }
}
</script>

<template>
  <div>
    <!-- Back button and breadcrumb -->
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
      class="app-card p-12 text-center"
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
        <div class="p-6">
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

              <p v-if="currentProject.description" class="text-gray-600 dark:text-gray-400 mb-4">
                {{ currentProject.description }}
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
          
          v-model:active-tab="activeDraftsTab"
          :publications="currentDraftsPublications"
          :total-count="currentDraftsTotal"
          :loading="isCurrentDraftsLoading"
          :view-all-to="currentDraftsViewAllLink"
          @delete="confirmDelete"
        />

        <!-- Scheduled and Problems Columns -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Scheduled Column -->
          <div class="app-card p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="w-5 h-5 text-sky-500" />
                {{ t('publicationStatus.scheduled') }}
                <CommonCountBadge :count="scheduledTotal" />
              </h3>
              <UButton
                v-if="scheduledTotal > 5"
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-arrow-right"
                trailing
                :to="`/publications?projectId=${projectId}&status=SCHEDULED`"
              >
                {{ t('common.viewAll') }}
              </UButton>
            </div>

            <div v-if="isScheduledLoading && !scheduledPublications.length" class="flex justify-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
            </div>
            <div v-else-if="scheduledPublications.length > 0" class="grid grid-cols-1 gap-2">
              <PublicationsPublicationMiniItem
                v-for="pub in scheduledPublications"
                :key="pub.id"
                :publication="pub"
                show-date
                date-type="scheduled"
              />
            </div>
            <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              {{ t('common.noData') }}
            </div>
          </div>

          <!-- Problem Column -->
          <div class="app-card p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
                {{ t('publication.filter.showIssuesOnly') }}
                <CommonCountBadge :count="problemsTotal" color="error" />
              </h3>
              <UButton
                v-if="problemsTotal > 5"
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-arrow-right"
                trailing
                :to="`/publications?projectId=${projectId}&status=PARTIAL,FAILED,EXPIRED`"
              >
                {{ t('common.viewAll') }}
              </UButton>
            </div>

            <div v-if="isProblemsLoading && !problemPublications.length" class="flex justify-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
            </div>
            <div v-else-if="problemPublications.length > 0" class="grid grid-cols-1 gap-2">
              <PublicationsPublicationMiniItem
                v-for="pub in problemPublications"
                :key="pub.id"
                :publication="pub"
                show-status
                show-date
                date-type="scheduled"
                is-problematic
              />
            </div>
            <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              {{ t('common.noData') }}
            </div>
          </div>
        </div>

        <!-- Published in the last 24h Section -->
        <div class="app-card p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
              {{ t('dashboard.published_last_24h', 'Published last 24h') }}
              <CommonCountBadge :count="publishedTotal" color="success" />
            </h3>
            <UButton
              v-if="publishedTotal > 0"
              :to="`/publications?projectId=${projectId}&status=PUBLISHED&sortBy=byPublished`"
              variant="ghost"
              size="xs"
              color="primary"
              icon="i-heroicons-arrow-right"
              trailing
            >
              {{ t('common.viewAll') }}
            </UButton>
          </div>

          <div v-if="isPublishedLoading && !publishedPublications.length" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
          </div>

          <div v-else-if="publishedPublications.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PublicationsPublicationMiniItem
              v-for="pub in publishedPublications"
              :key="pub.id"
              :publication="pub"
              show-date
              date-type="scheduled"
            />
          </div>

          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            {{ t('dashboard.no_published_last_24h', 'No publications were published in the last 24 hours') }}
          </div>
        </div>

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
      <div id="channels-section" class="app-card mt-6 p-6">
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
