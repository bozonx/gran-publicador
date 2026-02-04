<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'
import { useProjects } from '~/composables/useProjects'
import { useAuthStore } from '~/stores/auth'
import { MEDIA_OPTIMIZATION_PRESETS } from '~/utils/media-presets'

interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
  alt?: string
  description?: string
  mimeType?: string
  sizeBytes?: number | string
  meta?: Record<string, any>
  fullMediaMeta?: Record<string, any>
  publicToken?: string
}


interface Props {
  media: Array<{
    id?: string
    media?: MediaItem
    order: number
    hasSpoiler?: boolean
  }>
  publicationId?: string
  editable?: boolean
  socialMedia?: string | string[]
  showValidation?: boolean
  postType?: string
  // Generic callbacks for when not used in a publication context
  onAdd?: (media: CreateMediaInput[]) => Promise<void>
  onRemove?: (mediaId: string) => Promise<void>
  onReorder?: (reorderData: Array<{ id: string; order: number }>) => Promise<void>
  onUpdateLink?: (mediaLinkId: string, data: { hasSpoiler?: boolean; order?: number }) => Promise<void>
  onCopy?: (mediaLinkId: string) => Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  showValidation: true,
})

const { t } = useI18n()
const authStore = useAuthStore()
const { currentProject } = useProjects()
const {
  deleteMedia,
  uploadMedia, 
  uploadMediaFromUrl, 
  isLoading: isUploading, 
  addMediaToPublication, 
  removeMediaFromPublication, 
  reorderMediaInPublication,
  updateMediaLinkInPublication,
  fetchMedia,
} = useMedia()
const { validatePostContent } = useSocialMediaValidation()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
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
const optimizationSettings = ref<any>({
  enabled: false,
  skipOptimization: false
})

const currentProjectOptimization = computed(() => {
  return currentProject.value?.preferences?.mediaOptimization
})

