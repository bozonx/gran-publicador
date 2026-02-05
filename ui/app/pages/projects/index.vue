<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { useSorting } from '~/composables/useSorting'
import { VueDraggable } from 'vue-draggable-plus'
import { FORM_STYLES } from '~/utils/design-tokens'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const { projects, isLoading, error, fetchProjects, createProject } = useProjects()

const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)
const allProjects = ref<ProjectWithRole[]>([])
const showArchived = ref(false)

// Filter projects
const filteredAllProjects = computed(() => {
  if (!debouncedSearch.value) return allProjects.value
  
  const query = debouncedSearch.value.toLowerCase()
  return allProjects.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.description?.toLowerCase().includes(query)
  )
})

const activeProjects = computed(() => 
  filteredAllProjects.value.filter(p => !p.archivedAt)
)

const archivedProjects = computed(() => 
  filteredAllProjects.value.filter(p => p.archivedAt)
)

const hasActiveFilters = computed(() => !!searchQuery.value)

function resetFilters() {
  searchQuery.value = ''
}

// Check if there are any archived projects
const hasArchivedProjects = computed(() => archivedProjects.value.length > 0)

const sortedProjects = computed(() => sortList(activeProjects.value))
const sortedArchivedProjects = computed(() => sortList(archivedProjects.value))

// Fetch all projects (active and archived) in one request
onMounted(async () => {
  const data = await fetchProjects(true) // Include archived for the main projects list
  allProjects.value = data
})

/**
 * Toggle archived projects visibility
 */
function toggleArchivedProjects() {
  showArchived.value = !showArchived.value
}

const isCreateModalOpen = ref(false)

/**
 * Open create project modal
 */
function openCreateModal() {
  isCreateModalOpen.value = true
}

function handleProjectCreated(projectId: string) {
  router.push(`/projects/${projectId}`)
}

// Re-add missing sorting state and logic
const roleWeights: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1
}

const sortOptions = computed(() => [
  { id: 'custom', label: t('project.sort.custom'), icon: 'i-heroicons-hand-raised' },
  { id: 'alphabetical', label: t('project.sort.alphabetical'), icon: 'i-heroicons-bars-3-bottom-left' },
  { id: 'role', label: t('project.sort.role'), icon: 'i-heroicons-user-circle' },
  { id: 'publicationsCount', label: t('project.sort.publicationsCount'), icon: 'i-heroicons-document-text' },
  { id: 'lastPublication', label: t('project.sort.lastPublication'), icon: 'i-heroicons-calendar' }
])

const { user } = useAuth()
const { updateProjectOrder } = useProjects()

function sortProjectsFn(list: ProjectWithRole[], sortBy: string, sortOrder: 'asc' | 'desc') {
  if (sortBy === 'custom') {
    const order = user.value?.projectOrder || []
    return [...list].sort((a, b) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)
      
      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      
      return indexA - indexB
    })
  }

  return [...list].sort((a, b) => {
    let result = 0
    if (sortBy === 'alphabetical') {
      result = a.name.localeCompare(b.name)
    } else if (sortBy === 'role') {
      const weightA = roleWeights[a.role || 'viewer'] || 0
      const weightB = roleWeights[b.role || 'viewer'] || 0
      result = weightB - weightA
      // Secondary sort by name alphabetically
      if (result === 0) result = a.name.localeCompare(b.name)
    } else if (sortBy === 'publicationsCount') {
      result = (a.publicationsCount || 0) - (b.publicationsCount || 0)
    } else if (sortBy === 'lastPublication') {
      const dateA = a.lastPublicationAt ? new Date(a.lastPublicationAt).getTime() : 0
      const dateB = b.lastPublicationAt ? new Date(b.lastPublicationAt).getTime() : 0
      result = dateA - dateB
    }

    return sortOrder === 'asc' ? result : -result
  })
}

