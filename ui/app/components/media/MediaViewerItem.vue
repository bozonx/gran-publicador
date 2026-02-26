<script setup lang="ts">
import { getMediaFileUrl } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  media: {
    id: string
    type: string
    filename?: string
    updatedAt?: string | null
    mimeType?: string
  }
}>()

const authStore = useAuthStore()

function getMediaIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'IMAGE':
      return 'i-heroicons-photo'
    case 'VIDEO':
      return 'i-heroicons-film'
    case 'AUDIO':
      return 'i-heroicons-musical-note'
    case 'DOCUMENT':
      return 'i-heroicons-document-text'
    default:
      return 'i-heroicons-document'
  }
}
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center">
    <img
      v-if="media.type === 'IMAGE'"
      :src="getMediaFileUrl(media.id, undefined, media.updatedAt || undefined)"
      :alt="media.filename || 'Media'"
      class="max-w-full max-h-full object-contain"
    />
    <div v-else-if="media.type === 'VIDEO'" class="w-full h-full flex items-center justify-center relative group">
      <video
        controls
        :autoplay="authStore.user?.videoAutoplay !== false"
        class="max-w-full max-h-full"
        :src="getMediaFileUrl(media.id, undefined, media.updatedAt || undefined)"
      >
        Your browser does not support the video tag.
      </video>
    </div>
    <div v-else-if="media.type === 'AUDIO'" class="w-full h-full flex items-center justify-center relative group">
      <!-- Decorative background -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
         <UIcon name="i-heroicons-musical-note" class="w-96 h-96 text-primary-500 dark:text-primary-400" />
      </div>
      
      <!-- Player Card -->
      <div class="relative z-10 w-full max-w-[90%] sm:max-w-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center gap-6">
          <div class="relative group/icon cursor-default">
              <div class="absolute -inset-1 bg-linear-to-r from-primary-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover/icon:opacity-50 transition duration-1000"></div>
              <div class="relative w-32 h-32 rounded-2xl bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow-inner flex items-center justify-center ring-1 ring-gray-900/5 dark:ring-white/10">
                   <UIcon name="i-heroicons-musical-note" class="w-16 h-16 text-gray-400 dark:text-gray-500" />
              </div>
          </div>
  
          <div class="space-y-1.5 w-full">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white truncate px-2">
                  {{ media.filename || 'Audio Track' }}
              </h3>
              <p class="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ media.mimeType || 'AUDIO' }}
              </p>
          </div>
  
          <audio
              controls
              :autoplay="authStore.user?.videoAutoplay !== false"
              class="w-full mt-2"
              :src="getMediaFileUrl(media.id, undefined, media.updatedAt || undefined)"
          >
               Your browser does not support the audio element.
          </audio>
      </div>
    </div>
    <div v-else class="flex items-center justify-center h-full w-full">
      <UIcon
        :name="getMediaIcon(media.type)"
        class="w-24 h-24 text-gray-400"
      />
    </div>
  </div>
</template>