// Initialize optimization settings with project defaults when opening extended options
watch(showExtendedOptions, (val) => {
  if (val) {
    if (currentProjectOptimization.value) {
      optimizationSettings.value = JSON.parse(JSON.stringify(currentProjectOptimization.value))
    } else {
      // Use Standard preset as fallback
      const standard = JSON.parse(JSON.stringify(MEDIA_OPTIMIZATION_PRESETS.standard))
      optimizationSettings.value = {
        ...standard,
        enabled: true // Enable by default when opening advanced settings if no project default
      }
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
const isEditorOpen = ref(false)

const editableMetadata = ref<Record<string, any> | null>(null)
const editableAlt = ref('')
const editableDescription = ref('')
const isSavingMeta = ref(false)

const isDeleteModalOpen = ref(false)
const mediaToDeleteId = ref<string | null>(null)
const isDeleting = ref(false)

// Create a local reactive copy of media for drag and drop
const localMedia = ref([...props.media])

// Watch for changes in props.media to update localMedia
watch(() => props.media, (newMedia) => {
  localMedia.value = [...newMedia]
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

function getMediaIcon(type: string) {
  const icons: Record<string, string> = {
    IMAGE: 'i-heroicons-photo',
    VIDEO: 'i-heroicons-video-camera',
    AUDIO: 'i-heroicons-musical-note',
    DOCUMENT: 'i-heroicons-document',
  }
  return icons[type] || 'i-heroicons-document'
}


function triggerFileInput() {
  fileInput.value?.click()
}


function getDefaultOptimizationParams() {
  const projectOpt = currentProjectOptimization.value
  if (projectOpt) {
    // If project explicitly says skip, respect it
    if (projectOpt.skipOptimization) {
      return { enabled: false, skipOptimization: true }
    }
    // If project has custom settings enabled, use them
    if (projectOpt.enabled) {
      return JSON.parse(JSON.stringify(projectOpt))
    }
  }
  
  // Otherwise (no project settings or disabled in project), use standard preset
  return JSON.parse(JSON.stringify(MEDIA_OPTIMIZATION_PRESETS.standard))
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    if (showExtendedOptions.value) {
      stagedFiles.value.push(...Array.from(target.files))
      if (fileInput.value) fileInput.value.value = ''
    } else {
      const defaults = getDefaultOptimizationParams()
      await uploadFiles(target.files, defaults.enabled ? defaults : undefined)
    }
  }
}

async function uploadFiles(files: FileList | File[], options?: any) {
  const fileArray = Array.from(files)
  if (fileArray.length === 0) return

  uploadProgress.value = true
  uploadProgressPercent.value = 0
  
  const progresses = new Array(fileArray.length).fill(0)
  
  let optimizeParams: any = undefined
  if (options?.skipOptimization) {
    optimizeParams = { enabled: false }
  } else if (options?.enabled) {
    optimizeParams = options
  }

  try {
    const uploadedMediaItems = await Promise.all(
      fileArray.map(async (file, index) => {
        return await uploadMedia(file, (progress) => {
          progresses[index] = progress
          const totalProgress = progresses.reduce((a, b) => a + b, 0)
          uploadProgressPercent.value = Math.round(totalProgress / fileArray.length)
        }, optimizeParams)
      })
    )
    
    if (props.publicationId) {
      await addMediaToPublication(
        props.publicationId, 
        uploadedMediaItems.map(m => ({ id: m.id }))
      )
    } else if (props.onAdd) {
      await props.onAdd(uploadedMediaItems.map(m => ({ id: m.id })))
    }
    
    toast.add({
      title: t('common.success'),
      description: t('media.uploadSuccess', 'Files uploaded successfully'),
      color: 'success',
    })
    
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.uploadError', 'Failed to upload files'),
      color: 'error',
    })
  } finally {
    uploadProgress.value = false
    uploadProgressPercent.value = 0
  }
}

const { updateMedia } = useMedia()

async function saveMediaMeta() {
  if (!selectedMedia.value) return

  isSavingMeta.value = true
  try {
    const updated = await updateMedia(selectedMedia.value.id, {
      alt: editableAlt.value || undefined,
      description: editableDescription.value || undefined,
      meta: editableMetadata.value || undefined
    })

    // Update local state
    selectedMedia.value.meta = updated.meta
    selectedMedia.value.alt = updated.alt
    selectedMedia.value.description = updated.description
    
    toast.add({
      title: t('common.success'),
      description: t('common.saveSuccess', 'Saved successfully'),
      color: 'success',
    })
    
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('common.saveError', 'Failed to save'),
      color: 'error',
    })
  } finally {
    isSavingMeta.value = false
  }

  // Handle PublicationMedia.hasSpoiler update
  if (selectedMediaLinkId.value) {
    try {
      if (props.publicationId) {
        await updateMediaLinkInPublication(
          props.publicationId,
          selectedMediaLinkId.value,
          { hasSpoiler: editableHasSpoiler.value }
        )
      } else if (props.onUpdateLink) {
        await props.onUpdateLink(selectedMediaLinkId.value, { hasSpoiler: editableHasSpoiler.value })
      }
    } catch (error: any) {
      console.error('Failed to update media spoiler', error)
    }
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
      let optimizeParams: any = undefined
      
      if (showExtendedOptions.value) {
        if (optimizationSettings.value.skipOptimization) {
          optimizeParams = { enabled: false }
        } else if (optimizationSettings.value.enabled) {
          optimizeParams = optimizationSettings.value
        }
      } else {
        if (defaults.skipOptimization) {
          optimizeParams = { enabled: false }
        } else {
          optimizeParams = defaults 
        }
      }

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
        await props.onAdd([newMedia])
      }
      
      toast.add({
        title: t('common.success'),
        description: t('media.addSuccess', 'Media added successfully'),
        color: 'success',
      })
      
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
      await props.onAdd([{ id: uploadedMedia.id }])
    }
    
    toast.add({
      title: t('common.success'),
      description: t('media.addSuccess', 'Media added successfully'),
      color: 'success',
    })
    
    sourceInput.value = ''
    filenameInput.value = ''
    isAddingMedia.value = false
    
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.addError', 'Failed to add media'),
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
  mediaToDeleteId.value = mediaId
  isDeleteModalOpen.value = true
}

