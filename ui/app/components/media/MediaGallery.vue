<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'
import yaml from 'js-yaml'

interface MediaItem {
  id: string
  type: string
  srcType: string
  src: string
  filename?: string
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
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
})

const { t } = useI18n()
const { uploadMedia, uploadMediaFromUrl, isLoading: isUploading, addMediaToPublication, removeMediaFromPublication, reorderMediaInPublication } = useMedia()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const uploadProgress = ref(false)
const isAddingMedia = ref(false)
const sourceType = ref<'URL' | 'TELEGRAM'>('URL')
const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
const sourceInput = ref('')
const filenameInput = ref('')
const imageErrors = ref<Record<string, boolean>>({})
const isDragging = ref(false)
const selectedMedia = ref<MediaItem | null>(null)
const isModalOpen = ref(false)
const editableMetadata = ref('')
const isSavingMeta = ref(false)

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
  const file = target.files?.[0]
  if (!file) return

  uploadProgress.value = true
  try {
    const uploadedMedia = await uploadMedia(file)
    
    const newMedia: CreateMediaInput = {
      type: uploadedMedia.type,
      srcType: uploadedMedia.srcType,
      src: uploadedMedia.src,
      filename: uploadedMedia.filename,
      mimeType: uploadedMedia.mimeType,
      sizeBytes: uploadedMedia.sizeBytes,
    }

    await addMediaToPublication(props.publicationId, [newMedia])
    
    toast.add({
      title: t('common.success'),
      description: t('media.uploadSuccess', 'File uploaded successfully'),
      color: 'success',
    })
    
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    
    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.uploadError', 'Failed to upload file'),
      color: 'error',
    })
  } finally {
    uploadProgress.value = false
  }
}

const { updateMedia } = useMedia()

