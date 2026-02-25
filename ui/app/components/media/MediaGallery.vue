<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl, getPublicMediaUrl } from '~/composables/useMedia'
import { useProjects } from '~/composables/useProjects'
import { useAuthStore } from '~/stores/auth'
import { DEFAULT_MEDIA_OPTIMIZATION_SETTINGS } from '~/utils/media-presets'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { useAutosave } from '~/composables/useAutosave'
import { formatBytes, getMediaIcon } from '~/utils/media'
import type { MediaItem, MediaLinkItem } from '~/types/media'
import type { ValidationError } from '~/composables/useSocialMediaValidation'

interface Props {
  media: MediaLinkItem[]
  publicationId?: string
  editable?: boolean
  socialMedia?: string | string[]
  showValidation?: boolean
  postType?: string
  // Generic callbacks for when not used in a publication context
  onAdd?: (media: CreateMediaInput[]) => Promise<void>
  onReorder?: (reorderData: Array<{ id: string; order: number }>) => Promise<void>
  onUpdateLink?: (mediaLinkId: string, data: { hasSpoiler?: boolean; order?: number }) => Promise<void>
  onCopy?: (mediaLinkId: string) => Promise<void>
  collectionId?: string
  groupId?: string
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  showValidation: true,
})

interface Emits {
  (e: 'refresh'): void
}

const emit = defineEmits<Emits>()

const { t } = useI18n()
const authStore = useAuthStore()
const { currentProject } = useProjects()
const {
  deleteMedia,
  uploadMedia, 
  uploadMediaFromUrl, 
  isLoading: isUploading, 
  addMediaToPublication, 
  reorderMediaInPublication,
  updateMediaLinkInPublication,
  updateMedia,
  replaceMediaFile,
  fetchMedia,
  createMedia,
} = useMedia()
const { validatePostContent } = useSocialMediaValidation()
const toast = useToast()

const fileInput = ref<any>(null)
const uploadProgress = ref(false)
const uploadProgressPercent = ref(0)
const sourceType = ref<'URL' | 'TELEGRAM'>('URL')
const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
const sourceInput = ref('')
const filenameInput = ref('')

// Extended options state
const isAddingMedia = ref(false)
const showExtendedOptions = ref(false)
const stagedFiles = ref<File[]>([])
const optimizationSettings = ref<any>(JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS)))

const currentProjectOptimization = computed(() => {
  return currentProject.value?.preferences?.mediaOptimization
})

// Initialize optimization settings with project defaults when opening extended options
watch(showExtendedOptions, (val) => {
  if (val) {
    if (currentProjectOptimization.value) {
      optimizationSettings.value = JSON.parse(JSON.stringify(currentProjectOptimization.value))
    } else {
      optimizationSettings.value = JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS))
    }
  }
})

const addMediaButtonLabel = computed(() => {
  if (sourceType.value === 'URL') {
    return t('media.add', 'Add media')
  }
  const types = {
    IMAGE: t('media.type.image'),
    VIDEO: t('media.type.video'),
    AUDIO: t('media.type.audio'),
    DOCUMENT: t('media.type.document'),
  }
  const typeText = (types[mediaType.value as keyof typeof types] || t('media.type.image')).toLowerCase()
  return `${t('common.add', 'Add')} ${typeText}`
})

const isDragging = ref(false)
const selectedMedia = ref<MediaItem | null>(null)
const selectedMediaLinkId = ref<string | null>(null)
const editableHasSpoiler = ref(false)
const isModalOpen = ref(false)


const editableMetadata = ref<Record<string, any> | null>(null)
const editableAlt = ref('')
const editableDescription = ref('')
const isSavingMeta = ref(false)

const autosaveMediaPayload = computed(() => {
  if (!selectedMedia.value) return null

  return {
    id: selectedMedia.value.id,
    mediaLinkId: selectedMediaLinkId.value,
    alt: editableAlt.value,
    description: editableDescription.value,
    meta: editableMetadata.value,
    hasSpoiler: editableHasSpoiler.value,
  }
})