const { 
  sortBy, 
  sortOrder, 
  toggleSortOrder,
  sortList
} = useSorting<ProjectWithRole>({
  storageKey: 'projects',
  defaultSortBy: 'custom',
  sortOptions: sortOptions.value,
  sortFn: sortProjectsFn
})

const activeSortOption = computed(() => sortOptions.value.find(opt => opt.id === sortBy.value))

const displayProjects = ref<ProjectWithRole[]>([])

watch([sortedProjects, sortBy], () => {
  displayProjects.value = [...sortedProjects.value]
}, { immediate: true })

async function onDragEnd() {
  const newOrder = displayProjects.value.map(p => p.id)
  await updateProjectOrder(newOrder)
}
</script>

<template>
  <div class="page-spacing">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('project.titlePlural') }}
          <CommonCountBadge :count="activeProjects.length" :title="t('project.projectsCount')" />
        </h1>
      </div>
      
      <div class="flex items-center gap-2">
        <template v-if="projects.length > 0">
          <USelectMenu
            v-model="sortBy"
            :items="sortOptions"
            value-key="id"
            label-key="label"
            class="w-56"
            :searchable="false"
            :loading="projects.length === 0"
          >
            <template #leading>
              <UIcon v-if="activeSortOption" :name="activeSortOption.icon" class="w-4 h-4" />
            </template>
          </USelectMenu>
          <UButton
            v-if="sortBy !== 'custom'"
            :icon="sortOrder === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'"
            color="neutral"
            variant="ghost"
            :title="sortOrder === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')"
            @click="toggleSortOrder"
          />
        </template>

        <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
            {{ t('project.createProject') }}
        </UButton>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="app-card section-spacing">
      <div class="flex items-center gap-4">
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
        <UButton
          v-if="hasActiveFilters"
          color="neutral"
          variant="subtle"
          icon="i-heroicons-x-mark"
          size="sm"
          @click="resetFilters"
        >
          {{ t('common.reset') }}
        </UButton>
      </div>
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
    <div v-if="isLoading && projects.length === 0" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Projects list -->
    <div v-else-if="projects.length > 0" class="space-y-6">
      <VueDraggable
        v-model="displayProjects"
        :animation="150"
        handle=".drag-handle"
        :disabled="sortBy !== 'custom'"
        class="space-y-4"
        @end="onDragEnd"
      >
        <ProjectsProjectListItem
          v-for="project in displayProjects"
          :key="project.id"
          :project="project"
          :show-description="true"
        >
          <template v-if="sortBy === 'custom'" #leading>
            <div 
              class="drag-handle p-1.5 -ml-1.5 mr-1 rounded cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              @click.stop.prevent
              @mousedown.stop
            >
              <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
            </div>
          </template>
        </ProjectsProjectListItem>
      </VueDraggable>
      
      <!-- Show/Hide Archived Button -->
      <div v-if="hasArchivedProjects" class="flex justify-center pt-4">
        <UButton
          :icon="showArchived ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          variant="ghost"
          color="neutral"
          @click="toggleArchivedProjects"
        >
          {{ showArchived ? t('common.hideArchived', 'Hide Archived') : t('common.showArchived', 'Show Archived') }}
        </UButton>
      </div>



      <!-- Archived Projects Section -->
      <div v-if="showArchived" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div v-if="archivedProjects.length > 0">
          <div class="space-y-4">
            <ProjectsProjectListItem
              v-for="project in sortedArchivedProjects"
              :key="project.id"
              :project="project"
              :show-description="true"
            />
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400">{{ t('project.noArchived', 'No archived projects') }}</p>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="app-card p-12 text-center">
      <UIcon
        name="i-heroicons-briefcase"
        class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ t('project.noProjectsFound') }}
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        Create your first project to start managing your social media content.
      </p>
      <UButton icon="i-heroicons-plus" @click="openCreateModal">
        {{ t('project.createProject') }}
      </UButton>
    </div>


    <!-- Create Project Modal -->
    <ModalsCreateProjectModal
      v-model:open="isCreateModalOpen"
      @created="handleProjectCreated"
    />
  </div>
</template>
