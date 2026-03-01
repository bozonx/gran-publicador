import { ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n, useToast, useApi } from '#imports'
import type { PublicationWithRelations } from '~/types/publications'
import type { PublicationStatus } from '~/types/posts'
import { usePublications } from '~/composables/usePublications'
import { useSocialPosting } from '~/composables/useSocialPosting'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import { useChannels } from '~/composables/useChannels'
import { useProjects } from '~/composables/useProjects'
import { useNavigation } from '~/composables/useNavigation'

export function usePublicationEdit(publicationId: string) {
  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()
  const toast = useToast()

  const { 
    fetchPublication, 
    currentPublication, 
    updatePublication,
    isLoading: isPublicationLoading,
    currentPublicationProblems: publicationProblems
  } = usePublications()

  const { fetchProjects, currentProject, fetchProject } = useProjects()
  const { fetchChannels, channels } = useChannels()
  const { fetchProjectTemplates, templates: projectTemplates } = useProjectTemplates()
  const { goBack } = useNavigation()

  // Modal states
  const isDeleteModalOpen = ref(false)
  const isRepublishModalOpen = ref(false)
  const isArchiveWarningModalOpen = ref(false)
  const isScheduleModalOpen = ref(false)
  const isDuplicateModalOpen = ref(false)
  const isCopyModalOpen = ref(false)
  const isTemplateModalOpen = ref(false)
  const showLlmModal = ref(false)
  const isRelationsModalOpen = ref(false)
  const isContentActionModalOpen = ref(false)
  const isPublishedWarningModalOpen = ref(false)
  const hasShownPublishedWarning = ref(false)

  // Sub-states for modals
  const newTemplateId = ref<string | undefined>(undefined)
  const newScheduledDate = ref('')
  const archiveWarningMessage = ref('')
  const contentActionMode = ref<'copy'>('copy')
  const targetProjectId = ref<string | undefined>(undefined)

  const modalsRef = ref<any>(null)

  const { 
    publishPublication,
    publishPublicationNow,
    isPublishing, 
    canPublishPublication: baseCanPublishPublication 
  } = useSocialPosting()

  const projectId = computed(() => currentPublication.value?.projectId || null)
  const isLocked = computed(() => currentPublication.value?.status === 'PROCESSING')

  const canPublish = computed(() => {
    if (!currentPublication.value) return false
    if (currentPublication.value.status === 'DRAFT') return false
    return baseCanPublishPublication(currentPublication.value)
  })

  const isReallyEmpty = computed(() => {
    if (!currentPublication.value) return true
    const isContentEmpty = !currentPublication.value.content || currentPublication.value.content.trim() === ''
    const hasMedia = Array.isArray(currentPublication.value.media) && currentPublication.value.media.length > 0
    return isContentEmpty && !hasMedia
  })

  const hasMediaValidationErrors = computed(() => {
    return publicationProblems.value.some((p: any) => p.key === 'mediaValidation')
  })

  const linkedSocialMedia = computed(() => {
    if (!currentPublication.value?.posts) return []
    return currentPublication.value.posts.map((p: any) => p.channel?.socialMedia).filter(Boolean)
  })

  const templateOptions = computed(() => {
    const pubLang = currentPublication.value?.language
    const pubType = currentPublication.value?.postType
    return projectTemplates.value
      .filter((tpl: any) => {
        const langMatch = !tpl.language || tpl.language === pubLang
        const typeMatch = !tpl.postType || tpl.postType === pubType
        return langMatch && typeMatch
      })
      .map((tpl: any) => ({ value: tpl.id, label: tpl.name }))
  })

  const moreActions = computed(() => [
    [
      {
        label: t('publication.copyToContentLibrary'),
        icon: 'i-heroicons-arrow-down-on-square-stack',
        click: () => {
          contentActionMode.value = 'copy'
          isContentActionModalOpen.value = true
        },
      },
      {
        label: t('publication.copyToProject'),
        icon: 'i-heroicons-document-duplicate',
        click: openCopyModal,
      },
      {
        label: t('common.duplicate', 'Duplicate'),
        icon: 'i-heroicons-document-duplicate',
        click: openDuplicateModal,
      }
    ],
    [
      {
        label: t('common.delete'),
        icon: 'i-heroicons-trash',
        class: 'text-error-500 hover:text-error-600',
        click: () => { isDeleteModalOpen.value = true },
      }
    ]
  ])

  function openScheduleModal() {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) 
    newScheduledDate.value = now.toISOString().slice(0, 16)
    modalsRef.value?.setNewScheduledDate(newScheduledDate.value)
    isScheduleModalOpen.value = true
  }

  function openDuplicateModal() {
    isDuplicateModalOpen.value = true
  }

  function openCopyModal() {
    if (!currentProject.value) return
    targetProjectId.value = currentProject.value.id
    modalsRef.value?.setTargetProjectId(targetProjectId.value)
    isCopyModalOpen.value = true
  }

  function openTemplateModal() {
    if (!currentPublication.value) return
    newTemplateId.value = currentPublication.value.projectTemplateId || undefined
    modalsRef.value?.setNewTemplateId(newTemplateId.value)
    isTemplateModalOpen.value = true
  }

  async function handleUpdateStatus(status: PublicationStatus) {
    if (!currentPublication.value || currentPublication.value.status === status) return
    try {
      await updatePublication(currentPublication.value.id, { status })
    } catch (err: any) {
      toast.add({ title: t('common.error'), description: t('common.saveError'), color: 'error' })
    }
  }

  async function executePublish(force: boolean, now: boolean = false) {
    if (!currentPublication.value) return

    try {
      const result = now 
        ? await publishPublicationNow(currentPublication.value.id)
        : await publishPublication(currentPublication.value.id, force)
      
      if (result.success) {
        toast.add({ title: t('common.success'), description: t('publication.publishSuccess'), color: 'success' })
      } else {
         // handle errors...
      }
      
      await fetchPublication(currentPublication.value.id)
    } catch (error: any) {
      toast.add({ title: t('common.error'), description: t('publication.publishError'), color: 'error' })
      if (currentPublication.value) await fetchPublication(currentPublication.value.id)
    }
  }

  async function handlePublishNow() {
    if (!currentPublication.value) return

    let warning = ''
    if (currentPublication.value.archivedAt) {
        warning = t('publication.archiveWarning.publication')
    } else if (currentProject.value?.archivedAt) {
        warning = t('publication.archiveWarning.project', { name: currentProject.value.name })
    } else {
        const inactiveChannels = currentPublication.value.posts?.filter((p: any) => p.channel && !p.channel.isActive).map((p: any) => p.channel.name) || []
        if (inactiveChannels.length > 0) {
            warning = t('publication.archiveWarning.inactiveChannels', { names: [...new Set(inactiveChannels)].join(', ') })
        }
    }

    if (warning) {
        archiveWarningMessage.value = warning
        isArchiveWarningModalOpen.value = true
        return
    }
    
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(currentPublication.value.status)) {
      isRepublishModalOpen.value = true
      return
    }
    
    await executePublish(false, true)
  }

  // Initial Load
  async function init() {
    if (publicationId) {
      await fetchPublication(publicationId)
    }
    await fetchProjects()

    if (projectId.value && (!currentProject.value || currentProject.value.id !== projectId.value)) {
      await fetchProject(projectId.value)
    }

    if (projectId.value) {
      await Promise.all([
        fetchChannels({ projectId: projectId.value }),
        fetchProjectTemplates(projectId.value)
      ])
    }
  }

  // Watchers
  watch(projectId, async (newId) => {
    if (newId) {
      await Promise.all([
        fetchChannels({ projectId: newId }),
        fetchProject(newId),
        fetchProjectTemplates(newId)
      ])
    }
  })

  watch(
    () => [currentPublication.value, route.query.openLlm],
    async ([pub, openLlm]) => {
      if (pub && (pub as any).id === publicationId && openLlm === 'true') {
        await nextTick()
        if (currentPublication.value?.id === publicationId && route.query.openLlm === 'true') {
          const { openLlm: _, ...restQuery } = route.query
          router.replace({ query: restQuery })
          setTimeout(() => { showLlmModal.value = true }, 100)
        }
      }
    },
    { immediate: true }
  )

  watch(
    () => [currentPublication.value?.id, currentPublication.value?.status],
    ([id, status]) => {
      if (id !== publicationId) return
      if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(status as any) && !hasShownPublishedWarning.value) {
        isPublishedWarningModalOpen.value = true
        hasShownPublishedWarning.value = true
      }
    },
    { immediate: true }
  )

  return {
    t,
    router,
    route,
    toast,
    currentPublication,
    isPublicationLoading,
    publicationProblems,
    currentProject,
    projectId,
    isLocked,
    canPublish,
    templateOptions,
    moreActions,
    // Modal states
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
    // Sub-states
    newTemplateId,
    newScheduledDate,
    archiveWarningMessage,
    contentActionMode,
    targetProjectId,
    modalsRef,
    isPublishing,
    publicationId,
    init,
    isReallyEmpty,
    hasMediaValidationErrors,
    linkedSocialMedia,
    // Actions
    fetchPublication,
    fetchProjects,
    fetchProject,
    fetchChannels,
    fetchProjectTemplates,
    openScheduleModal,
    openDuplicateModal,
    openCopyModal,
    openTemplateModal,
    handleUpdateStatus,
    handlePublishNow,
    executePublish,
    goBack,
    handleConfirmRepublish: () => { isRepublishModalOpen.value = false; executePublish(true, false) },
    handleConfirmArchivePublish: async () => { 
        isArchiveWarningModalOpen.value = false
        if (!currentPublication.value) return
        if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(currentPublication.value.status)) { isRepublishModalOpen.value = true; return }
        await executePublish(false, true)
    },
    handleDeleteSuccess: (pid?: string | null) => {
        if (pid) router.push(`/projects/${pid}`)
        else router.push('/publications')
    },
    handleDuplicateSuccess: (id: string) => {
        isDuplicateModalOpen.value = false
        router.push(`/publications/${id}/edit`)
    }
  }
}
