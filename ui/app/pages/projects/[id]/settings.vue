<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjects } from '~/composables/useProjects'
import { ArchiveEntityType } from '~/types/archive.types'
import RolesList from '~/components/roles/RolesList.vue'

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
  transferProject,
  clearCurrentProject,
  canEdit,
  canDelete,
  canManageMembers,
  fetchMembers,
} = useProjects()

const isInviteModalOpen = ref(false)

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

// Transfer modal state
const showTransferModal = ref(false)
const isTransferring = ref(false)
const transferData = ref({
  targetUserId: '',
  projectName: '',
  clearCredentials: true,
})

// Validation for transfer
const isTransferUserIdValid = computed(() => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(transferData.value.targetUserId)
})

const isTransferProjectNameValid = computed(() => {
  return transferData.value.projectName === currentProject.value?.name
})

const transferUserIdError = computed(() => {
  if (!transferData.value.targetUserId) return undefined
  return isTransferUserIdValid.value ? undefined : t('project.error_invalid_id')
})

const transferProjectNameError = computed(() => {
  if (!transferData.value.projectName) return undefined
  return isTransferProjectNameValid.value ? undefined : t('project.error_name_mismatch')
})

const isTransferButtonDisabled = computed(() => {
  return !currentProject.value || !isTransferUserIdValid.value || !isTransferProjectNameValid.value
})

/**
 * Handle project transfer
 */
async function handleTransfer() {
  if (!projectId.value || !currentProject.value) return

  isTransferring.value = true
  const success = await transferProject(projectId.value, transferData.value)
  isTransferring.value = false

  if (success) {
    showTransferModal.value = false
    router.push('/projects')
  }
}
</script>

