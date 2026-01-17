<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { useSorting } from '~/composables/useSorting'
import { FORM_STYLES } from '~/utils/design-tokens'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const { projects, isLoading, error, fetchProjects, createProject } = useProjects()

const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)
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
const isCreating = ref(false)
const createFormState = reactive({
  name: '',
  description: ''
})

function resetCreateForm() {
  createFormState.name = ''
  createFormState.description = ''
  isCreating.value = false
}

/**
 * Navigate to create project page -> Open create modal
 */
function goToCreateProject() {
  resetCreateForm()
  isCreateModalOpen.value = true
}

async function handleCreateProject() {
  if (!createFormState.name || createFormState.name.length < 2) return

  isCreating.value = true
  try {
    const project = await createProject({
      name: createFormState.name,
      description: createFormState.description || undefined
    })

    if (project) {
      isCreateModalOpen.value = false
      router.push(`/projects/${project.id}`)
    }
  } catch (error: any) {
    const toast = useToast()
    toast.add({
      title: t('common.error'),
      description: error.message || t('common.saveError'),
      color: 'error'
    })
  } finally {
    isCreating.value = false
  }
}

// Re-add missing sorting state and logic
const roleWeights: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1
}

const sortOptions = computed(() => [
  { id: 'alphabetical', label: t('project.sort.alphabetical'), icon: 'i-heroicons-bars-3-bottom-left' },
  { id: 'role', label: t('project.sort.role'), icon: 'i-heroicons-user-circle' },
  { id: 'publicationsCount', label: t('project.sort.publicationsCount'), icon: 'i-heroicons-document-text' },
  { id: 'lastPublication', label: t('project.sort.lastPublication'), icon: 'i-heroicons-calendar' }
])

function sortProjectsFn(list: ProjectWithRole[], sortBy: string, sortOrder: 'asc' | 'desc') {
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
  defaultSortBy: 'alphabetical',
  sortOptions: sortOptions.value,
  sortFn: sortProjectsFn
})

const activeSortOption = computed(() => sortOptions.value.find(opt => opt.id === sortBy.value))
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
            :icon="sortOrder === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'"
            color="neutral"
            variant="ghost"
            @click="toggleSortOrder"
            :title="sortOrder === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')"
          />
        </template>

        <UButton icon="i-heroicons-plus" @click="goToCreateProject" color="primary">
            {{ t('project.createProject') }}
        </UButton>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6 space-y-4">
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
      <!-- Active Projects -->
      <div class="space-y-4">
        <ProjectsProjectListItem
          v-for="project in sortedProjects"
          :key="project.id"
          :project="project"
          :show-description="true"
        />
      </div>
      
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
      <UButton icon="i-heroicons-plus" @click="goToCreateProject">
        {{ t('project.createProject') }}
      </UButton>
    </div>


    <!-- Create Project Modal -->
    <UiAppModal v-model:open="isCreateModalOpen" :title="t('project.createProject')">
      <form id="create-project-form" @submit.prevent="handleCreateProject" class="space-y-6">
        <UFormField :label="t('project.name')" required>
          <UInput v-model="createFormState.name" :placeholder="t('project.namePlaceholder')" autofocus class="w-full" size="lg" />
        </UFormField>

        <UFormField :label="t('project.description')" :help="t('common.optional')">
          <UTextarea v-model="createFormState.description" :placeholder="t('project.descriptionPlaceholder')" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" />
        </UFormField>
      </form>

      <template #footer>
        <UButton color="neutral" variant="ghost" :disabled="isCreating" @click="isCreateModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" type="submit" form="create-project-form" :loading="isCreating" :disabled="!createFormState.name || createFormState.name.length < 2">
          {{ t('common.create') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
