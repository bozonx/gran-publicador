<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'
import { DialogTitle, DialogDescription, VisuallyHidden } from 'reka-ui'

interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
  alt?: string
  description?: string
  mimeType?: string
  sizeBytes?: number
  meta?: Record<string, any>
}


interface Props {
  media: Array<{
    id?: string
    media?: MediaItem
    order: number
  }>
  publicationId: string
  editable?: boolean
  socialMedia?: string | string[]
  showValidation?: boolean
  postType?: string
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  showValidation: true,
})

const { t } = useI18n()
const authStore = useAuthStore()
const { 
  uploadMedia, 
  uploadMediaFromUrl, 
  isLoading: isUploading, 
  addMediaToPublication, 
  removeMediaFromPublication, 
  reorderMediaInPublication,
} = useMedia()
const { validatePostContent } = useSocialMediaValidation()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const uploadProgress = ref(false)
const uploadProgressPercent = ref(0)
const isAddingMedia = ref(false)
const sourceType = ref<'URL' | 'TELEGRAM'>('URL')
const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
const sourceInput = ref('')
const filenameInput = ref('')

const addMediaButtonLabel = computed(() => {
  if (sourceType.value === 'URL') {
    return t('media.add', 'Добавить медиа')
  }
  const types = {
    IMAGE: t('media.type.image'),
    VIDEO: t('media.type.video'),
    AUDIO: t('media.type.audio'),
    DOCUMENT: t('media.type.document'),
  }
  const typeText = (types[mediaType.value as keyof typeof types] || t('media.type.image')).toLowerCase()
  return `${t('common.add', 'Добавить')} ${typeText}`
})

const isDragging = ref(false)
const selectedMedia = ref<MediaItem | null>(null)
const isModalOpen = ref(false)

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

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    await uploadFiles(target.files)
  }
}

async function uploadFiles(files: FileList | File[]) {
  const fileArray = Array.from(files)
  if (fileArray.length === 0) return

  uploadProgress.value = true
  uploadProgressPercent.value = 0
  
  const progresses = new Array(fileArray.length).fill(0)
  
  try {
    const uploadedMediaItems = await Promise.all(
      fileArray.map(async (file, index) => {
        return await uploadMedia(file, (progress) => {
          progresses[index] = progress
          const totalProgress = progresses.reduce((a, b) => a + b, 0)
          uploadProgressPercent.value = Math.round(totalProgress / fileArray.length)
        })
      })
    )
    
    await addMediaToPublication(
      props.publicationId, 
      uploadedMediaItems.map(m => ({ id: m.id }))
    )
    
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
    // editableMetadata is already a JSON object from CommonYamlEditor
    const metaToSave = editableMetadata.value || {}

    const updated = await updateMedia(selectedMedia.value.id, {
      meta: metaToSave,
      alt: editableAlt.value || null,
      description: editableDescription.value || null
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
}

async function addMedia() {
  if (!sourceInput.value.trim()) return

  uploadProgress.value = true
  try {
    let uploadedMedia: MediaItem

    if (sourceType.value === 'URL') {
      // For URL type: download file and save to filesystem with original URL in meta
      uploadedMedia = await uploadMediaFromUrl(
        sourceInput.value.trim(),
        filenameInput.value.trim() || undefined
      )
    } else {
      // For TELEGRAM type: create media record directly
      const newMedia: CreateMediaInput = {
        type: mediaType.value,
        storageType: 'TELEGRAM',
        storagePath: sourceInput.value.trim(),
        filename: filenameInput.value.trim() || undefined,
      }
      
      await addMediaToPublication(props.publicationId, [newMedia])
      
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
    await addMediaToPublication(props.publicationId, [{ id: uploadedMedia.id }])
    
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

function handleDeleteClick(mediaId: string) {
  mediaToDeleteId.value = mediaId
  isDeleteModalOpen.value = true
}

async function confirmRemoveMedia() {
  if (!mediaToDeleteId.value) return

  isDeleting.value = true
  try {
    await removeMediaFromPublication(props.publicationId, mediaToDeleteId.value)
    
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
    await reorderMediaInPublication(props.publicationId, reorderData)
    
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
    await uploadFiles(files)
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

function openMediaModal(media: MediaItem) {
  selectedMedia.value = media
  // editableMetadata is now a JSON object, not a YAML string
  editableMetadata.value = media.meta || {}
  editableAlt.value = media.alt || ''
  editableDescription.value = media.description || ''
  isModalOpen.value = true
}

function closeMediaModal() {
  isModalOpen.value = false
  selectedMedia.value = null
}

const transitionName = ref('slide-next')

function navigateToPreviousMedia() {
  if (!hasPreviousMedia.value) return
  transitionName.value = 'slide-prev'
  const prevItem = localMedia.value[currentMediaIndex.value - 1]
  if (prevItem?.media) {
    selectedMedia.value = prevItem.media
  }
}

function navigateToNextMedia() {
  if (!hasNextMedia.value) return
  transitionName.value = 'slide-next'
  const nextItem = localMedia.value[currentMediaIndex.value + 1]
  if (nextItem?.media) {
    selectedMedia.value = nextItem.media
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



function formatSizeMB(bytes?: number): string {
  if (!bytes) return '0 MB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
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
            <UButton
              v-if="!isDropZoneActive && !uploadProgress"
              variant="ghost"
              size="xs"
              color="neutral"
              @click.stop="isAddingMedia = !isAddingMedia"
            >
              {{ t('media.orAddUrl', 'or add URL') }}
            </UButton>
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
                size="md"
                @click="openMediaModal(item.media)"
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

      <!-- Add media form (URL/Telegram) -->
      <div v-if="isAddingMedia && editable" class="mt-6 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div class="flex-1">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('media.addFromUrl', 'Добавить из URL или Telegram') }}
            </h4>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ sourceType === 'URL' ? 'Файл будет скачан, проанализирован и сохранён в хранилище' : 'Можно указывать file_id только того медиа файла, который был виден боту Gran Publicador' }}
            </p>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="isAddingMedia = false"
          />
        </div>
        
        <div class="space-y-4">
          <div class="flex items-end gap-3 w-full">
            <UFormField :label="t('media.sourceType', 'Источник')" required class="flex-none w-48">
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

            <UFormField v-if="sourceType === 'TELEGRAM'" :label="t('media.mediaType', 'Тип')" required class="flex-none w-48">
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

            <UFormField :label="t('media.filename', 'Имя файла')" class="flex-1">
              <UInput
                v-model="filenameInput"
                placeholder="image.jpg"
                size="lg"
                class="w-full"
                @keydown.enter.prevent="addMedia"
              />
            </UFormField>
          </div>

          <div class="w-full">
            <UFormField 
              :label="sourceType === 'URL' ? 'URL' : 'Telegram File ID'"
              required
              class="w-full"
            >
              <UInput
                v-model="sourceInput"
                :placeholder="sourceType === 'URL' ? 'https://example.com/image.jpg' : 'AgACAgIAAxkBAAI...'"
                size="lg"
                required
                class="w-full"
                @keydown.enter.prevent="addMedia"
              />
            </UFormField>
          </div>

          <div class="flex gap-3 pt-2">
            <UButton
              @click="addMedia"
              :disabled="!sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              icon="i-heroicons-plus"
            >
              {{ uploadProgress ? t('media.uploading', 'Загрузка...') : addMediaButtonLabel }}
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
            <span class="text-gray-900 dark:text-gray-200">{{ formatSizeMB(selectedMedia.sizeBytes) }}</span>
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

        <CommonYamlEditor
          v-model="editableMetadata"
          :disabled="!editable"
          :rows="8"
        />
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