const { 
  saveStatus: mediaSaveStatus, 
  saveError: mediaSaveError, 
  forceSave: forceSaveMediaMeta,
  retrySave: retrySaveMediaMeta,
  isIndicatorVisible: isMediaIndicatorVisible,
  indicatorStatus: mediaIndicatorStatus
} = useAutosave({
  data: autosaveMediaPayload,
  saveFn: async (data) => {
    if (!isModalOpen.value || !data) return { saved: false, skipped: true }

    const updated = await updateMedia(data.id, {
      alt: data.alt || undefined,
      description: data.description || undefined,
      meta: data.meta || undefined,
    })

    if (selectedMedia.value && selectedMedia.value.id === updated.id) {
      selectedMedia.value.meta = updated.meta
      selectedMedia.value.alt = updated.alt
      selectedMedia.value.description = updated.description
    }

    emit('refresh')

    if (!data.mediaLinkId) return { saved: true }

    try {
      if (props.publicationId) {
        await updateMediaLinkInPublication(props.publicationId, data.mediaLinkId, {
          hasSpoiler: data.hasSpoiler,
        })
      } else if (props.onUpdateLink) {
        await props.onUpdateLink(data.mediaLinkId, { hasSpoiler: data.hasSpoiler })
      }
    } catch (error: any) {
      // Media metadata was already saved successfully above.
      // Log the spoiler update failure but do not fail the whole save,
      // otherwise the user would see an error even though metadata is persisted.
      console.error('Failed to update media spoiler', error)
    }

    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const isDeleteModalOpen = ref(false)
const mediaToDeleteMediaId = ref<string | null>(null)
const isDeleting = ref(false)

function normalizeMediaLinks(items: MediaLinkItem[]): MediaLinkItem[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// Create a local reactive copy of media for drag and drop
const localMedia = ref<MediaLinkItem[]>(normalizeMediaLinks(props.media))

// Watch for changes in props.media to update localMedia
watch(() => props.media, (newMedia) => {
  localMedia.value = normalizeMediaLinks(newMedia)
}, { deep: true })

const mediaTypeOptions = [
  { value: 'IMAGE', label: t('media.type.image', 'Image') },
  { value: 'VIDEO', label: t('media.type.video', 'Video') },
  { value: 'AUDIO', label: t('media.type.audio', 'Audio') },
  { value: 'DOCUMENT', label: t('media.type.document', 'Document') },
]

const sourceTypeOptions = [
  { value: 'URL', label: 'URL' },
  { value: 'TELEGRAM', label: 'Telegram File ID' },
]



function triggerFileInput() {
  fileInput.value?.triggerFileInput()
}

function getDefaultOptimizationParams() {
  const projectOpt = currentProjectOptimization.value
  if (projectOpt) {
    return JSON.parse(JSON.stringify(projectOpt))
  }
  
  return JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS))
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    const files = Array.from(target.files)
    if (showExtendedOptions.value) {
      stagedFiles.value.push(...files)
    } else {
      const defaults = getDefaultOptimizationParams()
      await uploadFiles(files, defaults)
    }
    target.value = ''
  }
}

async function uploadFiles(files: FileList | File[], options?: any) {
  const fileArray = Array.from(files)
  if (fileArray.length === 0) return

  uploadProgress.value = true
  uploadProgressPercent.value = 0
  
  const progresses = new Array(fileArray.length).fill(0)
  
  const optimizeParams = options

  try {
      const uploadedMediaItems = await Promise.all(
        fileArray.map(async (file, index) => {
          return await uploadMedia(file, (progress) => {
            progresses[index] = progress
            const totalProgress = progresses.reduce((a, b) => a + b, 0)
            uploadProgressPercent.value = Math.round(totalProgress / fileArray.length)
          }, optimizeParams, currentProject.value?.id)
        })
      ) as any[]
      
      if (props.publicationId) {
        await addMediaToPublication(
          props.publicationId, 
          uploadedMediaItems.map(m => ({ id: m.id }))
        )
      } else if (props.onAdd) {
        await props.onAdd(uploadedMediaItems)
      }
    
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('media.uploadError', 'Failed to upload files'),
      color: 'error',
    })
  } finally {
    uploadProgress.value = false
    uploadProgressPercent.value = 0
  }
}

