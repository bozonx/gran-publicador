<script setup lang="ts">
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'editor',
  middleware: 'auth',
})

const route = useRoute()
const authStore = useAuthStore()

const mediaId = computed(() => route.params.id as string)
const projectId = computed(() => route.query.projectId as string | undefined)

const collectionId = computed(() => route.query.collectionId as string | undefined)
const groupId = computed(() => route.query.groupId as string | undefined)

const { fetchMedia, isLoading: isMediaLoading } = useMedia()

const media = ref<Awaited<ReturnType<typeof fetchMedia>>>(null)

const source = computed(() => {
  if (!media.value) return ''
  return getMediaFileUrl(media.value.id, authStore.accessToken || undefined, media.value.updatedAt)
})

onMounted(async () => {
  media.value = await fetchMedia(mediaId.value)
})

function onEditorClose() {
  window.close()
}
</script>

<template>
  <div class="fixed inset-0 bg-gray-950 flex items-center justify-center">
    <div v-if="isMediaLoading || !media" class="text-gray-400 text-sm">
      Loading...
    </div>

    <div
      v-else-if="media.type !== 'VIDEO' || (media.storageType !== 'FS' && media.storageType !== 'TELEGRAM')"
      class="text-gray-400 text-sm"
    >
      This media cannot be edited.
    </div>

    <div
      v-else-if="media.mimeType && (media.mimeType.includes('webm') || media.mimeType.includes('ogg') || media.mimeType.includes('vp9'))"
      class="flex flex-col items-center gap-3 text-center px-8"
    >
      <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-yellow-400" />
      <p class="text-gray-300 text-sm font-medium">Unsupported video format</p>
      <p class="text-gray-500 text-xs max-w-sm">
        The video editor requires MP4 with H.264 or H.265 codec.<br />
        This file uses <span class="text-gray-300">{{ media.mimeType }}</span> which is not supported.
      </p>
      <UButton variant="ghost" color="neutral" size="sm" @click="onEditorClose">Close</UButton>
    </div>

    <div v-else class="fixed inset-0">
      <MediaVideoEditor
        :src="source"
        :filename="media.filename"
        :project-id="projectId"
        :collection-id="collectionId"
        :group-id="groupId"
        @close="onEditorClose"
      />
    </div>
  </div>
</template>
