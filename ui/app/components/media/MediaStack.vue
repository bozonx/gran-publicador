<script setup lang="ts">
import CommonThumb from '~/components/common/Thumb.vue'
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
  updatedAt?: string
}

interface Props {
  media: Array<{
    media?: MediaItem
    order: number
  }>
  clickable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'click', media: MediaItem): void
}>()

const authStore = useAuthStore()

const firstMedia = computed(() => props.media[0]?.media)
const mediaCount = computed(() => props.media.length)

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  }
  return sizes[props.size]
})

const imageError = ref(false)

const shouldShowPreview = computed(() => {
  if (imageError.value) return false
  if (!firstMedia.value) return false

  if (firstMedia.value.type === 'IMAGE') return true
  if (firstMedia.value.storageType !== 'TELEGRAM') return false
  return firstMedia.value.type === 'VIDEO' || firstMedia.value.type === 'DOCUMENT'
})

const previewUrl = computed(() => {
  if (!firstMedia.value) return null
  if (!shouldShowPreview.value) return null

  const version = firstMedia.value.updatedAt

  if (firstMedia.value.type === 'IMAGE') {
    if (firstMedia.value.storageType === 'STORAGE') {
      return getThumbnailUrl(firstMedia.value.id, 400, 400, undefined, version)
    }
    return getMediaFileUrl(firstMedia.value.id, undefined, version)
  }

  return getThumbnailUrl(firstMedia.value.id, 400, 400, undefined, version)
})

const previewSrcset = computed(() => {
  if (!firstMedia.value) return null
  if (!shouldShowPreview.value) return null
  if (firstMedia.value.type !== 'IMAGE') return null
  if (firstMedia.value.storageType !== 'STORAGE') return null

  const version = firstMedia.value.updatedAt
  return `${getThumbnailUrl(firstMedia.value.id, 400, 400, undefined, version)} 1x, ${getThumbnailUrl(firstMedia.value.id, 800, 800, undefined, version)} 2x`
})

function handleImageError() {
  imageError.value = true
}

function handleClick() {
  if (props.clickable && firstMedia.value) {
    emit('click', firstMedia.value)
  }
}
</script>

<template>
  <CommonThumb
    v-if="firstMedia"
    :box-class="sizeClasses"
    :src="shouldShowPreview ? (previewUrl || null) : null"
    :srcset="shouldShowPreview ? (previewSrcset || null) : null"
    :alt="firstMedia.filename || 'Media'"
    :clickable="clickable"
    :size="size"
    :is-video="firstMedia.type === 'VIDEO'"
    :error="imageError"
    :placeholder-icon="firstMedia.type === 'IMAGE' ? 'i-heroicons-photo' : firstMedia.type === 'VIDEO' ? 'i-heroicons-video-camera' : firstMedia.type === 'AUDIO' ? 'i-heroicons-musical-note' : 'i-heroicons-document'"
    :placeholder-text="size !== 'sm' ? (firstMedia.filename || 'Untitled') : ''"
    :show-stack="mediaCount > 1"
    :total-count="mediaCount"
    @click="handleClick"
    @error="handleImageError"
  >
    <template #actions>
      <slot name="actions" />
    </template>
  </CommonThumb>
</template>