async function confirmRemoveMedia() {
  if (!mediaToDeleteId.value) return

  isDeleting.value = true
  try {
    if (props.publicationId) {
      await removeMediaFromPublication(props.publicationId, mediaToDeleteId.value)
    } else if (props.onRemove) {
      await props.onRemove(mediaToDeleteId.value)
    }
    
    toast.add({
      title: t('common.success'),
      description: t('media.removeSuccess', 'Media removed successfully'),
      color: 'success',
    })
    
    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.removeError', 'Failed to remove media'),
      color: 'error',
    })
  } finally {
    isDeleting.value = false
    isDeleteModalOpen.value = false
    mediaToDeleteId.value = null
  }
}



async function handleDragEnd() {
  isDragging.value = false
  
  // Prepare the reorder data
  const reorderData = localMedia.value
    .filter(item => item.id) // Only include items with IDs
    .map((item, index) => ({
      id: item.id!,
      order: index,
    }))

  try {
    if (props.publicationId) {
      await reorderMediaInPublication(props.publicationId, reorderData)
    } else if (props.onReorder) {
      await props.onReorder(reorderData)
    }
    
    toast.add({
      title: t('common.success'),
      description: t('media.reorderSuccess', 'Media reordered successfully'),
      color: 'success',
    })
    
    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.reorderError', 'Failed to reorder media'),
      color: 'error',
    })
    
    // Revert to original order on error
    localMedia.value = [...props.media]
  }
}

function handleDragStart() {
  isDragging.value = true
}

// Drag and drop file upload handlers
const isDropZoneActive = ref(false)

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

const selectedItem = computed(() => {
  if (currentMediaIndex.value === -1) return null
  return localMedia.value[currentMediaIndex.value]
})

function openMediaModal(item: typeof localMedia.value[0]) {
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
  isEditorOpen.value = true
}

