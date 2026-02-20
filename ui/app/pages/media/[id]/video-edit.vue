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
