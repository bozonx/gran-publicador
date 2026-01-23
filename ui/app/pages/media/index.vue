<script setup lang="ts">
import { useMedia, getThumbnailUrl, getMediaFileUrl } from '~/composables/useMedia'
import type { MediaItem } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const { fetchAllMedia, deleteMedia, updateMedia, isLoading } = useMedia()
const toast = useToast()

const mediaItems = ref<MediaItem[]>([])
const searchQuery = ref('')
const typeFilter = ref<string>('ALL')

const typeOptions = [
  { value: 'ALL', label: t('common.all', 'All') },
  { value: 'IMAGE', label: t('media.type.image', 'Images') },
  { value: 'VIDEO', label: t('media.type.video', 'Videos') },
  { value: 'AUDIO', label: t('media.type.audio', 'Audios') },
  { value: 'DOCUMENT', label: t('media.type.document', 'Documents') },
]

async function loadMedia() {
  mediaItems.value = await fetchAllMedia()
}

onMounted(loadMedia)

const filteredMedia = computed(() => {
  return mediaItems.value.filter(item => {
    const matchesSearch = !searchQuery.value || 
      item.filename?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    const matchesType = typeFilter.value === 'ALL' || item.type === typeFilter.value
    
    return matchesSearch && matchesType
  })
})

const selectedMedia = ref<MediaItem | null>(null)
const isModalOpen = ref(false)

const editableMetadata = ref<Record<string, any>>({})

function openMediaModal(media: MediaItem) {
  selectedMedia.value = media
  editableMetadata.value = JSON.parse(JSON.stringify(media.meta || {}))
  isModalOpen.value = true
}

function closeMediaModal() {
  selectedMedia.value = null
  isModalOpen.value = false
}


async function handleDeleteMedia() {
  const currentMedia = selectedMedia.value
  if (!currentMedia || !confirm(t('common.confirmDelete'))) return
  
  try {
    const success = await deleteMedia(currentMedia.id)
    if (success) {
      toast.add({
        title: t('common.success'),
        description: t('common.deleteSuccess'),
        color: 'success'
      })
      mediaItems.value = mediaItems.value.filter(m => m.id !== selectedMedia.value?.id)
      closeMediaModal()
    }
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message,
      color: 'error'
    })
  }
}

function downloadMediaFile(media: MediaItem) {
  const url = getMediaFileUrl(media.id)
  const link = document.createElement('a')
  link.href = url
  link.download = media.filename || `media_${media.id}`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function formatSizeMB(bytes?: number | string): string {
  if (!bytes) return '0 MB'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  return (b / (1024 * 1024)).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('navigation.media_library', 'Media Library') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('media.library_description', 'All media files from your projects') }}
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="t('common.search', 'Search...')"
          size="lg"
        />
      </div>
      <div class="w-full md:w-64">
        <USelectMenu
          v-model="typeFilter"
          :items="typeOptions"
          value-key="value"
          label-key="label"
          size="lg"
        />
      </div>
    </div>

    <!-- Grid -->
    <div v-if="isLoading && mediaItems.length === 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div v-for="n in 12" :key="n" class="aspect-square bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>
    </div>

    <div v-else-if="filteredMedia.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <MediaCard
        v-for="media in filteredMedia"
        :key="media.id"
        :media="media"
        size="md"
        class="w-full aspect-square"
        @click="(m: any) => openMediaModal(m)"
      />
    </div>

    <div v-else class="flex flex-col items-center justify-center py-20 text-gray-500">
      <UIcon name="i-heroicons-photo" class="w-16 h-16 mb-4 opacity-20" />
      <p>{{ t('media.no_media_found', 'No media found') }}</p>
    </div>

    <!-- Modal -->
    <UiAppModal v-model:open="isModalOpen" :title="selectedMedia?.filename || t('media.preview')" :ui="{ content: 'sm:max-w-6xl' }">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Left: Preview -->
        <div class="flex flex-col gap-4">
          <div class="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
            <template v-if="selectedMedia">
              <img
                v-if="selectedMedia.type === 'IMAGE'"
                :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                class="max-w-full max-h-full object-contain"
              />
              <video
                v-else-if="selectedMedia.type === 'VIDEO'"
                :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                controls
                class="max-w-full max-h-full"
              ></video>
              <audio
                v-else-if="selectedMedia.type === 'AUDIO'"
                :src="getMediaFileUrl(selectedMedia.id, authStore.token || undefined)"
                controls
                class="w-full max-w-md"
              ></audio>
              <div v-else class="text-white flex flex-col items-center">
                <UIcon name="i-heroicons-document" class="w-16 h-16 mb-4 opacity-50" />
                <span>{{ selectedMedia.mimeType }}</span>
              </div>
            </template>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              block
              @click="downloadMediaFile(selectedMedia!)"
            >
              {{ t('common.download') }}
            </UButton>
            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="soft"
              @click="handleDeleteMedia"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
        </div>

        <!-- Right: Info & Meta -->
        <div class="space-y-6">
          <section>
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              {{ t('media.file_info', 'File information') }}
            </h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-400 block">{{ t('media.size', 'Size') }}</span>
                <span class="text-gray-900 dark:text-white font-medium">{{ formatSizeMB(selectedMedia?.sizeBytes) }}</span>
              </div>
              <div>
                <span class="text-gray-400 block">{{ t('media.type', 'Type') }}</span>
                <span class="text-gray-900 dark:text-white font-medium">{{ selectedMedia?.type }}</span>
              </div>
              <div class="col-span-2">
                <span class="text-gray-400 block">{{ t('media.created_at', 'Uploaded') }}</span>
                <span class="text-gray-900 dark:text-white font-medium">
                  {{ selectedMedia ? new Date(selectedMedia.createdAt).toLocaleString() : '' }}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {{ t('media.metadata', 'Metadata (JSON)') }}
              </h4>
            </div>
            
            <CommonYamlEditor
              :model-value="editableMetadata"
              disabled
              class="h-48"
            />

          </section>

        </div>
      </div>
    </UiAppModal>
  </div>
</template>
