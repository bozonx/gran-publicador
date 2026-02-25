<script setup lang="ts">
import type { PublicationWithRelations } from '~/types/publications'
import { ArchiveEntityType } from '~/types/archive.types'
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publication: PublicationWithRelations
  projectId?: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'deleted', projectId?: string | null): void
  (e: 'duplicateSuccess', id: string): void
  (e: 'applyLlm', data: any): void
  (e: 'confirmRepublish'): void
  (e: 'confirmArchivePublish'): void
}>()

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const { 
  deletePublication, 
  updatePublication, 
  bulkOperation,
  statusOptions 
} = usePublications()

// Modal states
const isDeleteModalOpen = defineModel<boolean>('deleteModal', { default: false })
const isRepublishModalOpen = defineModel<boolean>('republishModal', { default: false })
const isArchiveWarningModalOpen = defineModel<boolean>('archiveWarningModal', { default: false })
const isScheduleModalOpen = defineModel<boolean>('scheduleModal', { default: false })
const isDuplicateModalOpen = defineModel<boolean>('duplicateModal', { default: false })
const isProjectModalOpen = defineModel<boolean>('projectModal', { default: false })
const isTemplateModalOpen = defineModel<boolean>('templateModal', { default: false })
const isLlmModalOpen = defineModel<boolean>('llmModal', { default: false })
const isRelationsModalOpen = defineModel<boolean>('relationsModal', { default: false })
const isContentActionModalOpen = defineModel<boolean>('contentActionModal', { default: false })

const archiveWarningMessage = ref('')
const newScheduledDate = ref('')
const isBulkScheduling = ref(false)
const isDeleting = ref(false)
const isUpdatingProject = ref(false)
const isUpdatingTemplate = ref(false)
const newProjectId = ref<string | undefined>(undefined)
const newTemplateId = ref<string | undefined>(undefined)
const contentActionMode = ref<'copy' | 'move'>('copy')

// Handlers
async function handleDelete() {
    isDeleting.value = true
    const success = await deletePublication(props.publication.id)
    isDeleting.value = false
    if (success) {
        isDeleteModalOpen.value = false
        emit('deleted', props.projectId)
    }
}

async function handleBulkSchedule() {
    if (!newScheduledDate.value) return
    isBulkScheduling.value = true
    try {
        await updatePublication(props.publication.id, {
            scheduledAt: new Date(newScheduledDate.value).toISOString()
        })
        toast.add({ title: t('common.success'), description: t('publication.scheduleUpdated'), color: 'success' })
        isScheduleModalOpen.value = false
        emit('refresh')
    } catch (err: any) {
        toast.add({ title: t('common.error'), description: t('common.saveError'), color: 'error' })
    } finally {
        isBulkScheduling.value = false
    }
}

async function handleUpdateProject() {
    isUpdatingProject.value = true
    try {
        if (!newProjectId.value) return
        const success = await bulkOperation([props.publication.id], 'MOVE', undefined, newProjectId.value)
        if (success) {
            isProjectModalOpen.value = false
            emit('refresh')
        }
    } finally {
        isUpdatingProject.value = false
    }
}

async function handleUpdateTemplate(templateId: string) {
    isUpdatingTemplate.value = true
    try {
        await updatePublication(props.publication.id, { projectTemplateId: templateId })
        isTemplateModalOpen.value = false
        emit('refresh')
    } finally {
        isUpdatingTemplate.value = false
    }
}

defineExpose({
    setArchiveWarning: (msg: string) => { archiveWarningMessage.value = msg },
    setContentActionMode: (mode: 'copy' | 'move') => { contentActionMode.value = mode },
    setNewScheduledDate: (date: string) => { newScheduledDate.value = date },
    setNewProjectId: (id?: string) => { newProjectId.value = id },
    setNewTemplateId: (id?: string) => { newTemplateId.value = id }
})
</script>

