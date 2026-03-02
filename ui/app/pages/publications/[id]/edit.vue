<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePublicationEdit } from '~/composables/publications/usePublicationEditPage'
import { usePublicationInstanceActions } from '~/composables/usePublicationInstanceActions'
import { usePublications } from '~/composables/usePublications'
import { useLanguages } from '~/composables/useLanguages'
import { usePosts } from '~/composables/usePosts'
import { useChannels } from '~/composables/useChannels'
import { ArchiveEntityType } from '~/types/archive.types'

const route = useRoute()
const publicationId = route.params.id as string

const {
  t,
  route: editRoute, // rename to avoid conflict if needed, or just use destructured one
  currentPublication,
  isPublicationLoading,
  publicationProblems,
  currentProject,
  projectId,
  isLocked,
  canPublish,
  templateOptions,
  moreActions,
  isDeleteModalOpen,
  isRepublishModalOpen,
  isArchiveWarningModalOpen,
  isScheduleModalOpen,
  isDuplicateModalOpen,
  isCopyModalOpen,
  isTemplateModalOpen,
  showLlmModal,
  isRelationsModalOpen,
  isContentActionModalOpen,
  isPublishedWarningModalOpen,
  newTemplateId,
  newScheduledDate,
  archiveWarningMessage,
  contentActionMode,
  targetProjectId,
  modalsRef,
  isPublishing,
  init,
  isReallyEmpty,
  hasMediaValidationErrors,
  linkedSocialMedia,
  fetchPublication,
  openScheduleModal,
  openTemplateModal,
  handleUpdateStatus,
  handlePublishNow,
  handleConfirmRepublish,
  handleConfirmArchivePublish,
  handleDeleteSuccess,
  handleDuplicateSuccess,
  goBack
} = usePublicationEdit(publicationId)

const {
  normalizedPublicationMeta,
  applyLlmResult
} = usePublicationInstanceActions(currentPublication)

const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()
const { statusOptions } = usePublications()
const { channels } = useChannels()

// Initial Load
onMounted(() => {
  init()
})

async function handleApplyLlm(data: any) {
  await applyLlmResult(data)
}

function handleSuccess() {
  // refresh is automatic via usePublications but can be forced if needed
}

function handleCancel() {
  goBack()
}

const collections = computed(() => [
  { label: t('common.view', 'View'), icon: 'i-heroicons-eye', to: `/publications/${publicationId}` },
  { label: t('common.edit', 'Edit'), icon: 'i-heroicons-pencil-square', to: `/publications/${publicationId}/edit` }
])
</script>

