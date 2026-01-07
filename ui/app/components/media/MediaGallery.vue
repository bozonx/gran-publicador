<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'

interface MediaItem {
  id: string
  type: string
  srcType: string
  src: string
  filename?: string
  mimeType?: string
  sizeBytes?: number
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
const { uploadMedia, isLoading: isUploading, addMediaToPublication, removeMediaFromPublication, reorderMediaInPublication } = useMedia()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const uploadProgress = ref(false)
const isAddingMedia = ref(false)
const sourceType = ref<'URL' | 'TELEGRAM' | 'UPLOAD'>('UPLOAD')
const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
const sourceInput = ref('')
const filenameInput = ref('')
const imageErrors = ref<Record<string, boolean>>({})
const isDragging = ref(false)

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
  { value: 'UPLOAD', label: t('media.sourceType.upload', 'Upload File') },
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

async function addMedia() {
  if (!sourceInput.value.trim()) return

  const newMedia: CreateMediaInput = {
    type: mediaType.value,
    srcType: sourceType.value as 'URL' | 'TELEGRAM',
    src: sourceInput.value.trim(),
    filename: filenameInput.value.trim() || undefined,
  }

  try {
    await addMediaToPublication(props.publicationId, [newMedia])
    
    toast.add({
      title: t('common.success'),
      description: t('media.addSuccess', 'Media added successfully'),
      color: 'success',
    })
    
    sourceInput.value = ''
    filenameInput.value = ''
    isAddingMedia.value = false
    
    // Emit event to refresh publication data
    emit('refresh')
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('media.addError', 'Failed to add media'),
      color: 'error',
    })
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
            class="shrink-0 w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer group"
            @click="triggerFileInput"
          >
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              @change="handleFileUpload"
            />
            <UIcon
              name="i-heroicons-arrow-up-tray"
              class="w-8 h-8 text-gray-400 group-hover:text-primary-500 transition-colors"
            ></UIcon>
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors">
              {{ uploadProgress || isUploading ? t('media.uploading', 'Uploading...') : t('media.uploadFile', 'Upload File') }}
            </span>
            <UButton
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
                class="w-full h-full"
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
                class="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
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
                v-if="item.media?.type === 'IMAGE' && item.media?.filename"
                class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <p class="text-xs text-white truncate">
                  {{ item.media.filename }}
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
      <div v-if="isAddingMedia && editable" class="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/20">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ t('media.addFromUrl', 'Add from URL or Telegram') }}
          </h4>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="isAddingMedia = false"
          />
        </div>
        
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('media.sourceType', 'Source Type')">
              <USelectMenu
                v-model="sourceType"
                :items="sourceTypeOptions"
                value-key="value"
                label-key="label"
              />
            </UFormGroup>

            <UFormGroup :label="t('media.mediaType', 'Media Type')">
              <USelectMenu
                v-model="mediaType"
                :items="mediaTypeOptions"
                value-key="value"
                label-key="label"
              />
            </UFormGroup>
          </div>

          <UFormGroup 
            :label="sourceType === 'URL' ? 'URL' : 'Telegram File ID'"
          >
            <UInput
              v-model="sourceInput"
              :placeholder="sourceType === 'URL' ? 'https://example.com/image.jpg' : 'AgACAgIAAxkBAAI...'"
              @keydown.enter.prevent="addMedia"
            />
          </UFormGroup>

          <UFormGroup :label="t('media.filename', 'Filename (optional)')">
            <UInput
              v-model="filenameInput"
              placeholder="image.jpg"
              @keydown.enter.prevent="addMedia"
            />
          </UFormGroup>

          <UButton
            @click="addMedia"
            :disabled="!sourceInput.trim()"
            block
            icon="i-heroicons-plus"
          >
            {{ t('media.add', 'Add Media') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
