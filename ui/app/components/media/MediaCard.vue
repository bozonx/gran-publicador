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
  sizeBytes?: number | string
}

interface Props {
  media: MediaItem
  clickable?: boolean
  showOverlay?: boolean
  size?: 'sm' | 'md' | 'lg'
  hasSpoiler?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
  showOverlay: true,
  size: 'md',
  hasSpoiler: false,
})

const emit = defineEmits<{
  (e: 'click', media: MediaItem): void
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const imageError = ref(false)

const shouldShowPreview = computed(() => {
  if (imageError.value) return false
  if (props.media.type === 'IMAGE') return true
  if (props.media.storageType !== 'TELEGRAM') return false
  return props.media.type === 'VIDEO' || props.media.type === 'DOCUMENT'
})

const previewUrl = computed(() => {
  if (!shouldShowPreview.value) return null

  if (props.media.type === 'IMAGE') {
    if (props.media.storageType === 'FS') {
      return getThumbnailUrl(props.media.id, 400, 400, authStore.accessToken || undefined)
    }
    return getMediaFileUrl(props.media.id, authStore.accessToken || undefined)
  }

  return getThumbnailUrl(props.media.id, 400, 400, authStore.accessToken || undefined)
})

const previewSrcset = computed(() => {
  if (!shouldShowPreview.value) return null
  if (props.media.type !== 'IMAGE') return null
  if (props.media.storageType !== 'FS') return null

  const token = authStore.accessToken || undefined
  return `${getThumbnailUrl(props.media.id, 400, 400, token)} 1x, ${getThumbnailUrl(props.media.id, 800, 800, token)} 2x`
})

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

function formatSizeMB(bytes?: number | string): string {
  if (!bytes) return '0 MB'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  return (b / (1024 * 1024)).toFixed(2) + ' MB'
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
      v-if="shouldShowPreview"
      class="w-full h-full relative"
    >
      <img
        :src="previewUrl || undefined"
        :srcset="previewSrcset || undefined"
        :alt="media.filename || 'Media'"
        :class="['w-full h-full object-cover', hasSpoiler && 'blur-xl scale-110']"
        @error="handleImageError"
      />
      
      <!-- Spoiler Indicator Overlay -->
      <div 
        v-if="hasSpoiler" 
        class="absolute inset-0 flex items-center justify-center bg-black/20"
      >
        <UIcon 
          name="i-heroicons-eye-slash" 
          :class="[
            'text-white drop-shadow-md',
            size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14'
          ]" 
        />
      </div>
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
        {{ imageError ? t('media.loadError', 'File unavailable') : (media.filename || 'Untitled') }}
      </p>
      <div v-if="!imageError && size !== 'sm'" class="flex flex-col gap-1">
        <UBadge size="xs" color="neutral">
          {{ media.type }}
        </UBadge>
        <div class="flex gap-1">
          <UBadge
            size="xs"
            :color="media.storageType === 'TELEGRAM' ? 'secondary' : 'success'"
          >
            {{ media.storageType }}
          </UBadge>
          <UBadge
            v-if="hasSpoiler"
            size="xs"
            color="warning"
            variant="solid"
          >
            SPOILER
          </UBadge>
        </div>
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
