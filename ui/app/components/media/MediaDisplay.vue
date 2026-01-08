<script setup lang="ts">
interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
}

interface Props {
  media: Array<{
    media?: MediaItem
    order: number
  }>
}

defineProps<Props>()

const { t } = useI18n()

function getMediaIcon(type: string) {
  const icons: Record<string, string> = {
    IMAGE: 'i-heroicons-photo',
    VIDEO: 'i-heroicons-video-camera',
    AUDIO: 'i-heroicons-musical-note',
    DOCUMENT: 'i-heroicons-document',
  }
  return icons[type] || 'i-heroicons-document'
}
</script>

<template>
  <div v-if="media && media.length > 0" class="space-y-2">
    <div
      v-for="item in media"
      :key="item.media?.id"
      class="flex items-center gap-3 p-2 border border-gray-200 dark:border-gray-700 rounded"
    >
      <UIcon
        :name="getMediaIcon(item.media?.type || '')"
        class="w-5 h-5 text-gray-500"
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">
          {{ item.media?.filename || 'Untitled' }}
        </p>
        <div class="flex items-center gap-2 mt-0.5">
          <UBadge size="xs" color="neutral">
            {{ item.media?.type }}
          </UBadge>
          <UBadge size="xs" :color="item.media?.storageType === 'TELEGRAM' ? 'secondary' : 'success'">
            {{ item.media?.storageType }}
          </UBadge>
        </div>
      </div>
    </div>
  </div>
  <p v-else class="text-sm text-gray-500 italic">
    {{ t('media.noMedia', 'No media files') }}
  </p>
</template>
