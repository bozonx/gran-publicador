<script setup lang="ts">
import { type ContentCollection } from '~/composables/useContentCollections'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import ContentItemEditor from './ContentItemEditor.vue'
import ContentMoveModal from './ContentMoveModal.vue'
import PublicationPreview from '~/components/publications/PublicationPreview.vue'
import ContentCreateItemFromPublicationModal from './ContentCreateItemFromPublicationModal.vue'
import ContentCreateItemFromUnsplashModal from './ContentCreateItemFromUnsplashModal.vue'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  
  // Purge
  isPurgeConfirmModalOpen: boolean
  isPurging: boolean
  
  // Bulk
  isBulkOperationModalOpen: boolean
  bulkOperationType: string
  isBulkDeleting: boolean
  selectedIdsCount: number
  isMergeConfirmModalOpen: boolean
  
  // Edit
  isEditModalOpen: boolean
  activeItem: any
  activeRootGroupId?: string

  // Publication preview
  isPublicationPreviewModalOpen: boolean
  activePublicationId: string | null

  // Create item from publication
  isCreateItemFromPublicationModalOpen: boolean
  
  // Create item from unsplash
  isCreateItemFromUnsplashModalOpen: boolean
  
  // Move
  isMoveModalOpen: boolean
  moveItemsIds: string[]
  activeCollection: ContentCollection | null
  currentGroupId?: string | null
  allGroupCollections: ContentCollection[]
  projects: any[]
  groupTreeItems: any[]
  
  // Rename/Delete Collection
  isRenameCollectionModalOpen: boolean
  isRenamingCollection: boolean
  newCollectionTitle: string
  isDeleteCollectionConfirmModalOpen: boolean
  isDeletingCollection: boolean
}>()

const emit = defineEmits<{
  'update:isPurgeConfirmModalOpen': [val: boolean]
  'update:isBulkOperationModalOpen': [val: boolean]
  'update:isMergeConfirmModalOpen': [val: boolean]
  'update:isEditModalOpen': [val: boolean]
  'update:isPublicationPreviewModalOpen': [val: boolean]
  'update:isCreateItemFromPublicationModalOpen': [val: boolean]
  'update:isCreateItemFromUnsplashModalOpen': [val: boolean]
  'update:isMoveModalOpen': [val: boolean]
  'update:isRenameCollectionModalOpen': [val: boolean]
  'update:isDeleteCollectionConfirmModalOpen': [val: boolean]
  'update:newCollectionTitle': [val: string]

  'purge': []
  'bulk-operation': []
  'refresh-items': [{ reset: boolean }]
  'create-publication': [item: any]
  'execute-move': [data: any]
  'rename-collection': []
  'delete-collection': []
}>()

const { t } = useI18n()

const isImageEditorOpen = ref(false)
const shouldReopenEditModalAfterEditor = ref(false)

const handleCloseEditModal = () => {
    if (isImageEditorOpen.value) return
    emit('update:isEditModalOpen', false)
}

const handleImageEditorOpen = () => {
  isImageEditorOpen.value = true

  shouldReopenEditModalAfterEditor.value = props.isEditModalOpen
  if (props.isEditModalOpen) {
    emit('update:isEditModalOpen', false)
  }
}

const handleImageEditorClose = () => {
  isImageEditorOpen.value = false

  if (!shouldReopenEditModalAfterEditor.value) return
  if (!props.activeItem) return

  emit('update:isEditModalOpen', true)
  shouldReopenEditModalAfterEditor.value = false
}

const handleClosePublicationPreviewModal = () => {
  emit('update:isPublicationPreviewModalOpen', false)
}

const handleOpenCreateItemFromPublicationModal = () => {
  if (!props.activePublicationId) return
  emit('update:isPublicationPreviewModalOpen', false)
  emit('update:isCreateItemFromPublicationModalOpen', true)
}

const handleOpenCreateItemFromUnsplashModal = () => {
  if (!props.activeItem?.id) return
  emit('update:isCreateItemFromUnsplashModalOpen', true)
}

const isCreateItemFromPublicationModalOpenModel = computed<boolean>({
  get() {
    return props.isCreateItemFromPublicationModalOpen
  },
  set(next) {
    emit('update:isCreateItemFromPublicationModalOpen', next)
  },
})

const isCreateItemFromUnsplashModalOpenModel = computed<boolean>({
  get() {
    return props.isCreateItemFromUnsplashModalOpen
  },
  set(next) {
    emit('update:isCreateItemFromUnsplashModalOpen', next)
  },
})
</script>

