<script setup lang="ts">
import type { PublicationWithRelations } from '~/types/publications'
import { ArchiveEntityType } from '~/types/archive.types'
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publication: PublicationWithRelations
  projectId?: string | null
  templateOptions?: any[]
  normalizedPublicationMeta?: any
  initialScheduledDate?: string
  initialTargetProjectId?: string
  initialTemplateId?: string
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
const api = useApi()
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
const isCopyModalOpen = defineModel<boolean>('copyModal', { default: false })
const isTemplateModalOpen = defineModel<boolean>('templateModal', { default: false })
const isLlmModalOpen = defineModel<boolean>('llmModal', { default: false })
const isRelationsModalOpen = defineModel<boolean>('relationsModal', { default: false })
const isContentActionModalOpen = defineModel<boolean>('contentActionModal', { default: false })
const isPublishedWarningModalOpen = defineModel<boolean>('publishedWarningModal', { default: false })

const archiveWarningMessage = ref('')
const contentActionMode = ref<'copy'>('copy')

defineExpose({
    setArchiveWarning: (msg: string) => { archiveWarningMessage.value = msg },
    setContentActionMode: (mode: 'copy') => { contentActionMode.value = mode },
})
</script>

<template>
  <div>
    <!-- Delete Confirmation Modal -->
    <PublicationsModalsPublicationDeleteModal
      v-model:open="isDeleteModalOpen"
      :publication-id="publication.id"
      :project-id="projectId"
      @deleted="(id) => $emit('deleted', id)"
    />

    <!-- Schedule Modal -->
    <PublicationsModalsPublicationScheduleModal
      v-model:open="isScheduleModalOpen"
      :publication-id="publication.id"
      :initial-date="initialScheduledDate || publication.scheduledAt || undefined"
      @refresh="() => $emit('refresh')"
    />

    <!-- Copy Modal -->
    <PublicationsModalsPublicationCopyProjectModal
      v-model:open="isCopyModalOpen"
      :publication-id="publication.id"
      :initial-project-id="initialTargetProjectId"
      @refresh="() => $emit('refresh')"
    />

    <!-- Template Modal -->
    <PublicationsModalsPublicationTemplateModal
      v-model:open="isTemplateModalOpen"
      :publication-id="publication.id"
      :template-options="templateOptions"
      :initial-template-id="initialTemplateId || publication.projectTemplateId || undefined"
      @refresh="() => $emit('refresh')"
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

    <!-- Published Warning Modal -->
    <UiConfirmModal
      v-if="isPublishedWarningModalOpen"
      v-model:open="isPublishedWarningModalOpen"
      :title="t('publication.editPublishedConfirmTitle')"
      :description="t('publication.editPublishedConfirmDescription')"
      :confirm-text="t('common.understand')"
      color="info"
      icon="i-heroicons-information-circle"
      @confirm="isPublishedWarningModalOpen = false"
    />

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
      :prefilled-meta="normalizedPublicationMeta"
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
      :publication-meta="normalizedPublicationMeta"
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
