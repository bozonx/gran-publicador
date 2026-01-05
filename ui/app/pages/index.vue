<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import type { ProjectWithRole } from '~/stores/projects'
import type { PostWithRelations } from '~/composables/usePosts'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { displayName } = useAuth()
const router = useRouter()

const { projects, fetchProjects, isLoading: projectsLoading } = useProjects()
const { publications, fetchUserPublications, totalCount: publicationsCount, isLoading: publicationsLoading } = usePublications()

// Computed
const recentPublications = computed(() => publications.value.slice(0, 5))
const isLoading = computed(() => projectsLoading.value || publicationsLoading.value)

// Fetch data on mount
onMounted(async () => {
  try {
    await Promise.all([
      fetchProjects(),
      fetchUserPublications({ limit: 50 })
    ])
  } catch (err) {
    console.error('Dashboard initialization error:', err)
  }
})

/**
 * Format date for display
 */
function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString()
}

/**
 * Truncate content for preview
 */
function truncateContent(content: string | null | undefined, maxLength = 100): string {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Get status color
 */
function getStatusColor(status: string | null): 'success' | 'warning' | 'error' | 'neutral' {
  const colors: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    draft: 'neutral',
    scheduled: 'warning',
    published: 'success',
    failed: 'error',
  }
  return status ? colors[status] || 'neutral' : 'neutral'
}

// Quick stats
const totalProjects = computed(() => projects.value.length)

// Group projects by role: Owner > Admin > Editor > Viewer
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




    <!-- Content grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- Left side: Projects and Recent Posts -->
      <div class="lg:col-span-2 space-y-6">
        <!-- My Projects -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div
            class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {{ t('project.titlePlural') }}
              <CommonCountBadge :count="totalProjects" :title="t('project.projectsCount')" />
            </h2>
            <UButton variant="ghost" color="primary" size="sm" to="/projects">
              {{ t('common.viewAll') }}
            </UButton>
          </div>
          <div class="p-4 sm:p-5">
            <!-- Loading -->
            <div v-if="isLoading && projects.length === 0" class="flex items-center justify-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
            </div>

            <!-- Empty state -->
            <div v-else-if="projects.length === 0" class="text-center py-8">
              <UIcon
                name="i-heroicons-briefcase"
                class="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3"
              />
              <p class="text-gray-500 dark:text-gray-400 mb-4">
                {{ t('project.noProjectsDescription') }}
              </p>
              <UButton icon="i-heroicons-plus" size="sm" to="/projects/new">
                {{ t('project.createProject') }}
              </UButton>
            </div>

            <!-- Project list grouped by role -->
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

        <!-- Recent Publications -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div
            class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {{ t('publication.titlePlural') }}
              <CommonCountBadge :count="publicationsCount" :title="t('publication.publicationsCount')" />
            </h2>
            <UButton variant="ghost" color="primary" size="sm" to="/publications">
              {{ t('common.viewAll') }}
            </UButton>
          </div>
          <div class="p-6">
            <!-- Loading -->
            <div
              v-if="isLoading && recentPublications.length === 0"
              class="flex items-center justify-center py-8"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
            </div>

            <!-- Empty state -->
            <div v-else-if="recentPublications.length === 0" class="text-center py-8">
              <UIcon
                name="i-heroicons-document-text"
                class="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3"
              />
              <p class="text-gray-500 dark:text-gray-400">
                {{ t('publication.noPublicationsDescription', 'У вас еще нет созданных публикаций.') }}
              </p>
            </div>

            <!-- Publications list -->
            <div v-else class="space-y-4">
               <PublicationsPublicationListItem
                  v-for="pub in recentPublications"
                  :key="pub.id"
                  :publication="pub"
                  @click="router.push(`/projects/${pub.projectId}/publications/${pub.id}`)"
                />
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Problems and Channels -->
      <div class="lg:col-span-1 space-y-6">
        <DashboardProblemsWidget />
        <ChannelsDashboardPanel />
      </div>
    </div>
  </div>
</template>
