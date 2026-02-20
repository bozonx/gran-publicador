<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useContentCollections, type ContentCollection } from '~/composables/useContentCollections'
import { useMedia } from '~/composables/useMedia'
import { useApi } from '~/composables/useApi'
import { useProjects } from '~/composables/useProjects'
import { buildGroupTreeFromRoot } from '~/composables/useContentLibraryGroupsTree'
import ContentGroupSelectTree from '../content/ContentGroupSelectTree.vue'
import {
  BASE_VIDEO_CODEC_OPTIONS,
  checkVideoCodecSupport,
  resolveVideoCodecOptions,
} from '~/utils/webcodecs'

interface Props {
  open: boolean
  filename?: string
  projectId?: string
  /** Blob factory — called when user confirms; must return the exported MP4 blob */
  exportFn: (options: ExportOptions) => Promise<Blob>
}

interface ExportOptions {
  videoCodec: string
  bitrate: number
  audio: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  exported: []
}>()

const { t } = useI18n()
const api = useApi()
const { uploadMedia } = useMedia()
const { listCollections } = useContentCollections()
const toast = useToast()
const { fetchProjects, isLoading: isLoadingProjects } = useProjects()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Form state
const outputFilename = ref('')
const scope = ref<'personal' | 'project'>('personal')
const selectedProjectId = ref<string | null>(null)
const selectedCollectionId = ref<string | null>(null)
const selectedGroupId = ref<string | null>(null)

const projects = ref<any[]>([])
async function loadProjects() {
  if (projects.value.length > 0) return
  try {
    projects.value = await fetchProjects({ hasContentCollections: true })
  } catch (err) {
    console.error('Failed to fetch projects', err)
  }
}

const videoCodec = ref('avc1.42E032')
const bitrateMbps = ref<number>(5)
const includeAudio = ref(true)

const audioCodec = ref('aac')
const audioBitrateKbps = ref<number>(128)

const videoCodecSupport = ref<Record<string, boolean>>({})
const isLoadingCodecSupport = ref(false)

// Collections data
const collections = ref<ContentCollection[]>([])
const isLoadingCollections = ref(false)

// Export state
const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref<string | null>(null)
const exportPhase = ref<'encoding' | 'uploading' | 'saving' | null>(null)

const scopeOptions = computed(() => {
  const opts = [{ value: 'personal', label: t('videoEditor.export.scopePersonal') }]
  if (projects.value.length > 0 || props.projectId) {
    opts.push({ value: 'project', label: t('videoEditor.export.scopeProject') })
  }
  return opts
})

const projectOptions = computed(() => {
  return projects.value.map((p) => ({ value: p.id, label: p.name }))
})

const collectionOptions = computed(() =>
  collections.value
    .filter((c) => !c.parentId && c.type !== 'PUBLICATION_MEDIA_VIRTUAL' && c.type !== 'UNSPLASH')
    .map((c) => ({ value: c.id, label: c.title })),
)

const selectedCollection = computed(() => {
  if (!selectedCollectionId.value) return null
  return collections.value.find((c) => c.id === selectedCollectionId.value)
})

const subGroupTreeItems = computed(() => {
  if (selectedCollection.value?.type !== 'GROUP') return []
  return buildGroupTreeFromRoot({
    rootId: selectedCollection.value.id,
    allGroupCollections: collections.value,
    labelFn: (c) => c.title,
  })
})

const phaseLabel = computed(() => {
  if (exportPhase.value === 'encoding') return t('videoEditor.export.phaseEncoding')
  if (exportPhase.value === 'uploading') return t('videoEditor.export.phaseUploading')
  if (exportPhase.value === 'saving') return t('videoEditor.export.phaseSaving')
  return ''
})

async function loadCollections() {
  if (isLoadingCollections.value) return
  isLoadingCollections.value = true
  try {
    const result = await listCollections(
      scope.value,
      scope.value === 'project' ? selectedProjectId.value ?? undefined : undefined,
    )
    collections.value = result ?? []
    // Reset selection when collections reload
    selectedCollectionId.value = null
    selectedGroupId.value = null
    // Pre-select first top-level group
    const firstGroup = collections.value.find((c) => c.type === 'GROUP' && !c.parentId)
    if (firstGroup) selectedCollectionId.value = firstGroup.id
  } catch {
    collections.value = []
  } finally {
    isLoadingCollections.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (!val) return
    // Reset state on open
    const base = (props.filename || 'video').replace(/\.[^.]+$/, '')
    outputFilename.value = `${base}_trimmed.mp4`
    scope.value = props.projectId ? 'project' : 'personal'
    selectedProjectId.value = props.projectId || null
    videoCodec.value = 'avc1.42E032'
    bitrateMbps.value = 5
    includeAudio.value = true
    exportProgress.value = 0
    exportError.value = null
    exportPhase.value = null
    isExporting.value = false
    loadProjects()
    loadCollections()
    loadCodecSupport()
  },
)

