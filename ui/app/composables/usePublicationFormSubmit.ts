import { ref, type Ref } from 'vue'
import { isTextContentEmpty } from '~/utils/text'
import type { PublicationFormData } from '~/types/publication-form'
import type { PublicationWithRelations } from '~/types/publications'

export function usePublicationFormSubmit(
  currentProjectId: Ref<string | undefined>,
  props: { isEditMode: boolean; publicationId?: string; autosave?: boolean },
  state: any,
  emit: (event: 'success', id: string) => void,
  callbacks: {
    saveOriginalState: () => void;
    showSuccess: () => void;
    showError: () => void;
  }
) {
  const { updatePublication, createPublication } = usePublications()
  const { t } = useI18n()
  const toast = useToast()
  
  const showValidationWarning = ref(false)
  const pendingSubmitData = ref<PublicationFormData | null>(null)

  async function performSubmit(data: PublicationFormData) {
    try {
      const commonData = {
        title: data.title || null,
        description: data.description || null,
        content: isTextContentEmpty(data.content) ? null : (data.content || null),
        authorComment: data.authorComment || null,
        note: data.note || null,
        tags: data.tags,
        postType: data.postType,
        meta: data.meta || {},
        postDate: data.postDate ? new Date(data.postDate).toISOString() : undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      }

      let pubId = props.publicationId
      let payload = { ...commonData }

      if (props.isEditMode && pubId) {
        await updatePublication(pubId, {
          ...payload,
          projectTemplateId: data.projectTemplateId || null,
          status: undefined,
        }, { silent: props.autosave })
      } else {
        if (!currentProjectId.value) {
            throw new Error('Project ID is required')
        }
        const createData = {
          ...commonData,
          projectId: currentProjectId.value,
          language: data.language,
          status: data.status === 'SCHEDULED' && (!state.channelIds || state.channelIds.length === 0) ? 'DRAFT' : data.status,
          projectTemplateId: data.projectTemplateId || null,
        }

        const pub = await createPublication(createData)
        if (!pub) throw new Error('Failed to create publication')
        pubId = pub.id
      }

      callbacks.showSuccess()
      emit('success', pubId as string)
      callbacks.saveOriginalState()
    } catch (error: any) {
      console.error('Publication save error:', error)
      callbacks.showError()
      
      let description = t('common.saveError')
      if (error?.status === 409 || error?.response?.status === 409) {
        description = t('publication.errors.processingBlocked')
      }

      toast.add({
        title: t('common.error'),
        description,
        color: 'error'
      })
    }
  }

  return {
    showValidationWarning,
    pendingSubmitData,
    performSubmit
  }
}