<template>
  <div>
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
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="t('project.general_settings', 'General Settings')"
          :description="t('project.general_settings_desc', 'Update your project name and description')"
        >
          
          <FormsProjectForm
            :project="currentProject"
            :is-loading="isSaving"
            :visible-sections="['general']"
            autosave
            hide-header
            hide-cancel
            flat
            @submit="handleUpdate"
          />
        </UiAppCard>

        <!-- Preferences -->
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="t('settings.preferences', 'Preferences')"
          :description="t('project.preferences_desc', 'Configure project-wide settings and defaults')"
        >
          
          <FormsProjectForm
            :project="currentProject"
            :is-loading="isSaving"
            :visible-sections="['preferences']"
            autosave
            hide-header
            hide-cancel
            flat
            @submit="handleUpdate"
          />
        </UiAppCard>

        <!-- Media Optimization -->
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="t('settings.mediaOptimization.title', 'Media Optimization')"
          :description="t('settings.mediaOptimization.description', 'Configure default optimization settings for uploaded media')"
        >
          <FormsProjectForm
            :project="currentProject"
            :is-loading="isSaving"
            :visible-sections="['optimization']"
            autosave
            hide-header
            hide-cancel
            flat
            @submit="handleUpdate"
          />
        </UiAppCard>

        <!-- Author Signatures -->
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="t('authorSignature.title', 'Author Signatures')"
          :description="t('authorSignature.projectDescription', 'Manage author signatures with language variants. Signatures are selected when creating publications and copied to posts.')"
        >
          <PostsAuthorSignatureManager
            :project-id="currentProject.id"
            :channel-languages="currentProject.languages"
          />
        </UiAppCard>

        <!-- Publication Templates -->
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="t('projectTemplates.title', 'Publication Templates')"
          :description="t('projectTemplates.description', 'Define templates that control how publications are formatted when posted to channels.')"
        >
          <FormsProjectTemplatesEditor
            :project-id="currentProject.id"
            :readonly="!!currentProject.archivedAt"
          />
        </UiAppCard>

        <!-- LLM Prompt Templates -->
        <SettingsLlmPromptTemplates
          v-if="canEdit(currentProject)"
          :project-id="currentProject.id"
        />

        <!-- Members Management -->
        <UiAppCard
          v-if="canManageMembers(currentProject)"
          :title="t('project.members', 'Members')"
          :description="t('project.members_desc', 'Manage who has access to this project')"
        >
          <template #actions>
            <UButton
              v-if="canManageMembers(currentProject)"
              icon="i-heroicons-user-plus"
              size="sm"
              color="primary"
              @click="isInviteModalOpen = true"
            >
              {{ t('projectMember.invite') }}
            </UButton>
          </template>

          <ProjectsProjectMembersList :project-id="currentProject.id" />

          <ProjectsInviteMemberModal
            v-model="isInviteModalOpen"
            :project-id="currentProject.id"
            @success="fetchMembers(currentProject.id)"
          />
        </UiAppCard>

        <!-- Roles Management -->
        <UiAppCard
          v-if="canManageMembers(currentProject)"
          :title="t('roles.rolesAndPermissions')"
          :description="t('roles.rolesDescription')"
        >
          <RolesList :project-id="currentProject.id" />
        </UiAppCard>

        <!-- Archive Project -->
        <UiAppCard
          v-if="canEdit(currentProject)"
          :title="currentProject.archivedAt ? t('project.unarchiveProject', 'Unarchive Project') : t('project.archiveProject', 'Archive Project')"
        >

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
        </UiAppCard>

        <!-- Danger Zone -->
        <UiAppCard
          v-if="canDelete(currentProject)"
          :title="t('common.danger_zone', 'Danger Zone')"
          title-class="text-lg font-semibold text-red-600 dark:text-red-400"
          class="border border-red-200 dark:border-red-900"
        >
          
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

          <div class="mt-8 pt-8 border-t border-red-100 dark:border-red-900/50 flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ t('project.transferProject', 'Transfer Project') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('project.transfer_warning', 'Transfer ownership to another user. This action is irreversible.') }}
              </p>
            </div>
            <UButton
              color="error"
              variant="outline"
              icon="i-heroicons-user-plus"
              :loading="isTransferring"
              @click="showTransferModal = true"
            >
              {{ t('project.transferProject', 'Transfer Project') }}
            </UButton>
          </div>
        </UiAppCard>
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

    <!-- Transfer confirmation modal -->
    <UiAppModal v-model:open="showTransferModal" :title="t('project.transferProject', 'Transfer Project')">
      <div v-if="currentProject" class="mb-6">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ t('project.transfer_info', 'Enter the internal ID of the user you want to transfer this project to. You will lose all ownership rights and access, unless the new owner invites you back.') }}
        </p>

        <UFormField 
          :label="t('project.targetUserId', 'New Owner Internal ID')" 
          required 
          class="mb-4"
          :error="transferUserIdError"
        >
          <div class="relative flex items-center">
            <UInput
              v-model="transferData.targetUserId"
              :placeholder="t('project.id_placeholder', 'e.g. 550e8400-e29b-41d4-a716-446655440000')"
              autofocus
              class="flex-1"
              :color="isTransferUserIdValid ? 'success' : undefined"
            />
            <Transition name="scale-fade">
              <UIcon 
                v-if="isTransferUserIdValid" 
                name="i-heroicons-check-circle" 
                class="absolute right-3 w-5 h-5 text-green-500"
              />
            </Transition>
          </div>
        </UFormField>

        <UFormField 
          :label="t('project.confirmName', 'Confirm Project Name')" 
          required 
          class="mb-4"
          :error="transferProjectNameError"
        >
          <template #description>
            {{ t('project.confirm_name_desc', 'To confirm, type the name of the project:') }} <span class="font-bold">{{ currentProject.name }}</span>
          </template>
          <div class="relative flex items-center">
            <UInput
              v-model="transferData.projectName"
              :placeholder="currentProject.name"
              class="flex-1"
              :color="isTransferProjectNameValid ? 'success' : undefined"
            />
            <Transition name="scale-fade">
              <UIcon 
                v-if="isTransferProjectNameValid" 
                name="i-heroicons-check-circle" 
                class="absolute right-3 w-5 h-5 text-green-500"
              />
            </Transition>
          </div>
        </UFormField>

        <UCheckbox
          v-model="transferData.clearCredentials"
          :label="t('project.clearCredentials', 'Clear channel credentials')"
          :description="t('project.clearCredentials_desc', 'Highly recommended for security. The new owner will have to reconnect channels.')"
          color="error"
        />
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" :disabled="isTransferring" @click="showTransferModal = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton 
          color="error" 
          :loading="isTransferring" 
          :disabled="isTransferButtonDisabled"
          @click="handleTransfer"
        >
          {{ t('project.transferNow', 'Transfer Ownership') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>

<style scoped>
.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.2s ease;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
</style>