<template>
  <div class="w-full">
    <!-- Collection Switcher -->
    <div class="mb-8 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <nav class="-mb-px flex space-x-8" aria-label="Collections">
        <NuxtLink
          v-for="collection in collections"
          :key="collection.to"
          :to="collection.to"
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="[
            route.path === collection.to
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon :name="collection.icon" class="mr-2 h-5 w-5" :class="[route.path === collection.to ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500']" />
          {{ collection.label }}
        </NuxtLink>
      </nav>

      <!-- Top Action Buttons -->
      <div v-if="currentPublication" class="flex items-center gap-2 pb-2">
        <UTooltip :text="t('llm.tooltip')">
          <UButton
            icon="i-heroicons-sparkles"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="isLocked"
            @click="showLlmModal = true"
          />
        </UTooltip>

        <UiArchiveButton
          :key="currentPublication.archivedAt ? 'archived' : 'active'"
          :entity-type="ArchiveEntityType.PUBLICATION"
          :entity-id="currentPublication.id"
          :is-archived="!!currentPublication.archivedAt"
          @toggle="() => fetchPublication(publicationId)"
        />

        <UDropdownMenu :items="moreActions" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
            size="sm"
          />
          <template #item="{ item }">
            <div class="flex items-center gap-2 w-full truncate" :class="[(item as any).class || '', { 'opacity-50 cursor-not-allowed': (item as any).disabled }]" @click="!(item as any).disabled && (item as any).click && (item as any).click()">
              <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </div>
          </template>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Publication Modals -->
    <PublicationsPublicationEditModals
      v-if="currentPublication"
      ref="modalsRef"
      v-model:delete-modal="isDeleteModalOpen"
      v-model:republish-modal="isRepublishModalOpen"
      v-model:archive-warning-modal="isArchiveWarningModalOpen"
      v-model:schedule-modal="isScheduleModalOpen"
      v-model:duplicate-modal="isDuplicateModalOpen"
      v-model:copy-modal="isCopyModalOpen"
      v-model:template-modal="isTemplateModalOpen"
      v-model:llm-modal="showLlmModal"
      v-model:relations-modal="isRelationsModalOpen"
      v-model:content-action-modal="isContentActionModalOpen"
      v-model:published-warning-modal="isPublishedWarningModalOpen"
      :publication="currentPublication"
      :project-id="projectId"
      :template-options="templateOptions"
      :normalized-publication-meta="normalizedPublicationMeta"
      :initial-scheduled-date="newScheduledDate"
      :initial-target-project-id="targetProjectId"
      :initial-template-id="newTemplateId"
      @refresh="() => fetchPublication(publicationId)"
      @deleted="handleDeleteSuccess"
      @duplicate-success="handleDuplicateSuccess"
      @apply-llm="handleApplyLlm"
      @confirm-republish="handleConfirmRepublish"
      @confirm-archive-publish="handleConfirmArchivePublish"
    />

    <div v-if="isPublicationLoading && !currentPublication" class="flex items-center justify-center py-12">
        <UiLoadingSpinner size="md" />
    </div>

    <div v-else-if="currentPublication" class="space-y-6 pb-12">
        <!-- Publication Header (Status, Project, Schedule, Actions) -->
        <PublicationsPublicationEditHeader
          :publication="currentPublication"
          :project="currentProject"
          :is-locked="isLocked"
          :is-desynced="currentPublication.meta?.isDesynced === true"
          :is-really-empty="isReallyEmpty"
          :has-media-validation-errors="hasMediaValidationErrors"
          :publication-problems="publicationProblems"
          :project-templates="[]"
          :template-options="templateOptions"
          :channels="channels"
          :language-options="languageOptions"
          :type-options="typeOptions"
          :is-publishing="isPublishing"
          :can-publish="canPublish"
          :status-options="statusOptions"
          @update-status="handleUpdateStatus"
          @open-template-modal="openTemplateModal"
          @open-relations-modal="isRelationsModalOpen = true"
          @open-schedule-modal="openScheduleModal"
          @publish-now="handlePublishNow"
          @refresh="() => fetchPublication(publicationId)"
        />

        <!-- Publication Notes -->
        <PublicationsPublicationNotesBlock
          :publication="currentPublication"
          @update="() => fetchPublication(publicationId)"
        />

        <!-- Media Gallery -->
        <MediaGallery
          :media="(currentPublication.media as any) || []"
          :publication-id="currentPublication.id"
          :editable="!isLocked"
          :post-type="currentPublication.postType"
          :social-media="linkedSocialMedia"
          @refresh="() => fetchPublication(publicationId)"
        />

        <!-- Publication Form -->
        <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 shadow-sm">
            <div class="p-6">
                <FormsPublicationForm
                  :project-id="projectId"
                  :publication="currentPublication"
                  autosave
                  @success="handleSuccess"
                  @cancel="handleCancel"
                ></FormsPublicationForm>
            </div>
        </div>

        <!-- Linked Posts Section -->
        <PublicationsPublicationPostsList
          :publication="currentPublication"
          :channels="channels"
          @post-deleted="() => fetchPublication(publicationId)"
          @refresh="() => fetchPublication(publicationId)"
        />
    </div>
    
    <div v-else class="text-center py-12">
        <p class="text-gray-500">{{ t('errors.notFound') }}</p>
    </div>
  </div>
</template>
