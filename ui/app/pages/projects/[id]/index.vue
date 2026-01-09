<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
import { ArchiveEntityType } from '~/types/archive.types'
import { stripHtmlAndSpecialChars } from '~/utils/text'

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
  getRoleDisplayName,
  unarchiveProject,
} = useProjects()

const {
  publications: draftPublications,
  isLoading: isDraftsLoading,
  totalCount: draftTotal,
  fetchPublicationsByProject: fetchDrafts,
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
  getStatusDisplayName,
  getStatusColor,
} = usePublications()

const {
  channels,
  fetchChannels,
} = useChannels()

const projectId = computed(() => route.params.id as string)


// Fetch project on mount
onMounted(async () => {
  if (projectId.value) {
    await Promise.all([
      fetchProject(projectId.value),
      fetchDrafts(projectId.value, { status: 'DRAFT', limit: 5 }),
      fetchScheduled(projectId.value, { status: 'SCHEDULED', limit: 5 }),
      fetchProblems(projectId.value, { status: ['PARTIAL', 'FAILED', 'EXPIRED'], limit: 5 }),
      fetchChannels({ projectId: projectId.value, limit: 1000 })
    ])
  }
})

// Clean up on unmount
onUnmounted(() => {
  clearCurrentProject()
})

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


/**
 * Format date for display
 */
function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), 'short')
}

/**
 * Format date for display with time (until minutes)
 */
function formatDateWithTime(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 123
import type { PublicationWithRelations } from '~/composables/usePublications'

/**
 * Get display title for publication list fallback
 */
function getPublicationDisplayTitle(pub: any): string {
  let text = ''
  if (pub.title && pub.title.trim()) {
    text = stripHtmlAndSpecialChars(pub.title)
  } else if (pub.content) {
    text = stripHtmlAndSpecialChars(pub.content)
  } else if (pub.tags && pub.tags.trim()) {
    text = pub.tags
  } else if (pub.createdAt) {
    text = formatDateWithTime(pub.createdAt)
  } else {
    text = 'Untitled'
  }
  
  // Collapse whitespace and trim
  return text.replace(/\s+/g, ' ').trim().substring(0, 100)
}

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
    router.push(`/publications/${publicationId}?new=true`)
}

// Project problems detection
const { 
  getPublicationProblems, 
  getPublicationProblemLevel 
} = usePublications()

const { 
  getChannelProblems, 
  getChannelProblemLevel 
} = useChannels()

const { 
  getProjectProblems 
} = useProjects()

const projectProblems = computed(() => {
  if (!currentProject.value) return []
  const problems = getProjectProblems(currentProject.value)

  // Enrich with locally loaded channels data if available
  // This ensures missing credentials problems are shown even if project stats are incomplete
  if (channels.value && channels.value.length > 0) {
     const noCredsCount = channels.value.filter(c => !c.credentials || Object.keys(c.credentials).length === 0).length
     
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
        <UButton variant="outline" color="neutral" @click="goBack">
          {{ t('common.back') }}
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
      class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center"
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
      <UButton @click="goBack">
        {{ t('common.back') }}
      </UButton>
    </div>

    <!-- View mode -->
    <div v-else>
      <!-- Page header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
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

              <!-- Create publication buttons & Quick filters -->
              <div v-if="availableLanguages.length > 0" class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                 <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="lang in availableLanguages"
                    :key="lang"
                    color="primary"
                    variant="soft"
                    size="xs"
                    icon="i-heroicons-plus"
                    @click="openCreateModal(lang)"
                  >
                    Публикация {{ lang }}
                  </UButton>
                </div>

                <!-- Quick filters -->
                <div class="flex flex-wrap gap-2">
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :to="`/publications?projectId=${projectId}`"
                  >
                    {{ t('common.all') }}
                  </UButton>
                  <UButton
                    variant="ghost"
                    color="warning"
                    size="xs"
                    :to="`/publications?projectId=${projectId}&status=READY`"
                  >
                    {{ t('publicationStatus.ready') }}
                  </UButton>
                  <UButton
                    variant="ghost"
                    color="success"
                    size="xs"
                    :to="`/publications?projectId=${projectId}&status=PUBLISHED`"
                  >
                    {{ t('publicationStatus.published') }}
                  </UButton>
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
        <!-- Drafts Block (Only visible if has drafts) -->
        <div v-if="draftTotal > 0 || isDraftsLoading" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
              {{ t('publicationStatus.draft') }}
              <CommonCountBadge :count="draftTotal" :title="t('publicationStatus.draft')" />
            </h2>
            <div class="flex items-center gap-2">
              <UButton
                v-if="draftTotal > 5"
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-heroicons-arrow-right"
                trailing
                :to="`/publications?projectId=${projectId}&status=DRAFT`"
              >
                {{ t('common.viewAll') }}
              </UButton>
            </div>
          </div>

          <!-- Create buttons moved to header -->

          <div v-if="isDraftsLoading && !draftPublications.length" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
          </div>
          <div v-else-if="draftPublications.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <PublicationsPublicationCard
              v-for="draft in draftPublications"
              :key="draft.id"
              :publication="draft"
              :show-project-info="false"
              @click="goToPublication"
            />
          </div>
          <div v-else class="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
             <p class="text-gray-500 dark:text-gray-400 text-sm">{{ t('publication.noPublicationsDescription') }}</p>
          </div>
        </div>

        <!-- Scheduled and Problems Columns -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Scheduled Column -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
            <ul v-else-if="scheduledPublications.length > 0" class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="pub in scheduledPublications" :key="pub.id" class="py-3">
                <NuxtLink 
                  :to="`/publications/${pub.id}`"
                  class="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors line-clamp-1"
                >
                  {{ getPublicationDisplayTitle(pub) }}
                </NuxtLink>
              </li>
            </ul>
            <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              {{ t('common.noData') }}
            </div>
          </div>

          <!-- Problem Column -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
            <ul v-else-if="problemPublications.length > 0" class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="pub in problemPublications" :key="pub.id" class="py-3 flex items-center gap-3">
                <UBadge :color="getStatusColor(pub.status) as any" variant="subtle" size="xs" class="shrink-0">
                  {{ getStatusDisplayName(pub.status) }}
                </UBadge>
                <NuxtLink 
                  :to="`/publications/${pub.id}`"
                  class="text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors line-clamp-1"
                >
                  {{ getPublicationDisplayTitle(pub) }}
                </NuxtLink>
              </li>
            </ul>
            <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              {{ t('common.noData') }}
            </div>
          </div>
        </div>

        <!-- Create Publication Modal (reused) -->
        <ModalsCreatePublicationModal
          v-model:open="isCreateModalOpen"
          :project-id="projectId"
          :preselected-language="selectedLanguage"
          @success="handleCreateSuccess"
        />
      </div>

      <!-- Channels Section -->
      <div id="channels-section" class="bg-white dark:bg-gray-800 rounded-lg shadow mt-6 p-6">
        <FeaturesChannelsList :project-id="currentProject.id" />
      </div>
    </div>
  </div>
</template>
