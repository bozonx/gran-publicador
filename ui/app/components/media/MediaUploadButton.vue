<script setup lang="ts">
const props = defineProps<{
  isUploading?: boolean
  uploadProgress?: number
  uploadProgressPercent?: number
  isDropZoneActive?: boolean
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'file-upload', event: Event): void
  (e: 'dragenter', event: DragEvent): void
  (e: 'dragover', event: DragEvent): void
  (e: 'dragleave', event: DragEvent): void
  (e: 'drop', event: DragEvent): void
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInput.value?.click()
}

defineExpose({
  triggerFileInput
})
</script>

<template>
  <div
    v-if="editable"
    :class="[
      'shrink-0 w-48 h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group relative overflow-hidden',
      isDropZoneActive 
        ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
        : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
    ]"
    @click="triggerFileInput"
    @dragenter="emit('dragenter', $event)"
    @dragover="emit('dragover', $event)"
    @dragleave="emit('dragleave', $event)"
    @drop="emit('drop', $event)"
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
      @change="emit('file-upload', $event)"
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
</template>