<template>
  <div>
    <!-- Purge Archived -->
    <UiConfirmModal
      :open="isPurgeConfirmModalOpen"
      :title="t('contentLibrary.actions.purgeConfirmTitle')"
      :description="t('contentLibrary.actions.purgeConfirmDescription')"
      :confirm-text="t('contentLibrary.actions.purgeArchived')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isPurging"
      @update:open="emit('update:isPurgeConfirmModalOpen', $event)"
      @confirm="emit('purge')"
    />

    <!-- Bulk Delete/Archive -->
    <UiConfirmModal
      :open="isBulkOperationModalOpen"
      :title="t('contentLibrary.bulk.deleteTitle')"
      :description="t('contentLibrary.bulk.deleteDescription', { count: selectedIdsCount })"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isBulkDeleting"
      @update:open="emit('update:isBulkOperationModalOpen', $event)"
      @confirm="emit('bulk-operation')"
    />

    <!-- Bulk Merge -->
    <UiConfirmModal
      :open="isMergeConfirmModalOpen"
      :title="t('contentLibrary.bulk.merge')"
      :description="t('contentLibrary.bulk.mergeConfirm', { count: selectedIdsCount })"
      :confirm-text="t('contentLibrary.bulk.merge')"
      color="primary"
      icon="i-heroicons-square-3-stack-3d"
      :loading="isBulkDeleting"
      @update:open="emit('update:isMergeConfirmModalOpen', $event)"
      @confirm="emit('bulk-operation')"
    />

    <!-- Item Editor -->
    <UiAppModal
      :open="isEditModalOpen"
      :title="t('contentLibrary.editTitle')"
      :ui="{ content: 'w-[90vw] max-w-5xl' }"
      @update:open="emit('update:isEditModalOpen', $event)"
    >
      <ContentItemEditor
        v-if="activeItem"
        :item="activeItem"
        :scope="scope"
        :project-id="projectId"
        :group-id="currentGroupId ?? undefined"
        @refresh="emit('refresh-items', { reset: true })"
        @editor-open="handleImageEditorOpen"
        @editor-close="handleImageEditorClose"
      />
      
      <template #footer>
        <div class="flex justify-between items-center w-full">
           <div class="text-xs text-gray-500 flex gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-paper-airplane"
                @click="emit('create-publication', activeItem)"
              >
                {{ t('contentLibrary.actions.createPublication') }}
              </UButton>
           </div>
           <UButton 
            color="primary" 
            :disabled="isImageEditorOpen"
            @click="handleCloseEditModal"
          >
            {{ t('common.done') }}
          </UButton>
        </div>
      </template>
    </UiAppModal>

    <ContentCreateItemFromPublicationModal
      v-model:open="isCreateItemFromPublicationModalOpenModel"
      :scope="scope"
      :project-id="projectId"
      :publication-id="activePublicationId"
    />

    <ContentCreateItemFromUnsplashModal
      v-model:open="isCreateItemFromUnsplashModalOpenModel"
      :scope="scope"
      :project-id="projectId"
      :unsplash-id="activeItem?.id"
    />

    <!-- Publication Preview -->
    <UiAppModal
      :open="isPublicationPreviewModalOpen"
      :title="t('common.view', 'View')"
      :ui="{ content: 'w-[90vw] max-w-5xl' }"
      @update:open="emit('update:isPublicationPreviewModalOpen', $event)"
    >
      <PublicationPreview v-if="activePublicationId" :publication-id="activePublicationId" />

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleOpenCreateItemFromPublicationModal"
          >
            В библиотеку контента
          </UButton>

          <UButton color="primary" @click="handleClosePublicationPreviewModal">
            {{ t('common.done') }}
          </UButton>
        </div>
      </template>
    </UiAppModal>

    <!-- Move Items -->
    <ContentMoveModal
      :open="isMoveModalOpen"
      :ids="moveItemsIds"
      :scope="scope"
      :project-id="projectId"
      :active-collection="activeCollection"
      :current-group-id="currentGroupId"
      :collections="allGroupCollections"
      :projects="projects"
      :folder-tree-items="groupTreeItems"
      @update:open="emit('update:isMoveModalOpen', $event)"
      @move="emit('execute-move', $event)"
    />

    <!-- Rename Collection -->
    <UiAppModal
      :open="isRenameCollectionModalOpen"
      :title="t('contentLibrary.collections.renameTitle')"
      :ui="{ content: 'w-full max-w-md' }"
      @update:open="emit('update:isRenameCollectionModalOpen', $event)"
    >
        <UFormField :label="t('common.title')">
            <UInput 
              :model-value="newCollectionTitle" 
              autofocus
              @update:model-value="emit('update:newCollectionTitle', $event)" 
              @keydown.enter="emit('rename-collection')" 
            />
        </UFormField>

        <template #footer>
             <UButton color="neutral" variant="ghost" @click="emit('update:isRenameCollectionModalOpen', false)">
                {{ t('common.cancel') }}
             </UButton>
             <UButton color="primary" :loading="isRenamingCollection" @click="emit('rename-collection')">
                {{ t('common.save') }}
             </UButton>
        </template>
    </UiAppModal>

    <!-- Delete Collection -->
    <UiConfirmModal
      :open="isDeleteCollectionConfirmModalOpen"
      :title="t('contentLibrary.collections.deleteTitle')"
      :description="t('contentLibrary.collections.deleteDescription')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingCollection"
      @update:open="emit('update:isDeleteCollectionConfirmModalOpen', $event)"
      @confirm="emit('delete-collection')"
    />
  </div>
</template>
