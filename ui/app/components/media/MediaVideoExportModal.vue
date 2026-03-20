<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CommonContentDestinationSelect from '../common/CommonContentDestinationSelect.vue'
import MediaEncodingSettings, { type FormatOption } from './MediaEncodingSettings.vue'
import {
  BASE_VIDEO_CODEC_OPTIONS,
  checkVideoCodecSupport,
  resolveVideoCodecOptions,
  checkAudioCodecSupport
} from '~/utils/webcodecs'

interface Props {
  open: boolean
  filename?: string
  projectId?: string
  collectionId?: string
  groupId?: string
  hasAudio?: boolean
  /** Stream factory — called when user confirms; must return the exported MP4 stream */
  exportFn: (options: ExportOptions) => Promise<ReadableStream<Uint8Array>>
}

interface ExportOptions {
  format: 'mp4' | 'webm' | 'mkv'
  videoCodec: string
  bitrate: number
  audioBitrate: number
  audio: boolean
  audioCodec?: string
  width: number
  height: number
  fps: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  exported: []
}>()

const { t } = useI18n()
const api = useApi()
const { uploadMediaStream } = useMedia()
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

const outputFormat = ref<'mp4' | 'webm' | 'mkv'>('mp4')
const videoCodec = ref('avc1.42E032')
const bitrateMbps = ref<number>(5)
const excludeAudio = ref(false)

const audioCodec = ref('aac')
const audioBitrateKbps = ref<number>(128)

const exportWidth = ref<number>(1920)
const exportHeight = ref<number>(1080)
const exportFps = ref<number>(30)

const formatOptions: readonly FormatOption[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM (VP9 + Opus)' },
  { value: 'mkv', label: 'MKV (AV1 + Opus)' },
]

const videoCodecSupport = ref<Record<string, boolean>>({})
const isLoadingCodecSupport = ref(false)

const normalizedExportWidth = computed(() => {
  const value = Number(exportWidth.value)
  if (!Number.isFinite(value) || value <= 0) return 1920
  return Math.round(value)
})

const normalizedExportHeight = computed(() => {
  const value = Number(exportHeight.value)
  if (!Number.isFinite(value) || value <= 0) return 1080
  return Math.round(value)
})

const normalizedExportFps = computed(() => {
  const value = Number(exportFps.value)
  if (!Number.isFinite(value) || value <= 0) return 30
  return Math.round(Math.min(240, Math.max(1, value)))
})

// Export state
const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref<string | null>(null)
const exportPhase = ref<'encoding' | 'uploading' | 'saving' | null>(null)

const phaseLabel = computed(() => {
  if (exportPhase.value === 'encoding') return t('videoEditor.export.phaseEncoding')
  if (exportPhase.value === 'uploading') return t('videoEditor.export.phaseUploading')
  if (exportPhase.value === 'saving') return t('videoEditor.export.phaseSaving')
  return ''
})

watch(
  () => props.open,
  (val) => {
    if (!val) return
    exportProgress.value = 0
    exportError.value = null
    exportPhase.value = null
    isExporting.value = false
    // Initial state setup
    selectedCollectionId.value = props.collectionId || null
    selectedGroupId.value = props.groupId || null
    loadCodecSupport()
  },
)

watch(outputFormat, (fmt) => {
  const base = outputFilename.value.replace(/\.[^.]+$/, '')
  const ext = fmt === 'mkv' ? 'mkv' : fmt === 'webm' ? 'webm' : 'mp4'
  outputFilename.value = `${base}.${ext}`
})

const audioCodecLabel = computed(() => {
  if (outputFormat.value === 'webm' || outputFormat.value === 'mkv') return 'Opus'
  return audioCodec.value === 'opus' ? 'Opus' : 'AAC'
})

const videoCodecOptions = computed(() =>
  resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, videoCodecSupport.value),
)

const bitrateBps = computed(() => {
  const value = Number(bitrateMbps.value)
  if (!Number.isFinite(value)) return 5_000_000
  const clamped = Math.min(200, Math.max(0.2, value))
  return Math.round(clamped * 1_000_000)
})

// Destination selection logic is now handled by CommonContentDestinationSelect

async function loadCodecSupport() {
  if (isLoadingCodecSupport.value) return
  isLoadingCodecSupport.value = true
  try {
    const [videoSupport, audioSupport] = await Promise.all([
      checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS),
      checkAudioCodecSupport([{ value: 'mp4a.40.2', label: 'AAC' }, { value: 'opus', label: 'Opus' }])
    ])
    videoCodecSupport.value = videoSupport

    if (videoCodecSupport.value[videoCodec.value] === false) {
      const firstSupported = BASE_VIDEO_CODEC_OPTIONS.find((opt) => videoCodecSupport.value[opt.value])
      if (firstSupported) videoCodec.value = firstSupported.value
    }
    
    if (audioSupport['mp4a.40.2'] === false && audioSupport['opus'] !== false) {
      audioCodec.value = 'opus'
    } else {
      audioCodec.value = 'aac'
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
    const stream = await props.exportFn({
      format: outputFormat.value,
      videoCodec: videoCodec.value,
      bitrate: bitrateBps.value,
      audioBitrate: audioBitrateKbps.value * 1000,
      audio: !excludeAudio.value,
      audioCodec: audioCodec.value,
      width: normalizedExportWidth.value,
      height: normalizedExportHeight.value,
      fps: normalizedExportFps.value,
    })
    exportProgress.value = 30

    const mimeType =
      outputFormat.value === 'webm' ? 'video/webm'
      : outputFormat.value === 'mkv' ? 'video/x-matroska'
      : 'video/mp4'

    // Phase 2: upload media file as stream (no Blob buffering)
    exportPhase.value = 'uploading'
    const uploadedMedia = await uploadMediaStream(
      stream,
      outputFilename.value,
      mimeType,
      undefined,
      scope.value === 'project' ? selectedProjectId.value ?? undefined : undefined,
      (pct) => { exportProgress.value = 30 + Math.round((pct / 100) * 60) },
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
    console.error('[MediaVideoExportModal] Export failed', err)
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
  <AppModal
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
      <CommonContentDestinationSelect
        v-model:scope="scope"
        v-model:project-id="selectedProjectId"
        v-model:collection-id="selectedCollectionId"
        v-model:group-id="selectedGroupId"
        :disabled="isExporting"
      />

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('videoEditor.projectSettings.exportWidth', 'Width')">
          <UInput
            v-model.number="exportWidth"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            :disabled="isExporting"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('videoEditor.projectSettings.exportHeight', 'Height')">
          <UInput
            v-model.number="exportHeight"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            :disabled="isExporting"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField :label="t('videoEditor.projectSettings.exportFps', 'FPS')">
        <UInput
          v-model.number="exportFps"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          :disabled="isExporting"
          class="w-full"
        />
      </UFormField>

      <!-- Encoding settings -->
      <MediaEncodingSettings
        v-model:output-format="outputFormat"
        v-model:video-codec="videoCodec"
        v-model:bitrate-mbps="bitrateMbps"
        v-model:exclude-audio="excludeAudio"
        v-model:audio-bitrate-kbps="audioBitrateKbps"
        :disabled="isExporting"
        :has-audio="props.hasAudio"
        :is-loading-codec-support="isLoadingCodecSupport"
        :format-options="formatOptions"
        :video-codec-options="videoCodecOptions"
        :audio-codec-label="audioCodecLabel"
      />


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
  </AppModal>
</template>
