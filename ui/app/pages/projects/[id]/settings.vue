<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjects } from '~/composables/useProjects'
import { ArchiveEntityType } from '~/types/archive.types'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { canGoBack, goBack: navigateBack } = useNavigation()

const {
  currentProject,
  isLoading,
  error,
  fetchProject,
  updateProject,
  deleteProject,
  clearCurrentProject,
  canEdit,
  canDelete,
  canManageMembers,
} = useProjects()

const projectId = computed(() => route.params.id as string)

// Delete confirmation modal state
const showDeleteModal = ref(false)
const deleteConfirmationInput = ref('')
const isDeleting = ref(false)
const isSaving = ref(false)

// Fetch project on mount
onMounted(async () => {
  if (projectId.value) {
    await fetchProject(projectId.value)
  }
})

const isProjectEmpty = computed(() => {
  if (!currentProject.value) return true
  return (currentProject.value.channelCount || 0) === 0 && (currentProject.value.publicationsCount || 0) === 0
})

// Clean up on unmount
onUnmounted(() => {
  clearCurrentProject()
})

/**
 * Navigate back to project details
 */
function goBack() {
  navigateBack()
}

/**
 * Handle project update
 */
async function handleUpdate(data: Partial<ProjectWithRole>) {
  if (!projectId.value) return

  isSaving.value = true
  const success = await updateProject(projectId.value, data)
  isSaving.value = false
  
  if (!success) {
    throw new Error('Failed to update project')
  }

  await fetchProject(projectId.value)
}

/**
 * Open delete confirmation modal
 */
function confirmDelete() {
  if (isProjectEmpty.value) {
    handleDelete()
    return
  }
  deleteConfirmationInput.value = ''
  showDeleteModal.value = true
}

/**
 * Handle project deletion
 */
async function handleDelete() {
  if (!projectId.value) return

  isDeleting.value = true
  const success = await deleteProject(projectId.value)
  isDeleting.value = false

  if (success) {
    showDeleteModal.value = false
    router.push('/projects')
  }
}

/**
 * Cancel delete action
 */
function cancelDelete() {
  showDeleteModal.value = false
}
</script>

<template>
  <div>
    <!-- Back button -->
    <div class="mb-6">
      <UButton 
        variant="ghost" 
        color="neutral" 
        icon="i-heroicons-arrow-left" 
        :disabled="!canGoBack"
        @click="goBack"
      >
        {{ t('common.back_to_project', 'Back to Project') }}
      </UButton>
    </div>

    <div v-if="isLoading && !currentProject" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <div v-else-if="currentProject">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ t('project.settings', 'Project Settings') }}
          </h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            {{ t('project.settings_description', 'Manage your project settings and members') }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8">
        <!-- General Settings -->
        <UCard v-if="canEdit(currentProject)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('project.general_settings', 'General Settings') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('project.general_settings_desc', 'Update your project name and description') }}
            </p>
          </template>
          
          <FormsProjectForm
            :project="currentProject"
            :is-loading="isSaving"
            :visible-sections="['general']"
            @submit="handleUpdate"
            :submit-label="t('settings.saveSettings')"
            hide-header
            hide-cancel
            flat
          />
        </UCard>

        <!-- Preferences -->
        <UCard v-if="canEdit(currentProject)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('settings.preferences', 'Preferences') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('project.preferences_desc', 'Configure project-wide settings and defaults') }}
            </p>
          </template>
          
          <FormsProjectForm
            :project="currentProject"
            :is-loading="isSaving"
            :visible-sections="['preferences']"
            @submit="handleUpdate"
            :submit-label="t('settings.saveSettings')"
            hide-header
            hide-cancel
            flat
          />
        </UCard>

        <!-- Members Management -->
        <UCard v-if="canManageMembers(currentProject)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('project.members', 'Members') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('project.members_desc', 'Manage who has access to this project') }}
            </p>
          </template>

          <ProjectsProjectMembersList :project-id="currentProject.id" />
        </UCard>

        <!-- Archive Project -->
        <UCard v-if="canEdit(currentProject)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ currentProject.archivedAt ? t('project.unarchiveProject', 'Unarchive Project') : t('project.archiveProject', 'Archive Project') }}
            </h2>
          </template>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ currentProject.archivedAt ? t('project.projectIsArchived', 'Project is archived') : t('project.archive_desc', 'Archived projects are hidden from the main list but can be restored later.') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ currentProject.archivedAt ? t('project.unarchive_info', 'Restoring the project will make it visible again.') : t('project.archive_info', 'Archive this project if you no longer need it but want to keep the data.') }}
              </p>
            </div>
            <UiArchiveButton
              :entity-type="ArchiveEntityType.PROJECT"
              :entity-id="currentProject.id"
              :is-archived="!!currentProject.archivedAt"
              variant="solid"
              @toggle="() => fetchProject(projectId)"
            />
          </div>
        </UCard>

        <!-- Danger Zone -->
        <UCard v-if="canDelete(currentProject)" class="border-red-200 dark:border-red-900">
          <template #header>
            <h2 class="text-lg font-semibold text-red-600 dark:text-red-400">
              {{ t('common.danger_zone', 'Danger Zone') }}
            </h2>
          </template>
          
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ t('project.deleteProject') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('project.delete_warning', 'Once you delete a project, there is no going back. Please be certain.') }}
              </p>
            </div>
            <UButton
              color="error"
              variant="solid"
              icon="i-heroicons-trash"
              :loading="isDeleting"
              @click="confirmDelete"
            >
              {{ t('project.deleteProject') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UiAppModal v-model:open="showDeleteModal" :title="t('project.deleteProject')">
      <div v-if="currentProject" class="mb-6">
        <p class="text-gray-600 dark:text-gray-400 mb-2">
          {{ t('project.deleteConfirmWithInput') }}
          <span class="font-bold text-gray-900 dark:text-white">{{ currentProject.name }}</span>
        </p>
        <p class="text-sm text-red-500 font-medium">
          {{ t('project.deleteCascadeInfo') }}
        </p>
      </div>

      <UInput
        v-if="currentProject"
        v-model="deleteConfirmationInput"
        :placeholder="currentProject.name"
        class="mb-6"
        autofocus
        @keyup.enter="deleteConfirmationInput === currentProject.name ? handleDelete() : null"
      />

      <template #footer>
        <UButton color="neutral" variant="ghost" :disabled="isDeleting" @click="cancelDelete">
          {{ t('common.cancel') }}
        </UButton>
        <UButton 
          color="error" 
          :loading="isDeleting" 
          :disabled="!currentProject || deleteConfirmationInput !== currentProject.name"
          @click="handleDelete"
        >
          {{ t('common.delete') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
