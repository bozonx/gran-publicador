<script setup lang="ts">
import { useDashboardStore } from '~/stores/dashboard'
import type { PublicationWithRelations } from '~/composables/usePublications'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { displayName } = useAuth()
const router = useRouter()
const dashboardStore = useDashboardStore()

const isCreateModalOpen = ref(false)
function openCreateModal() {
  isCreateModalOpen.value = true
}

function handleProjectCreated(projectId: string) {
  router.push(`/projects/${projectId}`)
}

// Fetch data on mount
onMounted(async () => {
  await dashboardStore.fetchSummary()
})

const isLoading = computed(() => dashboardStore.isLoading)
const summary = computed(() => dashboardStore.summary)
const error = computed(() => dashboardStore.error)

// Projects grouped by role (kept from original)
const totalProjects = computed(() => summary.value?.projects.length || 0)
const projectsByRole = computed(() => {
  if (!summary.value) return []
  const groups: Record<string, any[]> = {}
  
  summary.value.projects.forEach(p => {
    const role = p.role || 'viewer'
    if (!groups[role]) groups[role] = []
    groups[role].push(p)
  })

  const roleOrder = ['owner', 'admin', 'editor', 'viewer']
  return roleOrder
    .filter(role => groups[role] && groups[role].length > 0)
    .map(role => ({
      role,
      projects: groups[role]!.sort((a, b) => a.name.localeCompare(b.name))
    }))
})
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('dashboard.welcome') }}, {{ displayName }}!
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.title') }}
      </p>
    </div>

    <!-- Error Alert -->
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-circle"
      color="red"
      variant="soft"
      :title="t('dashboard.summary_error', 'Failed to load dashboard data')"
      :description="error"
      class="mb-6"
    >
      <template #footer>
        <UButton size="xs" color="red" variant="ghost" @click="dashboardStore.fetchSummary()">
          {{ t('common.retry') }}
        </UButton>
      </template>
    </UAlert>

    <div class="space-y-6 sm:space-y-8">
      <!-- Recent Content Widget -->
      <DashboardRecentContentWidget 
        :items="summary?.recentContent || []" 
        :is-loading="isLoading"
        @refresh="dashboardStore.fetchSummary()"
      />

      <!-- Scheduled and Problems Columns -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Scheduled Section -->
        <div class="app-card p-4 sm:p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-5 h-5 text-sky-500" />
              {{ t('publicationStatus.scheduled') }}
              <CommonCountBadge :count="summary?.publications.scheduled.total || 0" />
            </h3>
            <UButton
              v-if="(summary?.publications.scheduled.total || 0) > 0"
              to="/publications?status=SCHEDULED&sortBy=byScheduled"
              variant="ghost"
              size="xs"
              color="primary"
              icon="i-heroicons-arrow-right"
              trailing
            >
              {{ t('common.viewAll') }}
            </UButton>
          </div>

          <div v-if="isLoading && !summary" class="flex justify-center py-4">
            <UiLoadingSpinner size="sm" />
          </div>
          
          <div v-else-if="summary?.publications.scheduled.groupedByProject.length" class="space-y-6">
            <!-- Group by Project -->
            <div v-for="group in summary.publications.scheduled.groupedByProject" :key="group.project.id">
              <div class="flex items-center gap-2 mb-2 px-2">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4 text-gray-400" />
                <NuxtLink :to="`/projects/${group.project.id}`" class="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-500 transition-colors">
                  {{ group.project.name }}
                </NuxtLink>
              </div>
              
              <div class="grid grid-cols-1 gap-2">
                <PublicationsPublicationMiniItem
                  v-for="pub in group.publications"
                  :key="pub.id"
                  :publication="pub"
                  show-date
                  date-type="scheduled"
                />
              </div>
            </div>
          </div>
          
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            {{ t('common.noData') }}
          </div>
        </div>

        <!-- Problematic Section -->
        <div class="app-card p-4 sm:p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
              {{ t('publication.filter.showIssuesOnly') }}
              <CommonCountBadge :count="summary?.publications.problems.total || 0" color="error" />
            </h3>
          </div>

          <div v-if="isLoading && !summary" class="flex justify-center py-4">
            <UiLoadingSpinner size="sm" />
          </div>
          
          <div v-else-if="summary?.publications.problems.groupedByProject.length" class="space-y-6">
             <!-- Group by Project -->
            <div v-for="group in summary.publications.problems.groupedByProject" :key="group.project.id">
              <div class="flex items-center gap-2 mb-2 px-2">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4 text-gray-400" />
                <NuxtLink :to="`/projects/${group.project.id}`" class="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-500 transition-colors">
                  {{ group.project.name }}
                </NuxtLink>
              </div>
              
              <div class="grid grid-cols-1 gap-2">
                <PublicationsPublicationMiniItem
                  v-for="pub in group.publications"
                  :key="pub.id"
                  :publication="pub"
                  show-status
                  show-date
                  date-type="scheduled"
                  is-problematic
                />
              </div>
            </div>
          </div>
          
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            {{ t('dashboard.noProblems') }}
          </div>
        </div>
      </div>

      <!-- Published in the last 24h Section -->
      <div class="app-card p-4 sm:p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            {{ t('dashboard.published_last_24h') }}
            <CommonCountBadge :count="summary?.publications.recentPublished.total || 0" color="success" />
          </h3>
          <UButton
            v-if="(summary?.publications.recentPublished.total || 0) > 0"
            to="/publications?status=PUBLISHED&sortBy=byPublished"
            variant="ghost"
            size="xs"
            color="primary"
            icon="i-heroicons-arrow-right"
            trailing
          >
            {{ t('common.viewAll') }}
          </UButton>
        </div>

        <div v-if="isLoading && !summary" class="flex justify-center py-4">
          <UiLoadingSpinner size="sm" />
        </div>

        <div v-else-if="summary?.publications.recentPublished.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PublicationsPublicationMiniItem
            v-for="pub in summary.publications.recentPublished.items"
            :key="pub.id"
            :publication="pub"
            show-date
            date-type="published"
          />
        </div>

        <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          {{ t('dashboard.no_published_last_24h') }}
        </div>
      </div>

      <!-- Projects and Channels Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
         <div class="lg:col-span-2 space-y-6">
            <div class="app-card">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {{ t('project.titlePlural') }}
                  <CommonCountBadge :count="totalProjects" :title="t('project.projectsCount')" />
                </h2>
                <UButton
                  variant="ghost"
                  size="xs"
                  color="primary"
                  icon="i-heroicons-plus"
                  @click="openCreateModal"
                >
                  {{ t('project.createProject') }}
                </UButton>
              </div>
              <div class="p-4 sm:p-5">
                <div v-if="isLoading && !summary" class="flex items-center justify-center py-4">
                  <UiLoadingSpinner />
                </div>
                <div v-else-if="totalProjects === 0" class="text-center py-8">
                  <UIcon name="i-heroicons-briefcase" class="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                  <p class="text-gray-500 dark:text-gray-400 mb-4">{{ t('project.noProjectsDescription') }}</p>
                  <UButton icon="i-heroicons-plus" size="sm" @click="openCreateModal">{{ t('project.createProject') }}</UButton>
                </div>
                <div v-else class="space-y-4">
                  <div v-for="group in projectsByRole" :key="group.role" class="space-y-2">
                    <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                      {{ t(`dashboard.group_${group.role}`) }}
                    </h3>
                    <div class="grid grid-cols-1 gap-2">
                      <ProjectsDashboardProjectListItem
                        v-for="project in group.projects"
                        :key="project.id"
                        :project="project"
                        :show-description="false"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
         </div>

         <!-- Widgets Sidebar -->
         <div class="lg:col-span-1 space-y-6">
           <ChannelsDashboardPanel :summary="summary?.channelsSummary" :is-loading="isLoading" />
         </div>
      </div>
    </div>

    <ModalsCreateProjectModal
      v-model:open="isCreateModalOpen"
      @created="handleProjectCreated"
    />
  </div>
</template>
