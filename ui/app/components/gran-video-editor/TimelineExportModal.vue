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
const exportWidth = ref<number>(1920)
const exportHeight = ref<number>(1080)
const exportFps = ref<number>(30)

const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref<string | null>(null)
const exportPhase = ref<'encoding' | 'saving' | null>(null)

function getFormatOptions(): readonly FormatOption[] {
  return [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM (VP9 + Opus)' },
    { value: 'mkv', label: 'MKV (AV1 + Opus)' },
  ]
}

const videoCodecSupport = ref<Record<string, boolean>>({})
const isLoadingCodecSupport = ref(false)

function getVideoCodecOptions() {
  return resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, videoCodecSupport.value)
}

function getAudioCodecLabel() {
  if (outputFormat.value === 'webm' || outputFormat.value === 'mkv') return 'Opus'
  return audioCodec.value === 'opus' ? 'Opus' : 'AAC'
}

const bitrateBps = computed(() => {
  const value = Number(bitrateMbps.value)
  if (!Number.isFinite(value)) return 5_000_000
  const clamped = Math.min(200, Math.max(0.2, value))
  return Math.round(clamped * 1_000_000)
})

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

function getPhaseLabel() {
  if (exportPhase.value === 'encoding') return t('videoEditor.export.phaseEncoding', 'Encoding')
  if (exportPhase.value === 'saving') return t('videoEditor.export.phaseSaving', 'Saving')
  return ''
}

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

function getBunnyVideoCodec(codec: string): any {
  if (codec.startsWith('avc1')) return 'avc'
  if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return 'hevc'
  if (codec.startsWith('vp8')) return 'vp8'
  if (codec.startsWith('vp09')) return 'vp9'
  if (codec.startsWith('av01')) return 'av1'
  return 'avc'
}

function resolveExportCodecs(format: 'mp4' | 'webm' | 'mkv', selectedVideoCodec: string, selectedAudioCodec: string) {
  if (format === 'webm') {
    return {
      videoCodec: 'vp09.00.10.08',
      audioCodec: 'opus',
    }
  }

  if (format === 'mkv') {
    return {
      videoCodec: 'av01.0.05M.08',
      audioCodec: 'opus',
    }
  }

  return {
    videoCodec: selectedVideoCodec,
    audioCodec: selectedAudioCodec,
  }
}

