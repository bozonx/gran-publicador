<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { usePublications } from '~/composables/usePublications'
import { useChannels } from '~/composables/useChannels'
import type { ProjectWithRole } from '~/stores/projects'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { stripHtmlAndSpecialChars } from '~/utils/text'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const { displayName } = useAuth()
const router = useRouter()

// Projects data
const { projects, fetchProjects, isLoading: projectsLoading } = useProjects()

// Drafts data
const { 
  publications: draftPublications, 
  fetchUserPublications: fetchDrafts, 
  totalCount: draftsCount, 
  isLoading: draftsLoading 
} = usePublications()

// Scheduled data
const { 
  publications: scheduledPublications, 
  fetchUserPublications: fetchScheduled, 
  totalCount: scheduledCount, 
  isLoading: scheduledLoading 
} = usePublications()

// Problems data
const { 
  publications: problemPublications, 
  fetchUserPublications: fetchProblems, 
  totalCount: problemsCount, 
  isLoading: problemsLoading,
} = usePublications()

// Recently Published data
const {
  publications: publishedPublications,
  fetchUserPublications: fetchRecentPublished,
  totalCount: publishedCount,
  isLoading: publishedLoading
} = usePublications()

// Fetch data on mount
onMounted(async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await Promise.all([
      fetchProjects(),
      fetchDrafts({ status: 'DRAFT', limit: 5 }),
      fetchRecentPublished({ 
        status: 'PUBLISHED', 
        publishedAfter: yesterday,
        limit: 10,
        sortBy: 'byPublished',
        sortOrder: 'desc'
      }),
      fetchScheduled({ status: 'SCHEDULED', limit: 20 }),
      fetchProblems({ status: ['PARTIAL', 'FAILED', 'EXPIRED'], limit: 20 })
    ])
  } catch (err) {
    console.error('Dashboard initialization error:', err)
  }
})

const { getPublicationDisplayTitle, formatDateWithTime } = useFormatters()

// Group scheduled publications by project
const scheduledByProject = computed(() => {
  const groups: Record<string, { project: { id: string, name: string }, publications: PublicationWithRelations[] }> = {}
  
  scheduledPublications.value.forEach(pub => {
    if (!pub.project) return
    if (!groups[pub.project.id]) {
      groups[pub.project.id] = { project: pub.project, publications: [] }
    }
    groups[pub.project.id]!.publications.push(pub)
  })
  
  return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name))
})

// Group problem publications by project
const problemsByProject = computed(() => {
  const groups: Record<string, { project: { id: string, name: string }, publications: PublicationWithRelations[] }> = {}
  
  problemPublications.value.forEach(pub => {
    if (!pub.project) return
    if (!groups[pub.project.id]) {
      groups[pub.project.id] = { project: pub.project, publications: [] }
    }
    groups[pub.project.id]!.publications.push(pub)
  })
  
  return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name))
})

// Projects grouped by role (kept from original)
const totalProjects = computed(() => projects.value.length)
const projectsByRole = computed(() => {
  const groups: Record<string, ProjectWithRole[]> = {}
  
  projects.value.forEach(p => {
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

function goToPublication(pub: PublicationWithRelations) {
    if (pub.id) {
        router.push(`/publications/${pub.id}`)
    }
}
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('dashboard.welcome') }}, {{ displayName }}!
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.title') }}
      </p>
    </div>

    <div class="space-y-8">
      <PublicationsDraftsSection
        :publications="draftPublications"
        :total-count="draftsCount"
        :loading="draftsLoading"
        view-all-to="/publications?status=DRAFT"
        show-project-info
      />

      <!-- 2. Scheduled and Problems Columns -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Scheduled Section -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-5 h-5 text-sky-500" />
              {{ t('publicationStatus.scheduled') }}
              <CommonCountBadge :count="scheduledCount" />
            </h3>
          </div>

          <div v-if="scheduledLoading && !scheduledPublications.length" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
          </div>
          
          <div v-else-if="scheduledByProject.length > 0" class="space-y-6">
            <!-- Group by Project -->
            <div v-for="group in scheduledByProject" :key="group.project.id">
              <div class="flex items-center gap-2 mb-2 px-2">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4 text-gray-400" />
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ group.project.name }}
                </h4>
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
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
              {{ t('publication.filter.showIssuesOnly') }}
              <CommonCountBadge :count="problemsCount" color="error" />
            </h3>
          </div>

          <div v-if="problemsLoading && !problemPublications.length" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
          </div>
          
          <div v-else-if="problemsByProject.length > 0" class="space-y-6">
             <!-- Group by Project -->
            <div v-for="group in problemsByProject" :key="group.project.id">
              <div class="flex items-center gap-2 mb-2 px-2">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4 text-gray-400" />
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ group.project.name }}
                </h4>
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
            {{ t('common.noData') }}
          </div>
        </div>
      </div>

      <!-- Published in the last 24h Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            {{ t('dashboard.published_last_24h', 'Опубликовано за прошедшие сутки') }}
            <CommonCountBadge :count="publishedCount" color="success" />
          </h3>
          <UButton
            v-if="publishedCount > 0"
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

        <div v-if="publishedLoading && !publishedPublications.length" class="flex justify-center py-4">
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
          {{ t('dashboard.no_published_last_24h', 'За прошедшие сутки публикаций не было') }}
        </div>
      </div>

      <!-- 3. Projects (Bottom) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
         <div class="lg:col-span-2 space-y-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {{ t('project.titlePlural') }}
                  <CommonCountBadge :count="totalProjects" :title="t('project.projectsCount')" />
                </h2>
              </div>
              <div class="p-4 sm:p-5">
                <div v-if="projectsLoading && projects.length === 0" class="flex items-center justify-center py-4">
                  <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
                </div>
                <div v-else-if="projects.length === 0" class="text-center py-8">
                  <UIcon name="i-heroicons-briefcase" class="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                  <p class="text-gray-500 dark:text-gray-400 mb-4">{{ t('project.noProjectsDescription') }}</p>
                  <UButton icon="i-heroicons-plus" size="sm" to="/projects/new">{{ t('project.createProject') }}</UButton>
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

           <ChannelsDashboardPanel />
         </div>
      </div>
    </div>
  </div>
</template>