async function addMedia() {
  if (!sourceInput.value.trim()) return

  uploadProgress.value = true
  try {
    let uploadedMedia: MediaItem

    if (sourceType.value === 'URL') {
      // For URL type: download file and save to filesystem with original URL in meta
      const defaults = getDefaultOptimizationParams()
      const optimizeParams = showExtendedOptions.value
        ? optimizationSettings.value
        : defaults

      uploadedMedia = await uploadMediaFromUrl(
        sourceInput.value.trim(),
        filenameInput.value.trim() || undefined,
        optimizeParams
      )
    } else {
      // For TELEGRAM type: create media record directly
      const newMedia: CreateMediaInput = {
        type: mediaType.value,
        storageType: 'TELEGRAM',
        storagePath: sourceInput.value.trim(),
        filename: filenameInput.value.trim() || undefined,
      }
      
      if (props.publicationId) {
        await addMediaToPublication(props.publicationId, [newMedia])
      } else if (props.onAdd) {
        // Create media record first if not in publication context
        const created = await createMedia(newMedia)
        await props.onAdd([created])
      }
      
      sourceInput.value = ''
      filenameInput.value = ''
      isAddingMedia.value = false
      emit('refresh')
      return
    }

    // For URL: add the downloaded media to publication
    if (props.publicationId) {
      await addMediaToPublication(props.publicationId, [{ id: uploadedMedia.id }])
    } else if (props.onAdd) {
      await props.onAdd([uploadedMedia])
    }
    
    sourceInput.value = ''
    filenameInput.value = ''
    isAddingMedia.value = false
    
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('media.addError', 'Failed to add media'),
      color: 'error',
    })
  } finally {
    uploadProgress.value = false
  }
}

async function confirmAndUploadExtended() {
  if (stagedFiles.value.length === 0 && !sourceInput.value.trim()) return

  uploadProgress.value = true
  try {
    // 1. Upload staged files
    if (stagedFiles.value.length > 0) {
      await uploadFiles(stagedFiles.value, optimizationSettings.value)
      stagedFiles.value = []
    }

    // 2. Upload from URL if present
    if (sourceInput.value.trim()) {
      await addMedia()
    }

    isAddingMedia.value = false
    showExtendedOptions.value = false
  } catch (error) {
    // Error handled in uploadFiles/addMedia
  } finally {
    uploadProgress.value = false
  }
}

function removeStagedFile(index: number) {
  stagedFiles.value.splice(index, 1)
}

function toggleExtendedOptions() {
  showExtendedOptions.value = !showExtendedOptions.value
  isAddingMedia.value = showExtendedOptions.value
}

function handleDeleteClick(mediaId: string) {
  mediaToDeleteMediaId.value = mediaId
  isDeleteModalOpen.value = true
}

async function confirmRemoveMedia() {
  if (!mediaToDeleteMediaId.value) return

  isDeleting.value = true
  try {
    await deleteMedia(mediaToDeleteMediaId.value)

    // Emit event to refresh publication data
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

async function handleDragEnd() {
  isDragging.value = false

  // Prepare the reorder data
  const reorderData = localMedia.value
    .filter(item => item.id)
    .map((item, index) => ({ id: item.id!, order: index }))

  // Keep local order fields consistent with array order.
  for (let i = 0; i < localMedia.value.length; i += 1) {
    const item = localMedia.value[i]
    if (item) {
      item.order = i
    }
  }

  try {
    if (props.publicationId) {
      await reorderMediaInPublication(props.publicationId, reorderData)
    } else if (props.onReorder) {
      await props.onReorder(reorderData)
    }

    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('media.reorderError', 'Failed to reorder media'),
      color: 'error',
    })
    
    // Revert to original order on error
    localMedia.value = normalizeMediaLinks(props.media)
  }
}

function handleDragStart() {
  isDragging.value = true
}

function handleNativeDragStart(event: DragEvent, media?: MediaItem) {
  if (!media) return
  try {
    const url = getMediaFileUrl(media.id, authStore.accessToken || undefined, media.updatedAt, true)
    const absoluteUrl = new URL(url, window.location.origin).href
    const mime = media.mimeType || 'application/octet-stream'
    const filename = media.filename || 'file'

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy'
    }
    // Chrome/Edge on Windows and Mac
    event.dataTransfer?.setData('DownloadURL', `${mime}:${filename}:${absoluteUrl}`)
    
    // Linux/KDE fallback (often creates a shortcut or prompts to download)
    event.dataTransfer?.setData('text/uri-list', `${absoluteUrl}\r\n`)
    event.dataTransfer?.setData('text/plain', absoluteUrl)
  } catch (error) {
    console.error('Failed to set drag data', error)
  }
}

// Drag and drop file upload handlers
const isDropZoneActive = ref(false)

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDropZoneActive.value = true
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDropZoneActive.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDropZoneActive.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDropZoneActive.value = false

  const files = event.dataTransfer?.files
  if (files) {
    if (showExtendedOptions.value) {
      stagedFiles.value.push(...Array.from(files))
    } else {
      const defaults = getDefaultOptimizationParams()
      await uploadFiles(files, defaults.enabled ? defaults : undefined)
    }
  }
}

