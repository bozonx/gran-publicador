<script setup lang="ts">
import { useDashboard } from '~/composables/useDashboard'
import type { PublicationWithRelations } from '~/composables/usePublications'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { displayName } = useAuth()
const router = useRouter()
const { summary, isLoading, error, fetchSummary } = useDashboard()

const isCreateModalOpen = ref(false)
function openCreateModal() {
  isCreateModalOpen.value = true
}

function handleProjectCreated(projectId: string) {
  router.push(`/projects/${projectId}`)
}

// Fetch data on mount
onMounted(async () => {
  await fetchSummary()
})

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
      color="error"
      variant="soft"
      :title="t('dashboard.summary_error', 'Failed to load dashboard data')"
      :description="error"
      class="mb-6"
    >
      <template #footer>
        <UButton size="xs" color="error" variant="ghost" @click="fetchSummary()">
          {{ t('common.retry') }}
        </UButton>
      </template>
    </UAlert>

    <div :class="SPACING.sectionGap">
      <!-- Recent Content Widget -->
      <DashboardRecentContentWidget 
        :items="summary?.recentContent || []" 
        :is-loading="isLoading"
        @refresh="fetchSummary()"
      />

      <!-- Scheduled and Problems Columns -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Scheduled Section -->
        <DashboardSection
          :title="t('publicationStatus.scheduled')"
          icon="i-heroicons-clock"
          icon-class="text-sky-500"
          :badge-count="summary?.publications.scheduled.total"
          :is-loading="isLoading && !summary"
          :is-empty="!summary?.publications.scheduled.groupedByProject.length"
          view-all-link="/publications?status=SCHEDULED&sortBy=byScheduled"
        >
          <div class="space-y-6">
            <!-- Group by Project -->
            <div v-for="group in summary?.publications.scheduled.groupedByProject" :key="group.project.id">
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
        </DashboardSection>

        <!-- Problematic Section -->
        <DashboardSection
          :title="t('publication.filter.showIssuesOnly')"
          icon="i-heroicons-exclamation-triangle"
          icon-class="text-red-500"
          :badge-count="summary?.publications.problems.total"
          badge-color="error"
          :is-loading="isLoading && !summary"
          :is-empty="!summary?.publications.problems.groupedByProject.length"
          :empty-text="t('dashboard.noProblems')"
        >
          <div class="space-y-6">
             <!-- Group by Project -->
            <div v-for="group in summary?.publications.problems.groupedByProject" :key="group.project.id">
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
        </DashboardSection>
      </div>

      <!-- Published in the last 24h Section -->
      <DashboardSection
        :title="t('dashboard.published_last_24h')"
        icon="i-heroicons-check-circle"
        icon-class="text-green-500"
        :badge-count="summary?.publications.recentPublished.total"
        badge-color="success"
        :is-loading="isLoading && !summary"
        :is-empty="!summary?.publications.recentPublished.items.length"
        :empty-text="t('dashboard.no_published_last_24h')"
        view-all-link="/publications?status=PUBLISHED&sortBy=byPublished"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PublicationsPublicationMiniItem
            v-for="pub in summary?.publications.recentPublished.items"
            :key="pub.id"
            :publication="pub"
            show-date
            date-type="published"
          />
        </div>
      </DashboardSection>

      <!-- Projects and Channels Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
         <div class="lg:col-span-2 space-y-6">
            <DashboardSection
              :title="t('project.titlePlural')"
              :badge-count="totalProjects"
              :is-loading="isLoading && !summary"
              :is-empty="totalProjects === 0"
              :ui="{ header: 'border-b border-gray-200 dark:border-gray-700 pb-4 -mx-6 px-6', card: 'p-0 sm:p-0' }"
            >
              <template #header-actions>
                <UButton
                  variant="ghost"
                  size="xs"
                  color="primary"
                  icon="i-heroicons-plus"
                  @click="openCreateModal"
                >
                  {{ t('project.createProject') }}
                </UButton>
              </template>

              <div class="p-4 sm:p-5">
                <div v-if="totalProjects === 0" class="text-center py-8">
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
            </DashboardSection>
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
