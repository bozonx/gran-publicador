<script setup lang="ts">
import { getMediaFileUrl, getThumbnailUrl } from '~/utils/media'

const props = defineProps<{
  media: any
  token?: string
}>()
</script>

<template>
  <div class="relative group aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
    <img
      v-if="media.type === 'IMAGE'"
      :src="getThumbnailUrl(media.id, 400, 400, token)"
      class="h-full w-full object-cover transition-transform group-hover:scale-105"
      draggable="false"
    />
    <div v-else class="flex h-full w-full items-center justify-center">
      <UIcon :name="getMediaIcon(media.type)" class="h-10 w-10 text-gray-400" />
    </div>
    <div class="absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100" />
  </div>
</template>