// Computed property to get current media index
const currentMediaIndex = computed(() => {
  if (!selectedMedia.value) return -1
  return localMedia.value.findIndex(item => item.media?.id === selectedMedia.value?.id)
})

// Check if there's a previous media item
const hasPreviousMedia = computed(() => currentMediaIndex.value > 0)

// Check if there's a next media item
const hasNextMedia = computed(() => {
  return currentMediaIndex.value >= 0 && currentMediaIndex.value < localMedia.value.length - 1
})

function openMediaModal(item: MediaLinkItem) {
  if (!item.media) return
  selectedMedia.value = item.media
  selectedMediaLinkId.value = item.id || null
  editableHasSpoiler.value = !!item.hasSpoiler
  // editableMetadata is now a JSON object, not a YAML string
  editableMetadata.value = item.media.meta || {}
  editableAlt.value = item.media.alt || ''
  editableDescription.value = item.media.description || ''
  isModalOpen.value = true

  // Fetch full media info from media storage
  if (item.media.id) {
    fetchMedia(item.media.id).then(fullMedia => {
      if (fullMedia && selectedMedia.value && selectedMedia.value.id === fullMedia.id) {
        selectedMedia.value.fullMediaMeta = fullMedia.fullMediaMeta
        selectedMedia.value.publicToken = fullMedia.publicToken
      }
    })
  }
}

