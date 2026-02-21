<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVideoEditorStore } from '~/stores/videoEditor'
import MediaEncodingSettings, { type FormatOption } from '~/components/media/MediaEncodingSettings.vue'
import {
  BASE_VIDEO_CODEC_OPTIONS,
  checkAudioCodecSupport,
  checkVideoCodecSupport,
  resolveVideoCodecOptions,
} from '~/utils/webcodecs'

interface Props {
  open: boolean
}

interface ExportOptions {
  format: 'mp4' | 'webm' | 'mkv'
  videoCodec: string
  bitrate: number
  audioBitrate: number
  audio: boolean
  audioCodec?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  exported: []
}>()

const { t } = useI18n()
const toast = useToast()
const videoEditorStore = useVideoEditorStore()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const outputFilename = ref('')
const filenameError = ref<string | null>(null)

const outputFormat = ref<'mp4' | 'webm' | 'mkv'>('mp4')
const videoCodec = ref('avc1.42E032')
const bitrateMbps = ref<number>(5)
const excludeAudio = ref(false)
const audioCodec = ref('aac')
const audioBitrateKbps = ref<number>(128)

const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref<string | null>(null)
const exportPhase = ref<'encoding' | 'saving' | null>(null)

const formatOptions: readonly FormatOption[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM (VP9 + Opus)' },
  { value: 'mkv', label: 'MKV (AV1 + Opus)' },
]

const videoCodecSupport = ref<Record<string, boolean>>({})
const isLoadingCodecSupport = ref(false)

const videoCodecOptions = computed(() =>
  resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, videoCodecSupport.value),
)

const audioCodecLabel = computed(() => {
  if (outputFormat.value === 'webm' || outputFormat.value === 'mkv') return 'Opus'
  return audioCodec.value === 'opus' ? 'Opus' : 'AAC'
})

const bitrateBps = computed(() => {
  const value = Number(bitrateMbps.value)
  if (!Number.isFinite(value)) return 5_000_000
  const clamped = Math.min(200, Math.max(0.2, value))
  return Math.round(clamped * 1_000_000)
})

const phaseLabel = computed(() => {
  if (exportPhase.value === 'encoding') return t('videoEditor.export.phaseEncoding', 'Encoding')
  if (exportPhase.value === 'saving') return t('videoEditor.export.phaseSaving', 'Saving')
  return ''
})

const ext = computed(() => getExt(outputFormat.value))

function sanitizeBaseName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function listExportFilenames(exportDir: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  const iterator = (exportDir as any).values?.() ?? (exportDir as any).entries?.()
  if (!iterator) return names

  for await (const value of iterator) {
    const handle = Array.isArray(value) ? value[1] : value
    if (handle?.kind === 'file' && typeof handle?.name === 'string') {
      names.add(handle.name)
    }
  }
  return names
}

function getExt(fmt: 'mp4' | 'webm' | 'mkv'): 'mp4' | 'webm' | 'mkv' {
  if (fmt === 'webm') return 'webm'
  if (fmt === 'mkv') return 'mkv'
  return 'mp4'
}

async function getNextAvailableFilename(exportDir: FileSystemDirectoryHandle, base: string, ext: string) {
  const names = await listExportFilenames(exportDir)
  let index = 1
  while (index < 1000) {
    const candidate = `${base}_${String(index).padStart(3, '0')}.${ext}`
    if (!names.has(candidate)) return candidate
    index++
  }
  throw new Error('Failed to generate a unique filename')
}

