<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
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
  getRoleDisplayName,
  unarchiveProject,
} = useProjects()

const {
  publications: draftPublications,
  isLoading: isDraftsLoading,
  fetchPublicationsByProject,
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
      fetchPublicationsByProject(projectId.value, { status: 'DRAFT', limit: 5 }),
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
    router.push(`/projects/${projectId.value}/publications/${publicationId}?new=true`)
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

const projectProblems = computed(() => {
  const problems: Array<{ type: 'critical' | 'warning', key: string, count?: number }> = []
  
  if (!currentProject.value) return problems
  
  // Count channels with problems
  let criticalChannels = 0
  let warningChannels = 0
  
  if (channels.value && Array.isArray(channels.value)) {
    channels.value.forEach((channel: any) => {
      const level = getChannelProblemLevel(channel)
      if (level === 'critical') criticalChannels++
      if (level === 'warning') warningChannels++
    })
  }
  
  if (criticalChannels > 0) {
    problems.push({ 
      type: 'critical', 
      key: 'criticalChannels', 
      count: criticalChannels 
    })
  }
  
  if (warningChannels > 0) {
    problems.push({ 
      type: 'warning', 
      key: 'warningChannels', 
      count: warningChannels 
    })
  }

  // Check for problematic publications
  if (currentProject.value.problemPublicationsCount && currentProject.value.problemPublicationsCount > 0) {
    problems.push({
      type: 'warning',
      key: 'problemPublications',
      count: currentProject.value.problemPublicationsCount
    })
  }
  
  // Check for stale channels
  if (currentProject.value.staleChannelsCount && currentProject.value.staleChannelsCount > 0) {
    problems.push({ 
      type: 'warning', 
      key: 'staleChannels', 
      count: currentProject.value.staleChannelsCount 
    })
  }
  
  // Check for no recent activity
  if (currentProject.value.lastPublicationAt) {
    const lastDate = new Date(currentProject.value.lastPublicationAt).getTime()
    const now = new Date().getTime()
    const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24)
    
    if (diffDays > 3) {
      problems.push({ type: 'warning', key: 'noRecentActivity' })
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
                    :to="`/projects/${currentProject.id}/publications/${currentProject.lastPublicationId}`"
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
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow mt-6 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-gray-400" />
            {{ t('publication.publicationsBlock') }}
            <CommonCountBadge :count="currentProject.publicationsCount" :title="t('publication.publicationsCount')" />
          </h2>
          <div class="flex items-center gap-2">
            <UButton
              variant="soft"
              color="warning"
              size="xs"
              :to="`/publications?projectId=${projectId}&status=READY`"
            >
              {{ t('postStatus.ready') }}
            </UButton>
            <UButton
              variant="soft"
              color="success"
              size="xs"
              :to="`/publications?projectId=${projectId}&status=PUBLISHED`"
            >
              {{ t('postStatus.published') }}
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-arrow-right"
              trailing
              :to="`/publications?projectId=${projectId}`"
            >
              {{ t('common.viewAll') }}
            </UButton>
          </div>
        </div>

        <!-- Create publication buttons by language -->
        <div v-if="availableLanguages.length > 0" class="mb-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {{ t('publication.createInLanguage') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="lang in availableLanguages"
              :key="lang"
              color="primary"
              icon="i-heroicons-plus"
              @click="openCreateModal(lang)"
            >
              {{ lang }}
            </UButton>
          </div>
        </div>

        <!-- Create Publication Modal -->
        <ModalsCreatePublicationModal
          v-model:open="isCreateModalOpen"
          :project-id="projectId"
          :preselected-language="selectedLanguage"
          @success="handleCreateSuccess"
        />

        <!-- Draft publications list -->
        <div v-if="draftPublications.length > 0" class="mt-6">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('postStatus.draft') }}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PublicationsPublicationDraftCard
              v-for="draft in draftPublications"
              :key="draft.id"
              :draft="draft"
              :project-id="projectId"
            />
          </div>
        </div>
      </div>

      <!-- Channels Section -->
      <div id="channels-section" class="bg-white dark:bg-gray-800 rounded-lg shadow mt-6 p-6">
        <FeaturesChannelsList :project-id="currentProject.id" />
      </div>
    </div>
  </div>
</template>