const videoCodecOptions = computed(() =>
  resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, videoCodecSupport.value),
)

const audioCodecOptions = computed(() => [{ value: 'aac', label: 'AAC' }])

const bitrateBps = computed(() => {
  const value = Number(bitrateMbps.value)
  if (!Number.isFinite(value)) return 5_000_000
  const clamped = Math.min(200, Math.max(0.2, value))
  return Math.round(clamped * 1_000_000)
})

watch(scope, () => {
  loadCollections()
})

watch(selectedProjectId, () => {
  if (scope.value === 'project') {
    loadCollections()
  }
})

watch(selectedCollectionId, () => {
  selectedGroupId.value = null
})

async function loadCodecSupport() {
  if (isLoadingCodecSupport.value) return
  isLoadingCodecSupport.value = true
  try {
    videoCodecSupport.value = await checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS)

    if (videoCodecSupport.value[videoCodec.value] === false) {
      const firstSupported = BASE_VIDEO_CODEC_OPTIONS.find((opt) => videoCodecSupport.value[opt.value])
      if (firstSupported) videoCodec.value = firstSupported.value
    }
  } finally {
    isLoadingCodecSupport.value = false
  }
}

async function handleConfirm() {
  if (isExporting.value) return
  isExporting.value = true
  exportProgress.value = 0
  exportError.value = null

  try {
    if (videoCodecSupport.value[videoCodec.value] === false) {
      throw new Error('Selected video codec is not supported by this browser')
    }

    // Phase 1: encode
    exportPhase.value = 'encoding'
    const blob = await props.exportFn({
      videoCodec: videoCodec.value,
      bitrate: bitrateBps.value,
      audio: includeAudio.value,
    })
    exportProgress.value = 60

    // Phase 2: upload media file
    exportPhase.value = 'uploading'
    const file = new File([blob], outputFilename.value, { type: 'video/mp4' })
    const uploadedMedia = await uploadMedia(
      file,
      (pct) => {
        exportProgress.value = 60 + Math.round((pct / 100) * 30)
      },
      undefined,
      scope.value === 'project' ? selectedProjectId.value ?? undefined : undefined,
    )
    exportProgress.value = 90

    // Phase 3: create content library item
    exportPhase.value = 'saving'
    const groupId = selectedGroupId.value ?? selectedCollectionId.value ?? undefined
    await api.post('/content-library/items', {
      scope: scope.value,
      projectId: scope.value === 'project' ? selectedProjectId.value ?? undefined : undefined,
      groupId,
      title: outputFilename.value,
      text: '',
      meta: {},
      media: [{ mediaId: uploadedMedia.id, order: 0, hasSpoiler: false }],
    })

    exportProgress.value = 100
    toast.add({
      title: t('common.success'),
      description: t('videoEditor.export.successMessage'),
      color: 'success',
    })
    emit('exported')
    isOpen.value = false
  } catch (err: any) {
    exportError.value = err?.message || t('videoEditor.export.errorMessage')
  } finally {
    isExporting.value = false
    exportPhase.value = null
  }
}