function closeMediaModal() {
  isModalOpen.value = false
  selectedMedia.value = null
  selectedMediaLinkId.value = null
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


const transitionName = ref('slide-next')

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

// Keyboard navigation
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

// Add keyboard listener when modal is open
watch(isModalOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

// Swipe navigation
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

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Reset data when changing media
watch(selectedMedia, () => {
  // Reset any temporary state if needed
})



// formatBytes and getMediaIcon moved to utils/media.ts

const compressionStats = computed(() => {
  const meta = selectedMedia.value?.meta
  
  // Debug logging
  
  if (!meta) return null
  

  // Try both camelCase and snake_case for the original size
  const original = meta.originalSize || meta.original_size
  // Use size from meta or the top-level sizeBytes
  const current = meta.size || selectedMedia.value?.sizeBytes
  
  
  
  if (!original || !current || Number(original) === Number(current)) return null

  const originalNum = Number(original)
  const currentNum = Number(current)
  const saved = originalNum - currentNum
  
  // Only show if there is actually some meaningful compression (> 1KB)
  if (saved < 1024) return null

  const percent = Math.round((saved / originalNum) * 100)
  const ratio = (originalNum / currentNum).toFixed(1)

  // Get quality and lossless from root or optimizationParams
  const params = meta.optimizationParams || {}
  const quality = meta.quality ?? params.quality
  const lossless = meta.lossless ?? params.lossless

  const stats = {
    originalSize: formatBytes(originalNum),
    optimizedSize: formatBytes(currentNum),
    savedPercent: percent,
    ratio,
    quality: quality,
    lossless: lossless,
    originalFormat: meta.originalMimeType || meta.original_mime_type,
    optimizedFormat: meta.mimeType || meta.mime_type
  }
  
  
  return stats
})

const exifData = computed(() => {
  const exif = selectedMedia.value?.fullMediaMeta?.exif
  return exif
})

const resolution = computed(() => {
  const meta = selectedMedia.value?.meta
  const fullMeta = selectedMedia.value?.fullMediaMeta
  
  // Try to find width and height in various common locations
  const w = fullMeta?.width || meta?.width || fullMeta?.video?.width || meta?.video?.width
  const h = fullMeta?.height || meta?.height || fullMeta?.video?.height || meta?.video?.height
  
  if (w && h) {
    return `${w} × ${h}`
  }
  
  // Fallback to EXIF if available
  if (exifData.value) {
    const exifW = exifData.value.ImageWidth || exifData.value.ExifImageWidth
    const exifH = exifData.value.ImageHeight || exifData.value.ExifImageHeight
    if (exifW && exifH) {
      return `${exifW} × ${exifH}`
    }
  }

  return null
})

const publicMediaUrl = computed(() => {
  if (!selectedMedia.value?.publicToken || !selectedMedia.value?.id) return null
  return getPublicMediaUrl(selectedMedia.value.id, selectedMedia.value.publicToken)
})

function copyPublicLink() {
  if (publicMediaUrl.value) {
    navigator.clipboard.writeText(publicMediaUrl.value)
  }
}



function downloadMediaFile(media: MediaItem) {
  const url = getMediaFileUrl(media.id, undefined, undefined, true)
  const filename = media.filename || `media_${media.id}`
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Media validation
const mediaValidation = computed(() => {
  if (!props.showValidation || !props.socialMedia) {
    return { isValid: true, errors: [] }
  }
  
  const mediaArray = localMedia.value
    .filter(item => item.media)
    .map(item => ({
      type: item.media!.type
    }))
  
  const platforms = Array.isArray(props.socialMedia) ? props.socialMedia : [props.socialMedia]
  const allErrors: ValidationError[] = []
  
  for (const platform of platforms) {
    const result = validatePostContent(
      '',
      mediaArray.length,
      platform as any,
      mediaArray,
      props.postType
    )
    if (!result.isValid) {
      allErrors.push(...result.errors)
    }
  }
  
  // Deduplicate errors by message
  const uniqueErrors = Array.from(new Map(allErrors.map(err => [err.message, err])).values())
  
  return {
    isValid: uniqueErrors.length === 0,
    errors: uniqueErrors
  }
})
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('media.deleteConfirm')"
      :description="t('archive.delete_permanent_warning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="confirmRemoveMedia"
    />

    <div class="p-6">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-photo" class="w-5 h-5 text-gray-500"></UIcon>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('publication.media', 'Media Files') }}
        </h3>
      </div>

      <!-- Media Validation Error Alert -->
      <UAlert
        v-if="!mediaValidation.isValid && mediaValidation.errors.length > 0"
        color="error"
        variant="soft"
        class="mb-4"
        icon="i-heroicons-exclamation-triangle"
        :title="t('validation.validationWarningTitle', 'Validation Warning')"
      >
        <template #description>
          <ul class="list-disc list-inside">
            <li v-for="(error, index) in mediaValidation.errors" :key="index">
              {{ error.message }}
            </li>
          </ul>
        </template>
      </UAlert>

      <!-- Horizontal scrollable media gallery -->
      <CommonHorizontalScroll class="-mx-6 px-6">
          <!-- Upload button card (always first) -->
          <MediaUploadButton
            v-if="editable"
            ref="fileInput"
            :is-uploading="isUploading"
            :upload-progress="uploadProgress ? 1 : 0"
            :upload-progress-percent="uploadProgressPercent"
            :is-drop-zone-active="isDropZoneActive"
            :editable="editable"
            @file-upload="handleFileUpload"
            @dragenter="handleDragEnter"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          />

          <!-- Draggable Media items -->
          <VueDraggable
            v-if="localMedia.length > 0"
            v-model="localMedia"
            :disabled="!editable"
            :animation="200"
            :delay="300"
            :delay-on-touch-only="true"
            :touch-start-threshold="5"
            class="flex gap-4"
            @start="handleDragStart"
            @end="handleDragEnd"
          >
            <div
              v-for="item in localMedia"
              :key="item.id || item.media?.id"
              :class="[
                'shrink-0 relative',
                editable && 'cursor-move'
              ]"
              @dragstart="handleNativeDragStart($event, item.media)"
            >
              <MediaCard
                v-if="item.media"
                :media="item.media"
                :has-spoiler="item.hasSpoiler"
                size="md"
                @click="openMediaModal(item)"
              >
                <template #actions>
                  <!-- Delete button overlay -->
                  <div
                    v-if="editable"
                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"
                  >
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="solid"
                      size="xs"
                      @click.stop="handleDeleteClick(item.media.id)"
                    />
                    <UButton
                      v-if="props.onCopy && item.id"
                      icon="i-heroicons-document-duplicate"
                      color="neutral"
                      variant="solid"
                      size="xs"
                      :title="t('contentLibrary.actions.copyToItem')"
                      @click.stop="props.onCopy(item.id)"
                    />
                  </div>

                  <!-- Drag handle indicator -->
                  <div
                    v-if="editable"
                    class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <UIcon
                      name="i-heroicons-bars-3"
                      class="w-5 h-5 text-gray-400"
                    />
                  </div>
                </template>
              </MediaCard>
            </div>
          </VueDraggable>

          <!-- Empty state when no media -->
          <div
            v-if="!editable && (!media || media.length === 0)"
            class="shrink-0 w-48 h-48 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center"
          >
            <p class="text-sm text-gray-500 italic">
              {{ t('media.noMedia', 'No media files') }}
            </p>
          </div>
      </CommonHorizontalScroll>

      <!-- Extended Options Toggle Button -->
      <div v-if="editable" class="mt-2 flex justify-end px-6">
        <UButton
          v-if="!showExtendedOptions"
          variant="ghost"
          size="sm"
          color="neutral"
          icon="i-heroicons-adjustments-horizontal"
          @click="toggleExtendedOptions"
        >
          {{ t('media.extendedOptionsShort') }}
        </UButton>
      </div>

      <!-- Add media form (URL/Telegram/Optimization) -->
      <div v-if="isAddingMedia && editable" class="mt-6 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div class="flex-1">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ showExtendedOptions ? t('media.extendedOptions') : t('media.addFromUrl', 'Add from URL or Telegram') }}
            </h4>
            <p v-if="!showExtendedOptions" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ sourceType === 'URL' ? 'The file will be downloaded, analyzed and saved to storage' : 'You can only specify the file_id of a media file that was seen by the Gran Publicador bot' }}
            </p>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="isAddingMedia = false; showExtendedOptions = false"
          />
        </div>
        
        <div class="space-y-6">
          <!-- Staged Files List (Extended Mode) -->
          <div v-if="showExtendedOptions && stagedFiles.length > 0" class="space-y-3">
             <div class="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
               <span>{{ t('media.stagedFiles', { count: stagedFiles.length }) }}</span>
             </div>
             <div class="flex flex-wrap gap-2">
               <div 
                 v-for="(file, idx) in stagedFiles" 
                 :key="idx"
                 class="flex items-center gap-2 pl-3 pr-1 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs group"
               >
                 <span class="max-w-37.5 truncate">{{ file.name }}</span>
                 <UButton
                   icon="i-heroicons-x-mark"
                   variant="ghost"
                   color="neutral"
                   size="xs"
                   class="rounded-full h-5 w-5 p-0"
                   @click="removeStagedFile(idx)"
                 />
               </div>
             </div>
          </div>

          <div class="flex items-end gap-3 w-full">
            <UFormField :label="t('media.sourceTypeLabel', 'Source')" required class="flex-none w-48">
              <USelectMenu
                v-model="sourceType"
                :items="sourceTypeOptions"
                value-key="value"
                label-key="label"
                size="lg"
                class="w-full"
                :ui-menu="{ width: 'w-48' }"
              />
            </UFormField>

            <UFormField v-if="sourceType === 'TELEGRAM'" :label="t('media.mediaType', 'Type')" required class="flex-none w-48">
              <USelectMenu
                v-model="mediaType"
                :items="mediaTypeOptions"
                value-key="value"
                label-key="label"
                size="lg"
                class="w-full"
                :ui-menu="{ width: 'w-48' }"
              />
            </UFormField>

            <UFormField :label="t('media.filename', 'Filename')" class="flex-1">
              <UInput
                v-model="filenameInput"
                placeholder="image.jpg"
                size="lg"
                class="w-full"
                @keydown.enter.prevent="showExtendedOptions ? confirmAndUploadExtended() : addMedia()"
              />
            </UFormField>
          </div>

          <div class="w-full">
            <UFormField 
              :label="sourceType === 'URL' ? 'URL' : 'Telegram File ID'"
              :required="!showExtendedOptions || stagedFiles.length === 0"
              class="w-full"
            >
              <UInput
                v-model="sourceInput"
                :placeholder="sourceType === 'URL' ? 'https://example.com/image.jpg' : 'AgACAgIAAxkBAAI...'"
                size="lg"
                class="w-full"
                @keydown.enter.prevent="showExtendedOptions ? confirmAndUploadExtended() : addMedia()"
              />
            </UFormField>
          </div>

          <!-- Optimization settings in extended mode -->
          <div v-if="showExtendedOptions" class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <FormsProjectMediaOptimizationBlock 
              v-model="optimizationSettings"
            />
          </div>

          <div class="flex gap-3 pt-2">
            <UButton
              v-if="showExtendedOptions"
              :disabled="stagedFiles.length === 0 && !sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              color="primary"
              icon="i-heroicons-check"
              @click="confirmAndUploadExtended"
            >
              {{ uploadProgress ? t('media.uploading', 'Uploading...') : t('media.confirmAndUpload') }}
            </UButton>
            <UButton
              v-else
              :disabled="!sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              icon="i-heroicons-plus"
              @click="addMedia"
            >
              {{ uploadProgress ? t('media.uploading', 'Uploading...') : addMediaButtonLabel }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Media viewer modal -->
  <MediaViewerModal
    v-model:open="isModalOpen"
    :title="selectedMedia?.filename || t('media.preview', 'Media Preview')"
    :counter-text="currentMediaIndex >= 0 ? `${currentMediaIndex + 1} / ${localMedia.length}` : undefined"
    @close="closeMediaModal"
  >
    <template #header-right>
      <UButton
        v-if="editable && selectedMedia?.type === 'IMAGE' && (selectedMedia?.storageType === 'STORAGE' || selectedMedia?.storageType === 'TELEGRAM')"
        icon="i-heroicons-pencil-square"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="handleEditMedia"
      >
        {{ t('common.edit', 'Edit') }}
      </UButton>
      <UButton
        v-if="editable && selectedMedia?.type === 'VIDEO' && (selectedMedia?.storageType === 'STORAGE' || selectedMedia?.storageType === 'TELEGRAM')"
        icon="i-heroicons-film"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="handleEditVideo"
      >
        {{ t('common.edit', 'Edit') }}
      </UButton>
    </template>
    <div class="p-6 w-full overflow-y-auto">
      <!-- Image preview with navigation buttons -->
      <div v-if="selectedMedia" class="mb-6 relative">
        <!-- Previous button -->
        <UButton
          v-if="hasPreviousMedia"
          icon="i-heroicons-chevron-left"
          variant="solid"
          color="neutral"
          size="lg"
          class="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-70 hover:opacity-100 transition-opacity"
          @click="navigateToPreviousMedia"
        />
        
        <!-- Media content -->
        <div 
          ref="swipeElement"
          class="flex justify-center bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden touch-pan-y relative min-h-[40vh] max-h-[70vh]"
        >
          <Transition :name="transitionName">
            <MediaViewerItem 
              v-if="selectedMedia"
              :key="selectedMedia.id"
              :media="selectedMedia"
            />
          </Transition>
        </div>

        <!-- Next button -->
        <UButton
          v-if="hasNextMedia"
          icon="i-heroicons-chevron-right"
          variant="solid"
          color="neutral"
          size="lg"
          class="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-70 hover:opacity-100 transition-opacity"
          @click="navigateToNextMedia"
        />
      </div>

      <!-- Metadata -->
      <div v-if="selectedMedia" class="w-full">
        <MediaDetailsViewer
          :media="selectedMedia"
          :resolution="resolution"
          :exif-data="exifData"
          :compression-stats="compressionStats"
          :public-media-url="publicMediaUrl"
          @copy-link="copyPublicLink"
          @download="downloadMediaFile(selectedMedia)"
        />

        <MediaDetailsEditor
          v-if="editable"
          class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
          :media="selectedMedia"
          :editable="editable"
          v-model:hasSpoiler="editableHasSpoiler"
          v-model:description="editableDescription"
          v-model:alt="editableAlt"
          v-model:metadata="editableMetadata"
        />
      </div>
    </div>
    
    <template #footer>
      <div
        v-if="editable"
        class="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800"
      >
        <UiSaveStatusIndicator
          :status="mediaIndicatorStatus" 
          :visible="isMediaIndicatorVisible"
          :error="mediaSaveError" 
        />

        <UButton
          icon="i-heroicons-check"
          variant="solid"
          color="primary"
          :loading="mediaSaveStatus === 'saving'"
          @click="closeMediaModal"
        >
          {{ t('common.done', 'Done') }}
        </UButton>
      </div>
    </template>

  </MediaViewerModal>
</template>

<style scoped>
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: all 0.3s ease-out;
}

.slide-next-enter-from {
  opacity: 0;
  transform: translateX(50px);
}

.slide-next-leave-to {
  opacity: 0;
  transform: translateX(-50px);
}

.slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-50px);
}

.slide-prev-leave-to {
  opacity: 0;
  transform: translateX(50px);
}

:deep(.sortable-chosen) {
  opacity: 0.9;
  transform: scale(1.05);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  z-index: 50;
  cursor: grabbing !important;
}

:deep(.sortable-ghost) {
  opacity: 0.2;
  filter: grayscale(1);
}
</style>
