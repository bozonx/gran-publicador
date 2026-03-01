<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia, getMediaFileUrl, getPublicMediaUrl } from '~/composables/useMedia'
import { useProjects } from '~/composables/useProjects'
import { useAuthStore } from '~/stores/auth'
import { DEFAULT_MEDIA_OPTIMIZATION_SETTINGS } from '~/utils/media-presets'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { useAutosave } from '~/composables/useAutosave'
import { formatBytes, getMediaIcon, getCompressionStats, getResolution, getExifData } from '~/utils/media'
import type { MediaItem, MediaLinkItem } from '~/types/media'
import type { ValidationError } from '~/composables/useSocialMediaValidation'
import { useMediaDnd } from '~/composables/media/useMediaDnd'
import { useMediaUploader } from '~/composables/media/useMediaUploader'
import { useMediaGalleryEditor } from '~/composables/media/useMediaGalleryEditor'

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
  onUpdateLink?: (mediaLinkId: string, data: { hasSpoiler?: boolean; order?: number; alt?: string | null; description?: string | null }) => Promise<void>
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

function normalizeMediaLinks(items: MediaLinkItem[]): MediaLinkItem[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// Create a local reactive copy of media for drag and drop
const localMedia = ref<MediaLinkItem[]>(normalizeMediaLinks(props.media))

// Watch for changes in props.media to update localMedia
watch(() => props.media, (newMedia) => {
  localMedia.value = normalizeMediaLinks(newMedia)
}, { deep: true })

const {
  fileInput,
  uploadProgress,
  uploadProgressPercent,
  sourceType,
  mediaType,
  sourceInput,
  filenameInput,
  stagedFiles,
  showExtendedOptions,
  optimizationSettings,
  isAddingMedia,
  getDefaultOptimizationParams,
  uploadFiles,
  addMedia,
  handleFileUpload,
  confirmAndUploadExtended,
  removeStagedFile,
  toggleExtendedOptions,
  triggerFileInput
} = useMediaUploader({
  props,
  currentProject,
  uploadMedia,
  uploadMediaFromUrl,
  addMediaToPublication,
  createMedia,
  t,
  toast,
  emit
})

const {
  isModalOpen,
  selectedMedia,
  selectedMediaLinkId,
  editableHasSpoiler,
  editableMetadata,
  editableAlt,
  editableDescription,
  isDeleteModalOpen,
  isDeleting,
  mediaToDeleteMediaId,
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
} = useMediaGalleryEditor({
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
})

const {
  isDropZoneActive,
  handleDragEnd,
  handleDragStart,
  handleNativeDragStart,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop
} = useMediaDnd({
  localMedia,
  props,
  reorderMediaInPublication,
  normalizeMediaLinks,
  emit,
  toast,
  t,
  getMediaFileUrl,
  showExtendedOptions,
  stagedFiles,
  getDefaultOptimizationParams,
  uploadFiles,
})


const mediaTypeOptions = [
  { value: 'IMAGE', label: t('media.type.image', 'Image') },
  { value: 'VIDEO', label: t('media.type.video', 'Video') },
  { value: 'AUDIO', label: t('media.type.audio', 'Audio') },
  { value: 'DOCUMENT', label: t('media.type.document', 'Document') },
]

const sourceTypeOptions = computed(() => [
  { value: 'URL', label: t('media.url') },
  { value: 'TELEGRAM', label: t('media.telegramFileId') },
])

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

// formatBytes and getMediaIcon moved to utils/media.ts

const compressionStats = computed(() => getCompressionStats(selectedMedia.value as any))
const exifData = computed(() => getExifData(selectedMedia.value as any))
const resolution = computed(() => getResolution(selectedMedia.value as any))

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

          <!-- URL / Telegram button card -->
          <div
            v-if="editable"
            class="shrink-0 w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-3 transition-all cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
            @click="isAddingMedia = true"
          >
            <UIcon name="i-heroicons-link" class="w-8 h-8 text-gray-400 group-hover:text-primary-500 transition-colors" />
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors text-center px-2">
              {{ t('media.addFromUrlShort') }}
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
                :alt="item.alt"
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
              {{ sourceType === 'URL' ? t('media.urlHint') : t('media.telegramHint') }}
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
                :placeholder="t('media.filenamePlaceholder', 'image.jpg')"
                size="lg"
                class="w-full"
                @keydown.enter.prevent="showExtendedOptions ? confirmAndUploadExtended() : addMedia()"
              />
            </UFormField>
          </div>

          <div class="w-full">
            <UFormField 
              :label="sourceType === 'URL' ? t('media.url') : t('media.telegramFileId')"
              :required="!showExtendedOptions || stagedFiles.length === 0"
              class="w-full"
            >
              <UInput
                v-model="sourceInput"
                :placeholder="sourceType === 'URL' ? t('media.urlPlaceholder') : t('media.telegramFileIdPlaceholder')"
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
          v-model:has-spoiler="editableHasSpoiler"
          v-model:description="editableDescription"
          v-model:alt="editableAlt"
          v-model:metadata="editableMetadata"
          class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
          :media="selectedMedia"
          :editable="editable"
        />
      </div>
    </div>
    
    <template #footer>
      <div
        v-if="editable"
        class="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800"
      >
        <UiSaveStatusIndicator
          :status="indicatorStatus" 
          :visible="isIndicatorVisible"
          :error="saveError" 
        />

        <UButton
          icon="i-heroicons-check"
          variant="solid"
          color="primary"
          :loading="saveStatus === 'saving'"
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
