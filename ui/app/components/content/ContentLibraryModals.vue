<script setup lang="ts">
import { type ContentCollection } from '~/composables/useContentCollections'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import ContentItemEditor from './ContentItemEditor.vue'
import ContentMoveModal from './ContentMoveModal.vue'

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
  
  // Move
  isMoveModalOpen: boolean
  moveItemsIds: string[]
  activeCollection: ContentCollection | null
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

const handleCloseEditModal = () => {
    emit('update:isEditModalOpen', false)
}
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
        :group-id="activeRootGroupId"
        @refresh="emit('refresh-items', { reset: true })"
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
            @click="handleCloseEditModal"
          >
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
      :current-group-id="activeRootGroupId"
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