async function loadCodecSupport() {
  if (isLoadingCodecSupport.value) return
  isLoadingCodecSupport.value = true
  try {
    const [videoSupport, audioSupport] = await Promise.all([
      checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS),
      checkAudioCodecSupport([
        { value: 'mp4a.40.2', label: 'AAC' },
        { value: 'opus', label: 'Opus' },
      ]),
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

async function writeStreamToFile(stream: ReadableStream<Uint8Array>, fileHandle: FileSystemFileHandle) {
  const writable = await (fileHandle as any).createWritable()
  try {
    const reader = stream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) await writable.write(value)
    }
  } finally {
    await writable.close()
  }
}

async function exportTimelineToStream(options: ExportOptions): Promise<ReadableStream<Uint8Array>> {
  const clips = videoEditorStore.timelineClips
  if (!clips.length) throw new Error('Timeline is empty')

  const [{ MP4Clip, OffscreenSprite, Combinator }, { tmpfile, write }] = await Promise.all([
    import('@webav/av-cliper'),
    import('opfs-tools'),
  ])

  const tmpFiles: Array<{ remove: (options?: any) => Promise<void> }> = []

  async function cleanup() {
    await Promise.all(
      tmpFiles.map(async (f) => {
        try {
          await f.remove({ force: true })
        } catch (err) {
          console.warn('[TimelineExportModal] Failed to remove OPFS tmp file', err)
        }
      }),
    )
  }

  try {
    const combinator = new Combinator({
      width: 1280,
      height: 720,
      bgColor: '#000',
      videoCodec: options.videoCodec,
      bitrate: options.bitrate,
      audio: options.audio ? { codec: options.audioCodec || 'aac', bitrate: options.audioBitrate } : false,
    } as any)

    let maxDurationUs = 0
    let hasAnyAudio = false

    for (const clip of clips) {
      if (clip.track !== 'video' || !clip.fileHandle) continue
      const file = await clip.fileHandle.getFile()
      const opfsFile = tmpfile()
      tmpFiles.push(opfsFile)
      await write(opfsFile, file.stream() as any)

      const mp4Clip = new MP4Clip(opfsFile)
      await mp4Clip.ready

      if (mp4Clip.meta?.duration > maxDurationUs) maxDurationUs = mp4Clip.meta.duration
      if (mp4Clip.meta?.audioSampleRate) hasAnyAudio = true

      const sprite = new OffscreenSprite(mp4Clip)
      sprite.time.offset = 0
      sprite.time.duration = mp4Clip.meta.duration
      await combinator.addSprite(sprite)
    }

    if (maxDurationUs <= 0) throw new Error('No video clips to export')

    if (!options.audio || !hasAnyAudio) {
      // Keep as-is
    }

    const mp4Stream = combinator.output({ maxTime: maxDurationUs })

    if (options.format === 'mp4') {
      return mp4Stream as unknown as ReadableStream<Uint8Array>
    }

    const opfsMp4 = tmpfile()
    tmpFiles.push(opfsMp4)
    await write(opfsMp4, mp4Stream as any)

    const exportClip = new MP4Clip(opfsMp4)
    await exportClip.ready

    const { exportToContainer } = await import('~/utils/video-webm-export')

    return exportToContainer(exportClip, {
      format: options.format,
      trimInUs: 0,
      trimOutUs: Math.max(1, Number(exportClip?.meta?.duration) || maxDurationUs),
      bitrate: options.bitrate,
      audioBitrate: options.audioBitrate,
      audio: options.audio,
    })
  } finally {
    await cleanup()
  }
}

async function ensureExportDir(): Promise<FileSystemDirectoryHandle> {
  if (!videoEditorStore.projectsHandle || !videoEditorStore.currentProjectName) {
    throw new Error('Project is not opened')
  }
  const projectDir = await videoEditorStore.projectsHandle.getDirectoryHandle(videoEditorStore.currentProjectName)
  return await projectDir.getDirectoryHandle('export', { create: true })
}

async function validateFilename(exportDir: FileSystemDirectoryHandle) {
  const trimmed = outputFilename.value.trim()
  if (!trimmed) {
    filenameError.value = 'Filename is required'
    return false
  }

  if (!trimmed.toLowerCase().endsWith(`.${ext.value}`)) {
    filenameError.value = `Filename must end with .${ext.value}`
    return false
  }

  const names = await listExportFilenames(exportDir)
  if (names.has(trimmed)) {
    filenameError.value = 'A file with this name already exists'
    return false
  }

  filenameError.value = null
  return true
}

watch(
  () => props.open,
  async (val) => {
    if (!val) return

    exportError.value = null
    filenameError.value = null
    exportProgress.value = 0
    exportPhase.value = null
    isExporting.value = false

    outputFormat.value = 'mp4'
    videoCodec.value = 'avc1.42E032'
    bitrateMbps.value = 5
    excludeAudio.value = false
    audioBitrateKbps.value = 128

    await loadCodecSupport()

    const exportDir = await ensureExportDir()
    const timelineBase = sanitizeBaseName(videoEditorStore.currentFileName || videoEditorStore.currentProjectName || 'timeline')
    outputFilename.value = await getNextAvailableFilename(exportDir, timelineBase, getExt(outputFormat.value))
    await validateFilename(exportDir)
  },
)

watch(outputFormat, async (fmt) => {
  if (!props.open) return

  try {
    const exportDir = await ensureExportDir()
    const base = outputFilename.value.replace(/\.[^.]+$/, '')
    const nextExt = getExt(fmt)

    if (!base) return

    if (!/_\d{3}$/.test(base)) {
      outputFilename.value = await getNextAvailableFilename(exportDir, base, nextExt)
      return
    }

    outputFilename.value = `${base}.${nextExt}`
    await validateFilename(exportDir)
  } catch (e) {
    // ignore
  }
})

watch(outputFilename, async () => {
  if (!props.open) return
  try {
    const exportDir = await ensureExportDir()
    await validateFilename(exportDir)
  } catch {
    // ignore
  }
})

async function handleConfirm() {
  if (isExporting.value) return

  isExporting.value = true
  exportProgress.value = 0
  exportError.value = null

  try {
    const exportDir = await ensureExportDir()
    const ok = await validateFilename(exportDir)
    if (!ok) return

    exportPhase.value = 'encoding'
    const stream = await exportTimelineToStream({
      format: outputFormat.value,
      videoCodec: videoCodec.value,
      bitrate: bitrateBps.value,
      audioBitrate: audioBitrateKbps.value * 1000,
      audio: !excludeAudio.value,
      audioCodec: audioCodec.value,
    })
    exportProgress.value = 60

    exportPhase.value = 'saving'
    // Disallow overwriting an existing file
    try {
      await exportDir.getFileHandle(outputFilename.value)
      throw new Error('A file with this name already exists')
    } catch (e: any) {
      // Expected when file does not exist.
      if (e?.name !== 'NotFoundError') {
        throw e
      }
    }

    let fileHandle: FileSystemFileHandle
    try {
      fileHandle = await exportDir.getFileHandle(outputFilename.value, { create: true })
    } catch (e: any) {
      // Race condition protection (another write created the file between checks)
      if (e?.name === 'NotAllowedError' || e?.name === 'InvalidModificationError') {
        throw new Error('A file with this name already exists')
      }
      throw e
    }
    await writeStreamToFile(stream, fileHandle)

    exportProgress.value = 100

    toast.add({
      title: t('common.success', 'Success'),
      description: t('videoEditor.export.successMessage', 'Export completed'),
      color: 'success',
    })

    emit('exported')
    isOpen.value = false
  } catch (err: any) {
    console.error('[TimelineExportModal] Export failed', err)
    exportError.value = err?.message || t('videoEditor.export.errorMessage', 'Export failed')
  } finally {
    exportPhase.value = null
    isExporting.value = false
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
    :title="t('videoEditor.export.title', 'Export')"
    :prevent-close="isExporting"
    :close-button="!isExporting"
  >
    <div class="flex flex-col gap-5">
      <div class="text-xs text-gray-500">
        {{ t('granVideoEditor.export.destination', 'Destination: export/') }}
      </div>

      <UFormField
        :label="t('videoEditor.export.filename', 'Filename')"
        :error="filenameError || undefined"
      >
        <UInput v-model="outputFilename" class="w-full" :disabled="isExporting" />
      </UFormField>

      <MediaEncodingSettings
        v-model:output-format="outputFormat"
        v-model:video-codec="videoCodec"
        v-model:bitrate-mbps="bitrateMbps"
        v-model:exclude-audio="excludeAudio"
        v-model:audio-bitrate-kbps="audioBitrateKbps"
        :disabled="isExporting"
        :has-audio="true"
        :is-loading-codec-support="isLoadingCodecSupport"
        :format-options="formatOptions"
        :video-codec-options="videoCodecOptions"
        :audio-codec-label="audioCodecLabel"
      />

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

      <UAlert
        v-if="exportError"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('common.error', 'Error')"
        :description="exportError"
      />
    </div>

    <template #footer>
      <UButton variant="ghost" color="neutral" :disabled="isExporting" @click="handleCancel">
        {{ t('common.cancel', 'Cancel') }}
      </UButton>
      <UButton
        color="primary"
        :loading="isExporting"
        :disabled="isExporting || !!filenameError"
        icon="i-heroicons-arrow-down-tray"
        @click="handleConfirm"
      >
        {{ t('videoEditor.export.confirm', 'Export') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
