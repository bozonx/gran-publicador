<script setup lang="ts">
import { useMedia, getMediaFileUrl } from '~/composables/useMedia'
import { useProjects } from '~/composables/useProjects'
import { useAuthStore } from '~/stores/auth'
import { DEFAULT_MEDIA_OPTIMIZATION_SETTINGS } from '~/utils/media-presets'

definePageMeta({
  layout: 'editor',
  middleware: 'auth',
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const mediaId = computed(() => route.params.id as string)
const projectId = computed(() => route.query.projectId as string | undefined || undefined)

const { fetchMedia, replaceMediaFile, isLoading: isMediaLoading } = useMedia()
const { fetchProject, currentProject } = useProjects()

const media = ref<Awaited<ReturnType<typeof fetchMedia>>>(null)
const isSaveModalOpen = ref(false)
const isSaving = ref(false)

const optimizationDefaults = computed(() => {
  const mediaOpt = media.value?.meta?.optimizationParams
  if (mediaOpt) {
    return {
      stripMetadata: mediaOpt.stripMetadata ?? false,
      lossless: mediaOpt.lossless ?? false,
    }
  }

  const projectOpt = currentProject.value?.preferences?.mediaOptimization
  if (projectId.value && projectOpt) {
    return {
      stripMetadata: projectOpt.stripMetadata ?? false,
      lossless: projectOpt.lossless ?? false,
    }
  }
  return { stripMetadata: false, lossless: false }
})

const saveOptimization = ref({ stripMetadata: false, lossless: false })

const source = computed(() => {
  if (!media.value) return ''
  return getMediaFileUrl(media.value.id, authStore.accessToken || undefined, media.value.updatedAt)
})

onMounted(async () => {
  const [m] = await Promise.all([
    fetchMedia(mediaId.value),
    projectId.value ? fetchProject(projectId.value) : Promise.resolve(null),
  ])
  media.value = m
})

let pendingFile: File | null = null

function onSaveRequested(file: File) {
  pendingFile = file
  saveOptimization.value = { ...optimizationDefaults.value }
  isSaveModalOpen.value = true
}

async function onSaveConfirm() {
  if (!pendingFile || !media.value) return
  isSaving.value = true
  try {
    const defaults = currentProject.value?.preferences?.mediaOptimization
      ? JSON.parse(JSON.stringify(currentProject.value.preferences.mediaOptimization))
      : JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS))

    const optimizeParams = { ...defaults, ...saveOptimization.value }

    const updatedMedia = await replaceMediaFile(
      media.value.id,
      pendingFile,
      optimizeParams,
      projectId.value,
    )
    // Refetch to get full metadata including fullMediaMeta from proxy
    media.value = await fetchMedia(updatedMedia.id)

    toast.add({
      title: t('common.success'),
      description: t('media.editSuccess', 'Image edited successfully'),
      color: 'success',
    })

    isSaveModalOpen.value = false
    pendingFile = null
    window.close()
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('media.editError', 'Failed to save edited image'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

function onSaveCancel() {
  isSaveModalOpen.value = false
  pendingFile = null
}

function onEditorClose() {
  window.close()
}
</script>

<template>
  <div class="fixed inset-0 bg-gray-950 flex items-center justify-center">
    <div v-if="isMediaLoading || !media" class="text-gray-400 text-sm">
      Loading...
    </div>

    <div v-else-if="media.type !== 'IMAGE' || (media.storageType !== 'STORAGE' && media.storageType !== 'TELEGRAM')" class="text-gray-400 text-sm">
      This media cannot be edited.
    </div>

    <template v-else>
      <div class="fixed inset-0">
        <MediaFilerobotEditor
          :source="source"
          :filename="media.filename"
          @save-requested="onSaveRequested"
          @close="onEditorClose"
        />
      </div>

      <UModal v-model:open="isSaveModalOpen" :dismissible="false">
        <template #content>
          <div class="p-6 flex flex-col gap-4">
            <div class="text-base font-semibold">Save image</div>

            <div class="flex flex-col gap-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <UCheckbox v-model="saveOptimization.stripMetadata" />
                <span class="text-sm">Strip metadata</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <UCheckbox v-model="saveOptimization.lossless" />
                <span class="text-sm">Lossless compression</span>
              </label>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <UButton variant="ghost" @click="onSaveCancel">Cancel</UButton>
              <UButton color="primary" :loading="isSaving" @click="onSaveConfirm">Save</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
