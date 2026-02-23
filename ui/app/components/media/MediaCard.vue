<script setup lang="ts">
import { getMediaFileUrl, getThumbnailUrl } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'
import CommonThumb from '~/components/common/Thumb.vue'

interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
  mimeType?: string
  sizeBytes?: number | string
  updatedAt?: string
  meta?: Record<string, any>
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
  
  const type = (props.media.type || '').toUpperCase()
  const storageType = (props.media.storageType || '').toUpperCase()
  
  if (type === 'IMAGE') return true

  // For other types, we only show preview if it's from Telegram and has an explicit thumbnail
  if (storageType === 'TELEGRAM') {
    const hasThumbnail = !!props.media.meta?.telegram?.thumbnailFileId
    return (type === 'VIDEO' || type === 'DOCUMENT' || type === 'AUDIO') && hasThumbnail
  }

  return false
})

const previewUrl = computed(() => {
  if (!shouldShowPreview.value) return null

  const version = props.media.updatedAt

  if (props.media.type === 'IMAGE') {
    if (props.media.storageType === 'STORAGE') {
      return getThumbnailUrl(props.media.id, 400, 400, authStore.accessToken || undefined, version)
    }
    return getMediaFileUrl(props.media.id, authStore.accessToken || undefined, version)
  }

  return getThumbnailUrl(props.media.id, 400, 400, authStore.accessToken || undefined, version)
})

const previewSrcset = computed(() => {
  if (!shouldShowPreview.value) return null
  if (props.media.type !== 'IMAGE') return null
  if (props.media.storageType !== 'STORAGE') return null

  const token = authStore.accessToken || undefined
  const version = props.media.updatedAt
  return `${getThumbnailUrl(props.media.id, 400, 400, token, version)} 1x, ${getThumbnailUrl(props.media.id, 800, 800, token, version)} 2x`
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
  <CommonThumb
    :box-class="sizeClasses"
    :src="shouldShowPreview ? (previewUrl || null) : null"
    :srcset="shouldShowPreview ? (previewSrcset || null) : null"
    :alt="media.filename || 'Media'"
    :clickable="clickable"
    :size="size"
    :img-class="hasSpoiler ? 'blur-xl scale-110' : undefined"
    :error="imageError"
    :placeholder-icon="getMediaIcon(media.type)"
    :placeholder-text="size !== 'sm' ? (media.filename || 'Untitled') : ''"
    :error-text="t('media.loadError', 'File unavailable')"
    :is-video="media.type === 'VIDEO'"
    @click="handleClick"
    @error="handleImageError"
  >
    <template v-if="hasSpoiler" #overlay>
      <div class="absolute inset-0 flex items-center justify-center bg-black/20">
        <UIcon
          name="i-heroicons-eye-slash"
          :class="[
            'text-white drop-shadow-md',
            size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14',
          ]"
        />
      </div>
    </template>

    <template v-if="showOverlay && media.type === 'IMAGE' && !imageError" #bottom>
      <p class="text-xs text-white truncate">
        {{ media.storageType }} • {{ formatSizeMB(media.sizeBytes) }}
      </p>
    </template>

    <template #actions>
      <slot name="actions" />
    </template>
  </CommonThumb>
</template>