async function saveMediaMeta() {
  if (!selectedMedia.value) return

  isSavingMeta.value = true
  try {
    let parsedMeta: Record<string, any> = {}
    
    if (editableMetadata.value && editableMetadata.value.trim() !== '') {
      parsedMeta = yaml.load(editableMetadata.value) as Record<string, any>
    }
    
    if (parsedMeta && (typeof parsedMeta !== 'object' || Array.isArray(parsedMeta))) {
      throw new Error(t('validation.invalidYaml', 'Must be a valid YAML object'))
    }
    
    // Ensure we save at least an empty object if null/undefined
    if (!parsedMeta) parsedMeta = {}

    const updated = await updateMedia(selectedMedia.value.id, {
      meta: parsedMeta
    })

    // Update local state
    selectedMedia.value.meta = updated.meta
    
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

function handleMetadataChange(newValue: string) {
  editableMetadata.value = newValue
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
        srcType: 'TELEGRAM',
        src: sourceInput.value.trim(),
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
    const newMedia: CreateMediaInput = {
      type: uploadedMedia.type as 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
      srcType: uploadedMedia.srcType as 'URL' | 'TELEGRAM' | 'FS',
      src: uploadedMedia.src,
      filename: uploadedMedia.filename,
      mimeType: uploadedMedia.mimeType,
      sizeBytes: uploadedMedia.sizeBytes,
      meta: uploadedMedia.meta,
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

async function removeMedia(mediaId: string) {
  try {
    await removeMediaFromPublication(props.publicationId, mediaId)
    
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
  }
}

function handleImageError(mediaId: string) {
  imageErrors.value[mediaId] = true
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
  if (!files || files.length === 0) return

  const file = files[0]
  if (!file) return
  
  uploadProgress.value = true
  try {
    const uploadedMedia = await uploadMedia(file)
    
    const newMedia: CreateMediaInput = {
      type: uploadedMedia.type,
      srcType: uploadedMedia.srcType,
      src: uploadedMedia.src,
      filename: uploadedMedia.filename,
      mimeType: uploadedMedia.mimeType,
      sizeBytes: uploadedMedia.sizeBytes,
    }

    await addMediaToPublication(props.publicationId, [newMedia])
    
    toast.add({
      title: t('common.success'),
      description: t('media.uploadSuccess', 'File uploaded successfully'),
      color: 'success',
    })
    
    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.uploadError', 'Failed to upload file'),
      color: 'error',
    })
  } finally {
    uploadProgress.value = false
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
  editableMetadata.value = formatMetadataAsYaml(media)
  isModalOpen.value = true
}

function closeMediaModal() {
  isModalOpen.value = false
  selectedMedia.value = null
}

function navigateToPreviousMedia() {
  if (!hasPreviousMedia.value) return
  const prevItem = localMedia.value[currentMediaIndex.value - 1]
  if (prevItem?.media) {
    selectedMedia.value = prevItem.media
  }
}

function navigateToNextMedia() {
  if (!hasNextMedia.value) return
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

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function formatMetadataAsYaml(media: MediaItem): string {
  if (!media.meta) return ''
  
  let metadata = media.meta
  
  // Try to parse string metadata if it's a JSON string
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch {
      // If parsing fails, it might be just a string
    }
  }
  
  // If it's an object and empty, return empty string
  if (typeof metadata === 'object' && metadata !== null && Object.keys(metadata).length === 0) {
    return ''
  }
  
  return yaml.dump(metadata)
}

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

interface Emits {
  (e: 'refresh'): void
}

const emit = defineEmits<Emits>()
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
    <div class="p-6">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-photo" class="w-5 h-5 text-gray-500"></UIcon>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('publication.media', 'Media Files') }}
        </h3>
      </div>

      <!-- Horizontal scrollable media gallery -->
      <div class="overflow-x-auto -mx-6 px-6">
        <div class="flex gap-4 pb-2">
          <!-- Upload button card (always first) -->
          <div
            v-if="editable"
            :class="[
              'shrink-0 w-48 h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group',
              isDropZoneActive 
                ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            ]"
            @click="triggerFileInput"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <input
              ref="fileInput"
              type="file"
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
                  ? t('media.uploading', 'Uploading...') 
                  : isDropZoneActive
                    ? t('media.dropHere', 'Drop file here')
                    : t('media.uploadFile', 'Upload File') 
              }}
            </span>
            <UButton
              v-if="!isDropZoneActive"
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
            class="flex gap-4"
            @start="handleDragStart"
            @end="handleDragEnd"
          >
            <div
              v-for="item in localMedia"
              :key="item.media?.id"
              :class="[
                'shrink-0 w-48 h-48 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50 group relative',
                editable && 'cursor-move'
              ]"
            >
              <!-- Image preview with error handling -->
              <div
                v-if="item.media?.type === 'IMAGE' && !imageErrors[item.media.id]"
                class="w-full h-full cursor-pointer"
                @click="openMediaModal(item.media)"
              >
                <img
                  :src="getMediaFileUrl(item.media.id)"
                  :alt="item.media.filename || 'Media'"
                  class="w-full h-full object-cover"
                  @error="handleImageError(item.media.id)"
                />
              </div>
              
              <!-- Icon for other types or failed images -->
              <div
                v-else
                class="w-full h-full flex flex-col items-center justify-center gap-2 p-4 cursor-pointer"
                @click="item.media && openMediaModal(item.media)"
              >
                <UIcon
                  :name="imageErrors[item.media?.id || ''] ? 'i-heroicons-exclamation-triangle' : getMediaIcon(item.media?.type || '')"
                  :class="[
                    'w-12 h-12',
                    imageErrors[item.media?.id || ''] ? 'text-red-500' : 'text-gray-400'
                  ]"
                ></UIcon>
                <p class="text-xs text-center truncate w-full px-2" :class="imageErrors[item.media?.id || ''] ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'">
                  {{ imageErrors[item.media?.id || ''] ? t('media.loadError', 'Файл недоступен') : (item.media?.filename || 'Untitled') }}
                </p>
                <div v-if="!imageErrors[item.media?.id || '']" class="flex flex-col gap-1">
                  <UBadge size="xs" color="neutral">
                    {{ item.media?.type }}
                  </UBadge>
                  <UBadge
                    size="xs"
                    :color="item.media?.srcType === 'URL' ? 'primary' : item.media?.srcType === 'TELEGRAM' ? 'secondary' : 'success'"
                  >
                    {{ item.media?.srcType }}
                  </UBadge>
                </div>
              </div>

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
                  @click="removeMedia(item.media?.id || '')"
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

              <!-- Filename overlay for images -->
              <div
                v-if="item.media?.type === 'IMAGE'"
                class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <p class="text-xs text-white truncate">
                  {{ item.media.srcType }} • {{ formatSizeMB(item.media.sizeBytes) }}
                </p>
              </div>
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
        </div>
      </div>

      <!-- Add media form (URL/Telegram) -->
      <div v-if="isAddingMedia && editable" class="mt-6 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('media.addFromUrl', 'Добавить из URL или Telegram') }}
            </h4>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ sourceType === 'URL' ? 'Файл будет скачан и сохранён в хранилище' : 'Укажите Telegram File ID' }}
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
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('media.sourceType', 'Тип источника')" required>
              <USelectMenu
                v-model="sourceType"
                :items="sourceTypeOptions"
                value-key="value"
                label-key="label"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('media.mediaType', 'Тип медиа')" required>
              <USelectMenu
                v-model="mediaType"
                :items="mediaTypeOptions"
                value-key="value"
                label-key="label"
                size="lg"
              />
            </UFormGroup>
          </div>

          <UFormGroup 
            :label="sourceType === 'URL' ? 'URL' : 'Telegram File ID'"
            required
          >
            <UInput
              v-model="sourceInput"
              :placeholder="sourceType === 'URL' ? 'https://example.com/image.jpg' : 'AgACAgIAAxkBAAI...'"
              size="lg"
              @keydown.enter.prevent="addMedia"
            />
          </UFormGroup>

          <UFormGroup :label="t('media.filename', 'Имя файла (необязательно)')">
            <UInput
              v-model="filenameInput"
              placeholder="image.jpg"
              size="lg"
              @keydown.enter.prevent="addMedia"
            />
          </UFormGroup>

          <div class="flex gap-3 pt-2">
            <UButton
              @click="addMedia"
              :disabled="!sourceInput.trim() || uploadProgress"
              :loading="uploadProgress"
              block
              size="lg"
              icon="i-heroicons-plus"
            >
              {{ uploadProgress ? t('media.uploading', 'Загрузка...') : t('media.add', 'Добавить медиа') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Media viewer modal -->
  <UModal v-model:open="isModalOpen" :ui="{ content: 'sm:max-w-6xl' }">
    <template #content>
      <div class="flex flex-col min-w-[500px] max-w-7xl max-h-[90vh]">
        <!-- Fixed header -->
        <div class="p-6 pb-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0">
              {{ selectedMedia?.filename || t('media.preview', 'Media Preview') }}
            </h3>
            <div class="flex items-center gap-2 shrink-0">
              <!-- Position indicator -->
              <span v-if="currentMediaIndex >= 0" class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ currentMediaIndex + 1 }} / {{ localMedia.length }}
              </span>
              <UButton
                icon="i-heroicons-x-mark"
                variant="ghost"
                color="neutral"
                size="sm"
                @click="closeMediaModal"
              />
            </div>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="p-6 pt-4 overflow-y-auto flex-1">

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
          <div class="flex justify-center bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden">
            <img
              v-if="selectedMedia.type === 'IMAGE'"
              :src="getMediaFileUrl(selectedMedia.id)"
              :alt="selectedMedia.filename || 'Media'"
              class="max-w-full max-h-[70vh] object-contain"
            />
            <div v-else class="flex items-center justify-center h-64 w-full">
              <UIcon
                :name="getMediaIcon(selectedMedia.type)"
                class="w-24 h-24 text-gray-400"
              />
            </div>
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
                  {{ selectedMedia.srcType }}, {{ selectedMedia.type }}{{ selectedMedia.mimeType ? `, ${selectedMedia.mimeType}` : '' }}
                </span>
              </div>
              <div v-if="selectedMedia.sizeBytes" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
                <span class="text-gray-500 shrink-0">size:</span>
                <span class="text-gray-900 dark:text-gray-200">{{ formatSizeMB(selectedMedia.sizeBytes) }}</span>
              </div>
              <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
                <span class="text-gray-500 shrink-0">src:</span>
                <span class="text-gray-900 dark:text-gray-200 whitespace-nowrap">{{ selectedMedia.src }}</span>
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

            <CommonYamlEditor
              v-model="editableMetadata"
              :disabled="!editable"
              :rows="8"
            >
              <template #actions>
                <UButton
                  v-if="editable"
                  icon="i-heroicons-check"
                  variant="solid"
                  color="primary"
                  size="sm"
                  :loading="isSavingMeta"
                  @click="saveMediaMeta"
                >
                  {{ t('common.save', 'Save') }}
                </UButton>
              </template>
            </CommonYamlEditor>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
