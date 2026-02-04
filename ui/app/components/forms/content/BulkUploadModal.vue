<script setup lang="ts">
import { ref, computed } from 'vue'
import AppModal from '~/components/ui/AppModal.vue'

const props = defineProps<{
  projectId: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  (e: 'done'): void
}>()

const { t } = useI18n()
const api = useApi()
const { uploadMedia } = useMedia()

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'creating' | 'success' | 'error'
  progress: number
  error?: string
}

const isDragging = ref(false)
const files = ref<UploadFile[]>([])
const isProcessing = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDone = computed(() => files.value.length > 0 && files.value.every(f => f.status === 'success' || f.status === 'error'))

const onFilesSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  addFiles(Array.from(input.files))
  input.value = ''
}

const onDragEnter = () => {
  isDragging.value = true
}

const onDragLeave = () => {
  isDragging.value = false
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false
  if (!event.dataTransfer?.files.length) return
  addFiles(Array.from(event.dataTransfer.files))
}

const addFiles = (newFiles: File[]) => {
  const startIndex = files.value.length
  const items = newFiles.map(file => ({
    file,
    status: 'pending' as const,
    progress: 0
  }))
  files.value.push(...items)
  
  // Start processing if not already running
  if (!isProcessing.value) {
    processQueue()
  }
}

const removeFile = (index: number) => {
  const file = files.value[index]
  if (file?.status === 'uploading' || file?.status === 'creating') return
  files.value.splice(index, 1)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const processQueue = async () => {
  if (isProcessing.value) return
  isProcessing.value = true

  // Loop through all files that are still pending
  while (true) {
    const nextIndex = files.value.findIndex(f => f.status === 'pending')
    if (nextIndex === -1) break
    
    const fileItem = files.value[nextIndex]!
    
    try {
      const ext = fileItem.file.name.split('.').pop()?.toLowerCase()
      const isText = ['txt', 'md'].includes(ext || '')

      if (isText) {
        fileItem.status = 'creating'
        const text = await readFileAsText(fileItem.file)
        await api.post('/content-library/items', {
          scope: 'project',
          projectId: props.projectId,
          title: fileItem.file.name,
          blocks: [
            { text, type: 'plain', order: 0, meta: {}, media: [] }
          ]
        })
      } else {
        fileItem.status = 'uploading'
        const media = await uploadMedia(fileItem.file, (p) => {
          fileItem.progress = p
        })
        
        fileItem.status = 'creating'
        await api.post('/content-library/items', {
          scope: 'project',
          projectId: props.projectId,
          title: fileItem.file.name,
          blocks: [
            { 
              text: '', 
              type: 'plain', 
              order: 0, 
              meta: {}, 
              media: [{ mediaId: media.id, order: 0, hasSpoiler: false }] 
            }
          ]
        })
      }
      fileItem.status = 'success'
    } catch (e: any) {
      fileItem.status = 'error'
      fileItem.error = e.data?.message || e.message || 'Error'
    }
  }

  isProcessing.value = false
}

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['txt', 'md'].includes(ext)) return 'i-heroicons-document-text'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'i-heroicons-photo'
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'i-heroicons-video-camera'
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'i-heroicons-musical-note'
  return 'i-heroicons-document'
}

const getStatusColor = (status: string) => {
  if (status === 'success') return 'text-green-500'
  if (status === 'error') return 'text-red-500'
  if (status === 'uploading' || status === 'creating') return 'text-primary-500'
  return 'text-gray-400'
}

const handleClose = () => {
  if (isProcessing.value) return
  isOpen.value = false
  // Don't clear files immediately to allow user to see result before closing if they want
  // but we usually clear on reopen or provide a clear button
}

const handleDone = () => {
  if (files.value.some(f => f.status === 'success')) {
    emit('done')
  }
  isOpen.value = false
  files.value = []
}
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('contentLibrary.bulkUploadModal.title')"
    :ui="{ content: 'w-full max-w-2xl' }"
    @close="handleClose"
  >
    <div class="space-y-6">
      <!-- Drop Area -->
      <div
        class="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group"
        :class="[
          isDragging ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 scale-[1.02]' : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/30'
        ]"
        @click="triggerFileInput"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          @change="onFilesSelected"
        />
        <div class="flex flex-col items-center gap-3 pointer-events-none">
          <div class="p-4 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 group-hover:scale-110 transition-transform">
            <UIcon 
              name="i-heroicons-cloud-arrow-up" 
              class="w-10 h-10 text-gray-400 group-hover:text-primary-500 transition-colors" 
            />
          </div>
          <div class="space-y-1">
            <p class="text-sm text-gray-700 dark:text-gray-200 font-semibold uppercase tracking-wide">
              {{ t('contentLibrary.bulkUploadModal.dropHelp') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('media.dropHere') }}
            </p>
          </div>
        </div>
      </div>

      <!-- File List -->
      <div v-if="files.length > 0" class="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
        <div
          v-for="(file, index) in files"
          :key="index"
          class="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700"
        >
          <div class="flex-1 min-w-0 flex items-center gap-3">
            <div 
              class="p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
              :class="getStatusColor(file.status)"
            >
              <UIcon 
                :name="getFileIcon(file.file.name)" 
                class="w-5 h-5 shrink-0"
              />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
                {{ file.file.name }}
              </p>
              <p v-if="file.error" class="text-[10px] text-red-500 font-medium uppercase mt-0.5">
                {{ file.error }}
              </p>
              <div v-else class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-gray-400 font-medium uppercase">{{ (file.file.size / 1024).toFixed(1) }} KB</span>
                <span v-if="file.progress > 0 && file.status === 'uploading'" class="text-[10px] text-primary-500 font-bold uppercase tracking-widest">{{ Math.round(file.progress) }}%</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Status Label -->
            <div class="text-[10px] font-bold uppercase tracking-widest hidden sm:block">
              <span v-if="file.status === 'pending'" class="text-gray-400">
                {{ t('contentLibrary.bulkUploadModal.status.pending') }}
              </span>
              <span v-else-if="file.status === 'uploading'" class="text-primary-500 flex items-center gap-1">
                <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 animate-spin" />
                {{ t('contentLibrary.bulkUploadModal.status.uploading') }}
              </span>
              <span v-else-if="file.status === 'creating'" class="text-primary-500 flex items-center gap-1">
                <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 animate-spin" />
                {{ t('contentLibrary.bulkUploadModal.status.creating') }}
              </span>
              <span v-else-if="file.status === 'success'" class="text-green-500 flex items-center gap-1">
                <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                {{ t('contentLibrary.bulkUploadModal.status.success') }}
              </span>
              <span v-else-if="file.status === 'error'" class="text-red-500 flex items-center gap-1">
                <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
                {{ t('contentLibrary.bulkUploadModal.status.error') }}
              </span>
            </div>

            <UButton
              v-if="!isProcessing && file.status !== 'success'"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="removeFile(index)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton
        color="primary"
        @click="handleDone"
      >
        {{ t('contentLibrary.bulkUploadModal.done') }}
      </UButton>
    </template>
  </AppModal>
</template>

<style scoped>
@reference "tailwindcss";

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-200 dark:bg-gray-800 rounded-full;
}
</style>