async function exportTimelineToFile(options: ExportOptions, fileHandle: FileSystemFileHandle, onProgress: (progress: number) => void): Promise<void> {
  const clips = videoEditorStore.timelineClips
  if (!clips.length) throw new Error('Timeline is empty')

  const { Application, Sprite, Texture, CanvasSource: PixiCanvasSource } = await import('pixi.js')
  const { Input, BlobSource, VideoSampleSink, Output, Mp4OutputFormat, WebMOutputFormat, MkvOutputFormat, CanvasSource: MediaBunnyCanvasSource, AudioBufferSource, StreamTarget, ALL_FORMATS } = await import('mediabunny')

  let hasAnyAudio = false
  let sequentialTimeUs = 0

  const trackSinks: Array<{
    startUs: number
    endUs: number
    durationUs: number
    input: any
    track: any
    sink: any
    sprite: any
    texture: any
    baseCanvas: OffscreenCanvas
    baseCtx: OffscreenCanvasRenderingContext2D
    file: File
  }> = []

  const app = new Application()
  await app.init({
    width: options.width,
    height: options.height,
    backgroundColor: '#000',
    clearBeforeRender: true,
  })
  const mainCanvas = app.canvas as unknown as OffscreenCanvas

  try {
    for (const clip of clips) {
      if (clip.track !== 'video' || !clip.fileHandle) continue
      const file = await clip.fileHandle.getFile()
      const source = new BlobSource(file)
      const input = new Input({ source, formats: ALL_FORMATS } as any)
      const track = await input.getPrimaryVideoTrack()
      if (!track || !(await track.canDecode())) {
        input.dispose()
        continue
      }

      const audioTrack = await input.getPrimaryAudioTrack()
      if (audioTrack) hasAnyAudio = true

      const sink = new VideoSampleSink(track)
      const durUs = Math.floor((await track.computeDuration()) * 1_000_000)
      
      const startUs = sequentialTimeUs
      sequentialTimeUs += durUs

      const baseCanvas = new OffscreenCanvas(options.width, options.height)
      const baseCtx = baseCanvas.getContext('2d')!
      const canvasSource = new PixiCanvasSource({ resource: baseCanvas as any })
      const texture = new Texture({ source: canvasSource })
      const sprite = new Sprite(texture)
      
      sprite.width = options.width
      sprite.height = options.height
      sprite.alpha = 0
      app.stage.addChild(sprite)

      trackSinks.push({ startUs, endUs: startUs + durUs, durationUs: durUs, input, track, sink, sprite, texture, baseCanvas, baseCtx, file })
    }

    const maxDurationUs = sequentialTimeUs
    if (maxDurationUs <= 0) throw new Error('No video clips to export')

    const durationS = maxDurationUs / 1_000_000

    // Audio Processing using Web Audio API OfflineAudioContext
    let offlineCtx: OfflineAudioContext | null = null
    let audioData: AudioBuffer | null = null

    if (options.audio && hasAnyAudio) {
      offlineCtx = new OfflineAudioContext({
        numberOfChannels: 2,
        sampleRate: 48000,
        length: Math.ceil(48000 * durationS)
      })

      for (const clipData of trackSinks) {
        const arrayBuffer = await clipData.file.arrayBuffer()
        try {
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)
          const sourceNode = offlineCtx.createBufferSource()
          sourceNode.buffer = audioBuffer
          sourceNode.connect(offlineCtx.destination)
          sourceNode.start(clipData.startUs / 1_000_000)
        } catch (err) {
          console.warn('[TimelineExportModal] Failed to decode audio for clip', err)
        }
      }

      audioData = await offlineCtx.startRendering()
    }

    let format;
    if (options.format === 'webm') format = new WebMOutputFormat()
    else if (options.format === 'mkv') format = new MkvOutputFormat()
    else format = new Mp4OutputFormat()

    // Pass writable directly to StreamTarget
    const writable = await (fileHandle as any).createWritable()
    const target = new StreamTarget(writable)
    const output = new Output({ target, format })
    
    const videoSource = new MediaBunnyCanvasSource(mainCanvas, {
      codec: getBunnyVideoCodec(options.videoCodec),
      bitrate: options.bitrate,
      hardwareAcceleration: 'prefer-software'
    })
    
    output.addVideoTrack(videoSource)

    let audioSource: any = null
    if (audioData) {
      audioSource = new AudioBufferSource(audioData, {
        codec: options.audioCodec || 'aac',
        bitrate: options.audioBitrate,
        numberOfChannels: audioData.numberOfChannels,
        sampleRate: audioData.sampleRate
      })
      output.addAudioTrack(audioSource)
    }

    // Generate frames
    const totalFrames = Math.ceil(durationS * options.fps)
    const dtUs = Math.floor(1_000_000 / options.fps)
    let currentTimeUs = 0

    // Force output start before generating
    await output.start()

    for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
      for (const c of trackSinks) {
        c.sprite.alpha = 0
      }

      const activeClip = trackSinks.find(c => currentTimeUs >= c.startUs && currentTimeUs < c.endUs)
      
      if (activeClip) {
        const localTimeUs = currentTimeUs - activeClip.startUs
        const sample = await activeClip.sink.getSample(localTimeUs / 1_000_000)
        
        if (sample) {
          activeClip.baseCtx.clearRect(0, 0, options.width, options.height)
          
          const img = typeof sample.toCanvasImageSource === 'function' ? sample.toCanvasImageSource() : sample
          const frameW = (img as VideoFrame).displayWidth || (img as any).width || options.width
          const frameH = (img as VideoFrame).displayHeight || (img as any).height || options.height
          const scale = Math.min(options.width / frameW, options.height / frameH)
          
          const targetW = frameW * scale
          const targetH = frameH * scale
          const targetX = (options.width - targetW) / 2
          const targetY = (options.height - targetH) / 2
          
          try {
            activeClip.baseCtx.drawImage(img, targetX, targetY, targetW, targetH)
          } catch (err) {
            console.warn('[TimelineExportModal] drawImage error directly, trying createImageBitmap fallback', err)
            const bmp = await createImageBitmap(img)
            activeClip.baseCtx.drawImage(bmp, targetX, targetY, targetW, targetH)
            bmp.close()
          }
          activeClip.texture.source.update()
          activeClip.sprite.alpha = 1
          
          if ('close' in sample) (sample as any).close()
        }
      }

      app.render()
      // Send frame from main canvas
      await (videoSource as any).add(currentTimeUs / 1_000_000, dtUs / 1_000_000)
      
      currentTimeUs += dtUs
      onProgress(Math.min(100, Math.round(((frameNum + 1) / totalFrames) * 100)))
    }

    if ('close' in videoSource) (videoSource as any).close()
    if (audioSource && 'close' in audioSource) (audioSource as any).close()

    await output.finalize()

  } finally {
    app.destroy(true, { children: true, texture: true })
    for (const c of trackSinks) {
      if ('dispose' in c.sink) (c.sink as any).dispose()
      else if ('close' in c.sink) (c.sink as any).close()

      if ('dispose' in c.input) (c.input as any).dispose()
      else if ('close' in c.input) (c.input as any).close()
    }
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
    videoCodec.value = videoEditorStore.projectSettings.export.encoding.videoCodec
    bitrateMbps.value = videoEditorStore.projectSettings.export.encoding.bitrateMbps
    excludeAudio.value = videoEditorStore.projectSettings.export.encoding.excludeAudio
    audioBitrateKbps.value = videoEditorStore.projectSettings.export.encoding.audioBitrateKbps
    exportWidth.value = videoEditorStore.projectSettings.export.width
    exportHeight.value = videoEditorStore.projectSettings.export.height
    exportFps.value = videoEditorStore.projectSettings.export.fps

    await loadCodecSupport()

    outputFormat.value = videoEditorStore.projectSettings.export.encoding.format

    const exportDir = await ensureExportDir()
    const timelineBase = sanitizeBaseName(videoEditorStore.currentFileName || videoEditorStore.currentProjectName || 'timeline')
    outputFilename.value = await getNextAvailableFilename(exportDir, timelineBase, getExt(outputFormat.value))
    await validateFilename(exportDir)
  },
)