function handleCancel() {
  if (isExporting.value) return
  isOpen.value = false
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('videoEditor.export.title')"
    :prevent-close="isExporting"
    :close-button="!isExporting"
  >
    <div class="flex flex-col gap-5">
      <!-- Filename -->
      <UFormField :label="t('videoEditor.export.filename')">
        <UInput
          v-model="outputFilename"
          class="w-full"
          :disabled="isExporting"
        />
      </UFormField>

      <!-- Scope selector -->
      <UFormField :label="t('videoEditor.export.destination')">
        <UiAppButtonGroup
          v-model="scope"
          :options="scopeOptions"
          :disabled="isExporting"
        />
      </UFormField>

      <UFormField v-if="scope === 'project'" :label="t('contentLibrary.bulk.selectProject')">
        <USelectMenu
          :model-value="(projectOptions.find(o => o.value === selectedProjectId) || selectedProjectId) as any"
          @update:model-value="(v: any) => selectedProjectId = v?.value ?? v"
          :items="projectOptions"
          value-key="value"
          label-key="label"
          searchable
          :search-input="{ placeholder: t('contentLibrary.bulk.selectProject') }"
          :placeholder="t('contentLibrary.bulk.selectProject')"
          :disabled="isExporting || isLoadingProjects"
          :loading="isLoadingProjects"
          class="w-full"
        />
      </UFormField>

      <!-- Encoding settings -->
      <div class="flex flex-col gap-4">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
          {{ t('videoEditor.export.encodingSettings') }}
        </div>

        <UFormField :label="t('videoEditor.export.videoCodec')">
          <USelectMenu
            :model-value="(videoCodecOptions.find(o => o.value === videoCodec) || videoCodec) as any"
            @update:model-value="(v: any) => videoCodec = v?.value ?? v"
            :items="videoCodecOptions"
            value-key="value"
            label-key="label"
            :disabled="isExporting || isLoadingCodecSupport"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('videoEditor.export.videoBitrate')"
          :help="t('videoEditor.export.videoBitrateHelp')"
        >
          <UInput
            v-model.number="bitrateMbps"
            type="number"
            inputmode="decimal"
            min="0.2"
            step="0.1"
            :disabled="isExporting"
            class="w-full"
          />
        </UFormField>

        <label class="flex items-center gap-3 cursor-pointer">
          <UCheckbox v-model="includeAudio" :disabled="isExporting" />
          <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('videoEditor.export.includeAudio') }}</span>
        </label>

        <UFormField
          v-if="includeAudio"
          :label="t('videoEditor.export.audioCodec')"
          :help="t('videoEditor.export.audioCodecHelp')"
        >
          <USelectMenu
            :model-value="(audioCodecOptions.find(o => o.value === audioCodec) || audioCodec) as any"
            @update:model-value="(v: any) => audioCodec = v?.value ?? v"
            :items="audioCodecOptions"
            value-key="value"
            label-key="label"
            :disabled="true"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="includeAudio"
          :label="t('videoEditor.export.audioBitrate')"
          :help="t('videoEditor.export.audioBitrateHelp')"
        >
          <UInput
            v-model.number="audioBitrateKbps"
            type="number"
            inputmode="numeric"
            min="32"
            step="16"
            :disabled="true"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Collection selector -->
      <UFormField :label="t('videoEditor.export.collection')">
        <USelectMenu
          :model-value="(collectionOptions.find(o => o.value === selectedCollectionId) || selectedCollectionId) as any"
          @update:model-value="(v: any) => selectedCollectionId = v?.value ?? v"
          :items="collectionOptions"
          value-key="value"
          label-key="label"
          searchable
          :search-input="{ placeholder: t('contentLibrary.bulk.searchGroups') }"
          :placeholder="t('videoEditor.export.noCollection')"
          :loading="isLoadingCollections"
          :disabled="isExporting || isLoadingCollections"
          class="w-full"
        />
      </UFormField>

      <!-- Sub-group tree selector -->
      <UFormField
        v-if="selectedCollection?.type === 'GROUP' && subGroupTreeItems.length > 0"
        :label="t('videoEditor.export.group')"
      >
        <div class="py-2.5 px-3 border border-gray-200 dark:border-gray-800 rounded-md max-h-60 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900">
          <ContentGroupSelectTree
            :items="subGroupTreeItems as any"
            :selected-id="selectedGroupId"
            @select="val => selectedGroupId = val"
          />
        </div>
      </UFormField>

      <!-- Progress -->
      <div v-if="isExporting" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{{ phaseLabel }}</span>
          <span>{{ exportProgress }}%</span>
        </div>
        <div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary-500 rounded-full transition-all duration-300"
            :style="{ width: `${exportProgress}%` }"
          />
        </div>
      </div>

      <!-- Error -->
      <UAlert
        v-if="exportError"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('common.error')"
        :description="exportError"
      />
    </div>

    <template #footer>
      <UButton
        variant="ghost"
        color="neutral"
        :disabled="isExporting"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :loading="isExporting"
        :disabled="isExporting"
        icon="i-heroicons-arrow-down-tray"
        @click="handleConfirm"
      >
        {{ t('videoEditor.export.confirm') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
