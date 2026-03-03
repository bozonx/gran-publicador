import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useSwipe } from '@vueuse/core'
import { useAutosave } from '~/composables/useAutosave'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import type { MediaLinkItem } from '~/types/media'

interface UseMediaGalleryEditorOptions {
  props: any
  localMedia: any
  updateMedia: (id: string, data: any) => Promise<any>
  updateMediaLinkInPublication: (publicationId: string, mediaLinkId: string, data: any) => Promise<any>
  deleteMedia: (id: string) => Promise<any>
  fetchMedia: (id: string) => Promise<any>
  emit: (e: 'refresh') => void
  t: any
  toast: any
  currentProject: any
}

export function useMediaGalleryEditor({
  props,
  localMedia,
  updateMedia,
  updateMediaLinkInPublication,
  deleteMedia,
  fetchMedia,
  emit,
  t,
  toast,
  currentProject
}: UseMediaGalleryEditorOptions) {
  const isModalOpen = ref(false)
  const selectedMedia = ref<any>(null)
  const selectedMediaLinkId = ref<string | null>(null)
  const editableHasSpoiler = ref(false)
  const editableMetadata = ref<Record<string, any>>({})
  const editableAlt = ref('')
  const editableDescription = ref('')
  
  const isDeleteModalOpen = ref(false)
  const mediaToDeleteMediaId = ref<string | null>(null)
  const isDeleting = ref(false)

  const { isIndicatorVisible, saveStatus, saveError, indicatorStatus, syncBaseline } = useAutosave({
    data: computed(() => ({
      mediaLinkId: selectedMediaLinkId.value,
      hasSpoiler: editableHasSpoiler.value,
      alt: editableAlt.value,
      description: editableDescription.value,
      metadata: JSON.parse(JSON.stringify(editableMetadata.value)),
    })),
    saveFn: async (data: any) => {
      if (!data.mediaLinkId) return { saved: false }

      try {
        if (selectedMedia.value?.id) {
          await updateMedia(selectedMedia.value.id, {
            meta: data.metadata,
          })
        }
      } catch (error: any) {
        console.error('Failed to update media general metadata', error)
        return { saved: false, error: error.message }
      }

      try {
        const linkData = {
          hasSpoiler: data.hasSpoiler,
          alt: data.alt || undefined,
          description: data.description || undefined,
        }

        if (props.publicationId) {
          await updateMediaLinkInPublication(props.publicationId, data.mediaLinkId, linkData)
        } else if (props.onUpdateLink) {
          await props.onUpdateLink(data.mediaLinkId, linkData)
        }
      } catch (error: any) {
        console.error('Failed to update media link metadata', error)
        return { saved: false, error: error.message }
      }

      return { saved: true }
    },
    debounceMs: AUTO_SAVE_DEBOUNCE_MS,
    skipInitial: true,
  })

  const currentMediaIndex = computed(() => {
    if (!selectedMedia.value) return -1
    return localMedia.value.findIndex((item: MediaLinkItem) => item.media?.id === selectedMedia.value?.id)
  })

  const hasPreviousMedia = computed(() => currentMediaIndex.value > 0)
  const hasNextMedia = computed(() => {
    return currentMediaIndex.value >= 0 && currentMediaIndex.value < localMedia.value.length - 1
  })

  const transitionName = ref('slide-next')

  function openMediaModal(item: MediaLinkItem) {
    if (!item.media) return
    selectedMedia.value = item.media
    selectedMediaLinkId.value = item.id || null
    editableHasSpoiler.value = !!item.hasSpoiler
    editableMetadata.value = JSON.parse(JSON.stringify(item.media.meta || {}))
    editableAlt.value = item.alt || ''
    editableDescription.value = item.description || ''
    isModalOpen.value = true

    if (item.media.id) {
      fetchMedia(item.media.id).then(fullMedia => {
        if (fullMedia && selectedMedia.value && selectedMedia.value.id === fullMedia.id) {
          selectedMedia.value.fullMediaMeta = fullMedia.fullMediaMeta
          selectedMedia.value.publicToken = fullMedia.publicToken
        }
      }).catch((error: any) => {
        console.error('Failed to fetch full media details', error)
        if (error.status === 404 || error.response?.status === 404) {
          toast.add({
            title: t('common.error'),
            description: t('media.notFound', 'Media record not found. It may have been deleted.'),
            color: 'error',
          })
          emit('refresh')
          closeMediaModal()
        }
      })
    }
  }

  function closeMediaModal() {
    isModalOpen.value = false
    selectedMedia.value = null
    selectedMediaLinkId.value = null
  }

  function navigateToPreviousMedia() {
    if (!hasPreviousMedia.value) return
    transitionName.value = 'slide-prev'
    const prevItem = localMedia.value[currentMediaIndex.value - 1]
    if (prevItem?.media) {
      openMediaModal(prevItem)
    }
  }

  function navigateToNextMedia() {
    if (!hasNextMedia.value) return
    transitionName.value = 'slide-next'
    const nextItem = localMedia.value[currentMediaIndex.value + 1]
    if (nextItem?.media) {
      openMediaModal(nextItem)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isModalOpen.value) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      navigateToPreviousMedia()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      navigateToNextMedia()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMediaModal()
    }
  }

  watch(isModalOpen, (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  const swipeElement = ref<HTMLElement | null>(null)
  const { isSwiping, direction } = useSwipe(swipeElement, {
    onSwipeEnd(e: TouchEvent, direction: 'left' | 'right' | 'up' | 'down' | 'none') {
      if (direction === 'left') {
        navigateToNextMedia()
      } else if (direction === 'right') {
        navigateToPreviousMedia()
      }
    },
  })

  function handleDeleteClick(mediaId: string) {
    mediaToDeleteMediaId.value = mediaId
    isDeleteModalOpen.value = true
  }

  async function confirmRemoveMedia() {
    if (!mediaToDeleteMediaId.value) return

    isDeleting.value = true
    try {
      await deleteMedia(mediaToDeleteMediaId.value)
      emit('refresh')
    } catch (error: any) {
      toast.add({
        title: t('common.error'),
        description: t('media.removeError', 'Failed to remove media'),
        color: 'error',
      })
    } finally {
      isDeleting.value = false
      isDeleteModalOpen.value = false
      mediaToDeleteMediaId.value = null
    }
  }

  function handleEditMedia() {
    if (!selectedMedia.value) return
    const isIMAGE = (selectedMedia.value.type || '').toUpperCase() === 'IMAGE'
    const isEditableStorage = ['STORAGE', 'TELEGRAM'].includes((selectedMedia.value.storageType || '').toUpperCase())

    if (!isIMAGE || !isEditableStorage) {
      toast.add({
        title: t('common.error'),
        description: t('media.editOnlyStorageOrTelegramImages', 'Only local or Telegram images can be edited'),
        color: 'error',
      })
      return
    }

    const mediaId = selectedMedia.value.id
    const projectId = currentProject.value?.id
    const url = projectId
      ? `/media/${mediaId}/image-editor?projectId=${projectId}`
      : `/media/${mediaId}/image-editor`

    window.open(url, '_blank')
  }

  function handleEditVideo() {
    if (!selectedMedia.value) return
    const isVIDEO = (selectedMedia.value.type || '').toUpperCase() === 'VIDEO'
    const isEditableStorage = ['STORAGE', 'TELEGRAM'].includes((selectedMedia.value.storageType || '').toUpperCase())

    if (!isVIDEO || !isEditableStorage) {
      toast.add({
        title: t('common.error'),
        description: t('media.editOnlyStorageOrTelegramVideos', 'Only local or Telegram videos can be edited'),
        color: 'error',
      })
      return
    }

    const mediaId = selectedMedia.value.id
    const projectId = currentProject.value?.id
    let url = `/media/${mediaId}/video-edit`
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    if (props.collectionId) params.set('collectionId', props.collectionId)
    if (props.groupId) params.set('groupId', props.groupId)
    
    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }

    window.open(url, '_blank')
  }

  return {
    isModalOpen,
    selectedMedia,
    selectedMediaLinkId,
    editableHasSpoiler,
    editableMetadata,
    editableAlt,
    editableDescription,
    isDeleteModalOpen,
    mediaToDeleteMediaId,
    isDeleting,
    isIndicatorVisible,
    saveStatus,
    saveError,
    indicatorStatus,
    syncBaseline,
    currentMediaIndex,
    hasPreviousMedia,
    hasNextMedia,
    transitionName,
    swipeElement,
    isSwiping,
    openMediaModal,
    closeMediaModal,
    navigateToPreviousMedia,
    navigateToNextMedia,
    handleDeleteClick,
    confirmRemoveMedia,
    handleEditMedia,
    handleEditVideo
  }
}
