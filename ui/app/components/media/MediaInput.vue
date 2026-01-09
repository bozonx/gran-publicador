<script setup lang="ts">
import { ref } from 'vue'
import type { CreateMediaInput } from '~/composables/useMedia'
import { useMedia } from '~/composables/useMedia'

interface Props {
  modelValue: CreateMediaInput[]
}

interface Emits {
  (e: 'update:modelValue', value: CreateMediaInput[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { uploadMedia, isLoading: isUploading } = useMedia()
const toast = useToast()

const sourceType = ref<'URL' | 'TELEGRAM' | 'UPLOAD'>('UPLOAD')
const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
const sourceInput = ref('')
const filenameInput = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadProgress = ref(false)

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

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadProgress.value = true
  try {
    const uploadedMedia = await uploadMedia(file)
    
    const newMedia: CreateMediaInput = {
      type: uploadedMedia.type,
      storageType: uploadedMedia.storageType,
      storagePath: uploadedMedia.storagePath,
      filename: uploadedMedia.filename,
      mimeType: uploadedMedia.mimeType,
      sizeBytes: uploadedMedia.sizeBytes,
    }

    emit('update:modelValue', [...props.modelValue, newMedia])
    
    toast.add({
      title: t('common.success'),
      description: t('media.uploadSuccess', 'File uploaded successfully'),
      color: 'success',
    })
    
    if (fileInput.value) {
      fileInput.value.value = ''
    }
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

function addMedia() {
  if (!sourceInput.value.trim()) return

  const newMedia: CreateMediaInput = {
    type: mediaType.value,
    storageType: sourceType.value === 'TELEGRAM' ? 'TELEGRAM' : 'FS', // URL downloads result in FS storage
    storagePath: sourceInput.value.trim(),
    filename: filenameInput.value.trim() || undefined,
  }

  emit('update:modelValue', [...props.modelValue, newMedia])
  
  sourceInput.value = ''
  filenameInput.value = ''
}

function removeMedia(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Add Media Form -->
    <UCard>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('media.sourceType', 'Source Type')">
            <USelectMenu
              v-model="sourceType"
              :items="sourceTypeOptions"
              value-key="value"
              label-key="label"
            />
          </UFormField>

          <UFormField :label="t('media.mediaType', 'Media Type')">
            <USelectMenu
              v-model="mediaType"
              :items="mediaTypeOptions"
              value-key="value"
              label-key="label"
            />
          </UFormField>
        </div>

        <!-- File Upload -->
        <div v-if="sourceType === 'UPLOAD'">
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="handleFileUpload"
          />
          <UButton
            @click="triggerFileInput"
            :loading="uploadProgress || isUploading"
            block
            icon="i-heroicons-arrow-up-tray"
          >
            {{ t('media.chooseFile', 'Choose File') }}
          </UButton>
        </div>

        <!-- URL or Telegram File ID -->
        <template v-else>
          <UFormField 
            :label="sourceType === 'URL' ? 'URL' : 'Telegram File ID'"
          >
            <UInput
              v-model="sourceInput"
              :placeholder="sourceType === 'URL' ? 'https://example.com/image.jpg' : 'AgACAgIAAxkBAAI...'"
              @keydown.enter.prevent="addMedia"
            />
          </UFormField>

          <UFormField :label="t('media.filename', 'Filename (optional)')">
            <UInput
              v-model="filenameInput"
              placeholder="image.jpg"
              @keydown.enter.prevent="addMedia"
            />
          </UFormField>

          <UButton
            @click="addMedia"
            :disabled="!sourceInput.trim()"
            block
          >
            {{ t('media.add', 'Add Media') }}
          </UButton>
        </template>
      </div>
    </UCard>

    <!-- Media List -->
    <div v-if="modelValue.length > 0" class="space-y-2">
      <div
        v-for="(media, index) in modelValue"
        :key="index"
        class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <UBadge :color="media.storageType === 'TELEGRAM' ? 'secondary' : 'success'" size="xs">
              {{ media.storageType }}
            </UBadge>
            <UBadge color="neutral" size="xs">
              {{ media.type }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
            {{ media.filename || media.storagePath }}
          </p>
        </div>
        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          size="sm"
          @click="removeMedia(index)"
        />
      </div>
    </div>
  </div>
</template>