watch(outputFormat, async (fmt) => {
  const codecConfig = resolveExportCodecs(fmt, videoCodec.value, audioCodec.value)
  videoCodec.value = codecConfig.videoCodec
  audioCodec.value = codecConfig.audioCodec

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
  } catch {
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
      if (e?.name === 'NotAllowedError' || e?.name === 'InvalidModificationError') {
        throw new Error('A file with this name already exists', { cause: e })
      }
      throw e
    }

    const resolvedCodecs = resolveExportCodecs(outputFormat.value, videoCodec.value, audioCodec.value)

    exportPhase.value = 'encoding'
    await exportTimelineToFile({
      format: outputFormat.value,
      videoCodec: resolvedCodecs.videoCodec,
      bitrate: bitrateBps.value,
      audioBitrate: audioBitrateKbps.value * 1000,
      audio: !excludeAudio.value,
      audioCodec: resolvedCodecs.audioCodec,
      width: normalizedExportWidth.value,
      height: normalizedExportHeight.value,
      fps: normalizedExportFps.value,
    }, fileHandle, (progress) => {
      exportProgress.value = progress
    })

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

      <MediaEncodingSettings
        v-model:output-format="outputFormat"
        v-model:video-codec="videoCodec"
        v-model:bitrate-mbps="bitrateMbps"
        v-model:exclude-audio="excludeAudio"
        v-model:audio-bitrate-kbps="audioBitrateKbps"
        :disabled="isExporting"
        :has-audio="true"
        :is-loading-codec-support="isLoadingCodecSupport"
        :format-options="getFormatOptions()"
        :video-codec-options="getVideoCodecOptions()"
        :audio-codec-label="getAudioCodecLabel()"
      />

      <div v-if="isExporting" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{{ getPhaseLabel() }}</span>
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
