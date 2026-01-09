<script setup lang="ts">
import { getMediaFileUrl, getThumbnailUrl } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
  mimeType?: string
  sizeBytes?: number
}

interface Props {
  media: MediaItem
  clickable?: boolean
  showOverlay?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
  showOverlay: true,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'click', media: MediaItem): void
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const imageError = ref(false)

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  }
  return sizes[props.size]
})

function getMediaIcon(type: string) {
  const icons: Record<string, string> = {
    IMAGE: 'i-heroicons-photo',
    VIDEO: 'i-heroicons-video-camera',
    AUDIO: 'i-heroicons-musical-note',
    DOCUMENT: 'i-heroicons-document',
  }
  return icons[type] || 'i-heroicons-document'
}

function formatSizeMB(bytes?: number): string {
  if (!bytes) return '0 MB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function handleImageError() {
  imageError.value = true
}

function handleClick() {
  if (props.clickable) {
    emit('click', props.media)
  }
}
</script>

<template>
  <div
    :class="[
      sizeClasses,
      'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50 group relative',
      clickable && 'cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors'
    ]"
    @click="handleClick"
  >
    <!-- Image preview with error handling -->
    <div
      v-if="media.type === 'IMAGE' && !imageError"
      class="w-full h-full"
    >
      <img
        v-if="media.storageType === 'FS'"
        :src="getThumbnailUrl(media.id, 400, 400, authStore.token || undefined)"
        :srcset="`${getThumbnailUrl(media.id, 400, 400, authStore.token || undefined)} 1x, ${getThumbnailUrl(media.id, 800, 800, authStore.token || undefined)} 2x`"
        :alt="media.filename || 'Media'"
        class="w-full h-full object-cover"
        @error="handleImageError"
      />
      <img
        v-else
        :src="getMediaFileUrl(media.id, authStore.token || undefined)"
        :alt="media.filename || 'Media'"
        class="w-full h-full object-cover"
        @error="handleImageError"
      />
    </div>
    
    <!-- Icon for other types or failed images -->
    <div
      v-else
      class="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
    >
      <UIcon
        :name="imageError ? 'i-heroicons-exclamation-triangle' : getMediaIcon(media.type)"
        :class="[
          size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-16 h-16',
          imageError ? 'text-red-500' : 'text-gray-400'
        ]"
      />
      <p 
        v-if="size !== 'sm'"
        class="text-xs text-center truncate w-full px-2" 
        :class="imageError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'"
      >
        {{ imageError ? t('media.loadError', 'Файл недоступен') : (media.filename || 'Untitled') }}
      </p>
      <div v-if="!imageError && size !== 'sm'" class="flex flex-col gap-1">
        <UBadge size="xs" color="neutral">
          {{ media.type }}
        </UBadge>
        <UBadge
          size="xs"
          :color="media.storageType === 'TELEGRAM' ? 'secondary' : 'success'"
        >
          {{ media.storageType }}
        </UBadge>
      </div>
    </div>

    <!-- Overlay info for images -->
    <div
      v-if="showOverlay && media.type === 'IMAGE' && !imageError"
      class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <p class="text-xs text-white truncate">
        {{ media.storageType }} • {{ formatSizeMB(media.sizeBytes) }}
      </p>
    </div>

    <slot name="actions" />
  </div>
</template>