async function handleEditorSave(file: File) {
    if (!selectedMedia.value || !selectedMediaLinkId.value) return

    isSavingMeta.value = true
    try {
        // 1. Upload new edited image
        // Use current optimization settings if available
        const defaults = getDefaultOptimizationParams()
        const optimizeParams = showExtendedOptions.value ? optimizationSettings.value : defaults
        
        const newMedia = await uploadMedia(file, undefined, optimizeParams)
        
        // 2. Add to publication at the same position or just add it
        // To make it a true "replace", we should remove the old one.
        
        // Find current index
        const oldIndex = currentMediaIndex.value
        
        // Remove old media link
        if (props.publicationId) {
          await removeMediaFromPublication(props.publicationId, selectedMediaLinkId.value)
        } else if (props.onRemove) {
          await props.onRemove(selectedMediaLinkId.value)
        }
        
        // Add new media link
        if (props.publicationId) {
          await addMediaToPublication(props.publicationId, [{ id: newMedia.id }])
        } else if (props.onAdd) {
          await props.onAdd([{ id: newMedia.id }])
        }
        
        // After adding, it will be at the end. If we want to preserve order, we should reorder.
        // But the refresh will happen and user can move it.
        // For now, let's just refresh.
        
        toast.add({
            title: t('common.success'),
            description: t('media.editSuccess', 'Image edited successfully'),
            color: 'success',
        })
        
        isEditorOpen.value = false
        isModalOpen.value = false
        emit('refresh')
    } catch (error: any) {
        toast.add({
            title: t('common.error'),
            description: error.message || t('media.editError', 'Failed to save edited image'),
            color: 'error',
        })
    } finally {
        isSavingMeta.value = false
    }
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



function formatBytes(bytes?: number | string): string {
  if (!bytes || bytes === 0 || bytes === '0') return '0 B'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  const val = b / Math.pow(k, i)
  return (val < 10 ? val.toFixed(2) : val.toFixed(1)) + ' ' + sizes[i]
}

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

const publicMediaUrl = computed(() => {
  if (!selectedMedia.value?.publicToken || !selectedMedia.value?.id) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/v1/media/p/${selectedMedia.value.id}/${selectedMedia.value.publicToken}`
})

function copyPublicLink() {
  if (publicMediaUrl.value) {
    navigator.clipboard.writeText(publicMediaUrl.value)
    toast.add({
      title: t('common.success'),
      description: t('common.copied', 'Copied to clipboard'),
      color: 'success',
    })
  }
}



function downloadMediaFile(media: MediaItem) {
  const url = getMediaFileUrl(media.id)
  const filename = media.filename || `media_${media.id}`
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.target = '_blank'
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

interface Emits {
  (e: 'refresh'): void
}

const emit = defineEmits<Emits>()
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
          <div
            v-if="editable"
            :class="[
              'shrink-0 w-48 h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group relative overflow-hidden',
              isDropZoneActive 
                ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            ]"
            @click="triggerFileInput"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <!-- Progress bar background -->
            <div
              v-if="uploadProgress"
              class="absolute bottom-0 left-0 h-1 bg-primary-500 dark:bg-primary-400 transition-all duration-300"
              :style="{ width: `${uploadProgressPercent}%` }"
            ></div>
            
            <input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              @change="handleFileUpload"
            />
            <UIcon
              :name="isDropZoneActive ? 'i-heroicons-arrow-down-tray' : 'i-heroicons-arrow-up-tray'"
              :class="[
                'w-8 h-8 transition-colors',
                isDropZoneActive 
                  ? 'text-primary-500 dark:text-primary-400' 
                  : 'text-gray-400 group-hover:text-primary-500'
              ]"
            ></UIcon>
            <span 
              :class="[
                'text-sm font-medium transition-colors text-center px-2',
                isDropZoneActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-primary-500'
              ]"
            >
              {{ 
                uploadProgress || isUploading 
                  ? `${t('media.uploading', 'Uploading...')} ${uploadProgressPercent}%`
                  : isDropZoneActive
                    ? t('media.dropHere', 'Drop file here')
                    : t('media.uploadFile', 'Upload File') 
              }}
            </span>
          </div>

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
              :key="item.media?.id"
              :class="[
                'shrink-0 relative',
                editable && 'cursor-move'
              ]"
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
                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="solid"
                      size="xs"
                      @click.stop="handleDeleteClick(item.media.id)"
                    />
                    <UButton
                      v-if="props.onCopy"
                      icon="i-heroicons-document-duplicate"
                      color="neutral"
                      variant="solid"
                      size="xs"
                      :title="t('contentLibrary.actions.copyToItem')"
                      @click.stop="props.onCopy(item.id!)"
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
                 <span class="max-w-[150px] truncate">{{ file.name }}</span>
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
            <UFormField :label="t('media.sourceType', 'Source')" required class="flex-none w-48">
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
              :project-defaults="currentProjectOptimization"
            />
          </div>

          <div class="flex gap-3 pt-2">
            <UButton
              v-if="showExtendedOptions"
              @click="confirmAndUploadExtended"
              :disabled="stagedFiles.length === 0 && !sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              color="primary"
              icon="i-heroicons-check"
            >
              {{ uploadProgress ? t('media.uploading', 'Uploading...') : t('media.confirmAndUpload') }}
            </UButton>
            <UButton
              v-else
              @click="addMedia"
              :disabled="!sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              icon="i-heroicons-plus"
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
        v-if="editable && selectedMedia?.type === 'IMAGE'"
        icon="i-heroicons-pencil-square"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="handleEditMedia"
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
            <div :key="selectedMedia.id" class="absolute inset-0 flex items-center justify-center">
              <img
                v-if="selectedMedia.type === 'IMAGE'"
                :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                :alt="selectedMedia.filename || 'Media'"
                class="max-w-full max-h-full object-contain"
              />
              <div v-else-if="selectedMedia.type === 'VIDEO'" class="w-full h-full flex items-center justify-center relative group">
                <video
                  controls
                  autoplay
                  class="max-w-full max-h-full"
                  :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div v-else-if="selectedMedia.type === 'AUDIO'" class="w-full h-full flex items-center justify-center relative group">
                <!-- Decorative background -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                   <UIcon name="i-heroicons-musical-note" class="w-96 h-96 text-primary-500 dark:text-primary-400" />
                </div>
                
                <!-- Player Card -->
                <div class="relative z-10 w-full max-w-[90%] sm:max-w-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center gap-6">
                    
                    <!-- Icon / Art -->
                    <div class="relative group/icon cursor-default">
                        <div class="absolute -inset-1 bg-linear-to-r from-primary-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover/icon:opacity-50 transition duration-1000"></div>
                        <div class="relative w-32 h-32 rounded-2xl bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow-inner flex items-center justify-center ring-1 ring-gray-900/5 dark:ring-white/10">
                             <UIcon name="i-heroicons-musical-note" class="w-16 h-16 text-gray-400 dark:text-gray-500" />
                        </div>
                    </div>
            
                    <!-- Info -->
                    <div class="space-y-1.5 w-full">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white truncate px-2">
                            {{ selectedMedia.filename || 'Audio Track' }}
                        </h3>
                        <p class="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {{ selectedMedia.mimeType || 'AUDIO' }}
                        </p>
                    </div>
            
                    <!-- HTML5 Audio -->
                    <audio
                        controls
                        autoplay
                        class="w-full mt-2"
                        :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                    >
                         Your browser does not support the audio element.
                    </audio>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-full w-full">
                <UIcon
                  :name="getMediaIcon(selectedMedia.type)"
                  class="w-24 h-24 text-gray-400"
                />
              </div>
            </div>
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
        <!-- Read-only fields -->
        <div class="space-y-1 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-mono overflow-x-auto">
          <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">type:</span>
            <span class="text-gray-900 dark:text-gray-200">
              {{ selectedMedia.storageType }}, {{ selectedMedia.type }}{{ selectedMedia.mimeType ? `, ${selectedMedia.mimeType}` : '' }}
            </span>
          </div>
          <div v-if="selectedMedia.sizeBytes" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">size:</span>
            <span class="text-gray-900 dark:text-gray-200">{{ formatBytes(selectedMedia.sizeBytes) }}</span>
          </div>
          <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">path:</span>
            <span class="text-gray-900 dark:text-gray-200 whitespace-nowrap">{{ selectedMedia.storagePath }}</span>
          </div>
          <div v-if="selectedMedia.filename" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">filename:</span>
            <span class="text-gray-900 dark:text-gray-200 whitespace-nowrap">{{ selectedMedia.filename }}</span>
          </div>
          <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">id:</span>
            <div class="flex items-center gap-2">
              <span 
                class="text-gray-900 dark:text-gray-200 truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                @click="downloadMediaFile(selectedMedia)"
              >
                {{ selectedMedia.id }}
              </span>
              <UIcon 
                name="i-heroicons-arrow-down-tray" 
                class="w-4 h-4 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors shrink-0"
                @click="downloadMediaFile(selectedMedia)"
              />
            </div>
          </div>
          <div v-if="publicMediaUrl" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
            <span class="text-gray-500 shrink-0">public url:</span>
            <div class="flex items-center gap-2 min-w-0">
               <span class="text-gray-900 dark:text-gray-200 truncate font-mono text-xs select-all">{{ publicMediaUrl }}</span>
               <UButton 
                 icon="i-heroicons-clipboard-document"
                 variant="ghost"
                 color="neutral"
                 size="xs"
                 class="-my-1"
                 @click="copyPublicLink"
               />
               <UButton 
                 icon="i-heroicons-arrow-top-right-on-square"
                 variant="ghost"
                 color="neutral"
                 size="xs"
                 class="-my-1"
                 :to="publicMediaUrl"
                 target="_blank"
               />
            </div>
          </div>
        </div>

        <!-- Compression statistics -->
        <div v-if="compressionStats" class="mb-6 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800/50">
          <div class="flex items-center gap-2 mb-3 text-primary-700 dark:text-primary-300">
            <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
            <span class="font-semibold text-sm">{{ t('media.compressionRatio', 'Compression') }}</span>
            <span v-if="compressionStats.originalFormat && compressionStats.optimizedFormat && compressionStats.originalFormat !== compressionStats.optimizedFormat" class="ml-auto text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {{ compressionStats.originalFormat.split('/')[1]?.toUpperCase() }} <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 inline -mt-0.5 mx-0.5" /> {{ compressionStats.optimizedFormat.split('/')[1]?.toUpperCase() }}
            </span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{{ t('media.originalSize') }}</div>
              <div class="text-sm font-mono">{{ compressionStats.originalSize }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{{ t('media.optimizedSize') }}</div>
              <div class="text-sm font-mono text-primary-600 dark:text-primary-400">{{ compressionStats.optimizedSize }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{{ t('media.savedSpace') }}</div>
              <div class="text-sm font-mono text-green-600 dark:text-green-400 font-bold">
                {{ compressionStats.savedPercent }}%
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Ratio</div>
              <div class="text-sm font-mono">{{ compressionStats.ratio }}x</div>
            </div>
            <div v-if="compressionStats.quality" class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{{ t('media.quality') }}</div>
              <div class="text-sm font-mono">{{ compressionStats.quality }}%</div>
            </div>
            <div v-if="compressionStats.lossless !== undefined" class="space-y-1">
              <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{{ t('media.lossless') }}</div>
              <div class="text-sm font-mono flex items-center gap-1">
                <UIcon :name="compressionStats.lossless ? 'i-heroicons-check' : 'i-heroicons-x-mark'" :class="compressionStats.lossless ? 'text-green-500' : 'text-gray-400'" class="w-4 h-4" />
                <span>{{ compressionStats.lossless ? t('common.yes') : t('common.no') }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="editable" class="mb-6 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800/50">
          <UCheckbox
            v-model="editableHasSpoiler"
            :label="t('media.hasSpoiler', 'Hide content (spoiler)')"
            :description="t('media.spoilerDescription', 'Content will be hidden until user clicks')"
            color="warning"
          />
          <div v-if="selectedMedia.meta?.telegram?.hasSpoiler" class="mt-2 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
            <span>{{ t('media.originalSpoilerFromTelegram', 'Original message from Telegram had spoiler') }}</span>
          </div>
        </div>

        <div v-if="editable" class="space-y-4 mb-4">
          <UFormField>
            <template #label>
              <div class="flex items-center gap-1.5">
                <span>{{ t('media.description') }}</span>
                <CommonInfoTooltip :text="t('media.descriptionTooltip')" />
              </div>
            </template>
            <UTextarea 
              v-model="editableDescription" 
              :placeholder="t('media.descriptionPlaceholder', 'Description of the media')" 
              :rows="3"
              class="w-full"
            />
          </UFormField>

          <UFormField>
            <template #label>
              <div class="flex items-center gap-1.5">
                <span>{{ t('media.alt') }}</span>
                <CommonInfoTooltip :text="t('media.altTooltip')" />
              </div>
            </template>
            <UInput 
              v-model="editableAlt" 
              :placeholder="t('media.altPlaceholder', 'Alt text for the image')" 
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="mt-4">
           <CommonMetadataEditor
              v-model="editableMetadata"
              :rows="8"
           />
        </div>

        <!-- EXIF Data Display -->
        <div v-if="exifData" class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
            <UIcon name="i-heroicons-camera" class="w-5 h-5" />
            <span class="font-semibold text-sm">{{ t('media.exif', 'EXIF Data') }}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div v-for="(value, key) in exifData" :key="key" class="flex flex-col">
              <span class="text-gray-500 font-medium">{{ key }}</span>
              <span class="text-gray-900 dark:text-gray-200 truncate" :title="String(value)">{{ value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div v-if="editable" class="flex justify-end gap-2 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
        <UButton
          icon="i-heroicons-check"
          variant="solid"
          color="primary"
          :loading="isSavingMeta"
          @click="saveMediaMeta"
        >
          {{ t('common.save', 'Save') }}
        </UButton>
      </div>
    </template>

  </MediaViewerModal>

  <!-- Image Editor Modal -->
  <UiAppModal
    v-model:open="isEditorOpen"
    :title="t('media.editImage', 'Edit Image')"
    :ui="{
      content: 'w-[98vw] max-w-7xl h-[95vh]',
      body: 'p-0 h-full flex flex-col',
    }"
  >
    <div v-if="selectedMedia && isEditorOpen" class="flex-1 overflow-hidden">
        <MediaFilerobotEditor
            :source="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
            :filename="selectedMedia.filename"
            @save="handleEditorSave"
            @close="isEditorOpen = false"
        />
    </div>
  </UiAppModal>
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