<template>
  <div>
    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-if="isDeleteModalOpen"
      v-model:open="isDeleteModalOpen"
      :title="t('publication.deleteConfirm')"
      :description="t('publication.deleteCascadeWarning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="handleDelete"
    />

    <!-- Republish Confirmation Modal -->
    <UiConfirmModal
      v-if="isRepublishModalOpen"
      v-model:open="isRepublishModalOpen"
      :title="t('publication.republishConfirm')"
      :description="publication?.status === 'FAILED' ? t('publication.republishFailedWarning') : t('publication.republishWarning')"
      :confirm-text="t('publication.republish', 'Republish')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      @confirm="$emit('confirmRepublish')"
    />

    <!-- Archive Warning Modal -->
    <UiConfirmModal
      v-if="isArchiveWarningModalOpen"
      v-model:open="isArchiveWarningModalOpen"
      :title="t('publication.archiveWarning.title')"
      :description="archiveWarningMessage + '\n\n' + t('publication.archiveWarning.confirm')"
      :confirm-text="t('publication.archiveWarning.publishAnyway')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      @confirm="$emit('confirmArchivePublish')"
    />

    <!-- Schedule Modal -->
    <UiAppModal v-if="isScheduleModalOpen" v-model:open="isScheduleModalOpen" :title="t('publication.changeScheduleTitle')">
      <p class="text-gray-500 dark:text-gray-400 mb-4">{{ t('publication.changeScheduleInfo') }}</p>
      <UFormField :label="t('publication.newScheduleTime')" required>
        <UInput v-model="newScheduledDate" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
      </UFormField>
      <template #footer>
        <UButton color="neutral" variant="ghost" :label="t('common.cancel')" @click="isScheduleModalOpen = false" />
        <UButton color="primary" :label="t('common.save')" :loading="isBulkScheduling" @click="handleBulkSchedule" />
      </template>
    </UiAppModal>

    <!-- Project Change Modal -->
    <UiAppModal v-model:open="isProjectModalOpen" :title="t('project.title')" :ui="{ content: 'sm:max-w-md' }">
      <div class="space-y-4">
        <UFormField :label="t('project.title')">
          <CommonProjectSelect v-model="newProjectId" class="w-full" />
        </UFormField>
      </div>
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isProjectModalOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="isUpdatingProject" @click="handleUpdateProject">{{ t('common.save') }}</UButton>
      </template>
    </UiAppModal>

    <!-- Template Change Modal -->
    <UiAppModal v-model:open="isTemplateModalOpen" :title="t('projectTemplates.title')" :ui="{ content: 'sm:max-w-md' }">
      <div class="space-y-4">
        <UFormField :label="t('projectTemplates.title')">
          <USelectMenu v-model="newTemplateId" :items="$attrs.templateOptions as any[]" value-key="value" label-key="label" class="w-full" />
        </UFormField>
      </div>
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTemplateModalOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="isUpdatingTemplate" :disabled="!newTemplateId" @click="handleUpdateTemplate(newTemplateId!)">{{ t('common.save') }}</UButton>
      </template>
    </UiAppModal>

    <!-- Other Modals keep their existing logic or simplified props -->
    <ModalsCreatePublicationModal
      v-if="publication"
      v-model:open="isDuplicateModalOpen"
      :project-id="projectId || undefined"
      :preselected-language="publication.language"
      :preselected-post-type="publication.postType as any"
      :preselected-channel-ids="publication.posts?.map((p: any) => p.channelId)"
      allow-project-selection
      :prefilled-title="publication.title || ''"
      :prefilled-description="publication.description || ''"
      :prefilled-author-comment="publication.authorComment || ''"
      :prefilled-content="publication.content || ''"
      :prefilled-tags="publication.tags"
      :prefilled-meta="$attrs.normalizedPublicationMeta as any"
      :prefilled-note="publication.note || ''"
      :prefilled-media-ids="publication.media?.map((m: any) => ({ id: m.media?.id, hasSpoiler: m.hasSpoiler }))"
      :prefilled-content-item-ids="publication.contentItems?.map((ci: any) => ci.contentItemId)"
      :prefilled-author-signature-id="publication.authorSignatureId || undefined"
      :prefilled-project-template-id="publication.projectTemplateId || undefined"
      @success="(id: string) => $emit('duplicateSuccess', id)"
    />

    <ModalsLlmGeneratorModal
      v-if="publication"
      v-model:open="isLlmModalOpen"
      :publication-id="publication.id"
      :content="publication.content || undefined"
      :title="publication.title || undefined"
      :media="((publication.media || []).map((m: any) => m.media).filter(Boolean) as any)"
      :project-id="projectId || undefined"
      :publication-meta="$attrs.normalizedPublicationMeta as any"
      :post-type="publication.postType || undefined"
      :publication-language="publication.language || undefined"
      :post-channels="(publication.posts || []).map((p: any) => ({
        channelId: p.channelId,
        channelName: p.channel?.name || '',
        language: p.channel?.language || publication!.language,
        tags: p.channel?.tags ? p.channel.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        socialMedia: p.channel?.socialMedia,
      }))"
      @apply="(data: any) => $emit('applyLlm', data)"
    />

    <ModalsPublicationRelationsModal
      v-if="publication && projectId"
      v-model:open="isRelationsModalOpen"
      :publication="publication"
      :project-id="projectId"
      @updated="() => $emit('refresh')"
    />

    <ContentCreateItemFromPublicationModal
      v-model:open="isContentActionModalOpen"
      :publication-id="publication.id"
      :scope="projectId ? 'project' : 'personal'"
      :project-id="projectId || undefined"
      :mode="contentActionMode"
    />
  </div>
</template>
