<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useWebAV } from '~/composables/useWebAV'
import type { OTFile } from 'opfs-tools'

interface Props {
  src: string
  filename?: string
  projectId?: string
  collectionId?: string
  groupId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const showExportModal = ref(false)

const containerEl = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(true)
const hasAudioTrack = ref(false)
// Composable setup
const webAV = useWebAV()
const { supportStatus, isPlaying, currentTimeUs, durationUs, avCanvas } = webAV

const { t } = useI18n()
const showSupportBanner = ref(false)

// Trim points in microseconds
const trimInUs = ref(0)
const trimOutUs = ref(0)

function openExportModal() {
  if (isLoading.value || !!loadError.value || durationUs.value === 0) return
  showExportModal.value = true
}

const isTrimmed = computed(
  () => trimInUs.value > 0 || trimOutUs.value < durationUs.value,
)

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

let videoSprite: any = null
let mp4Clip: any = null
let opfsVideoFile: OTFile | null = null

async function cleanupOpfsVideoFile() {
  const fileToRemove = opfsVideoFile
  opfsVideoFile = null
  if (!fileToRemove) return

  try {
    await fileToRemove.remove({ force: true })
  } catch (err) {
    console.warn('[MediaVideoEditor] Failed to remove OPFS tmp file', err)
  }
}

async function initEditor() {
  if (!containerEl.value) return
  isLoading.value = true
  loadError.value = null

  try {
    const [{ MP4Clip, VisibleSprite }, { tmpfile, write }] = await Promise.all([
      import('@webav/av-cliper'),
      import('opfs-tools'),
    ])

    // Initial check for WebCodecs and Codec support
    const { supportStatus: status } = await webAV.checkSupport()
    if (status === 'full') {
      showSupportBanner.value = true
    }

    const response = await fetch(props.src, {
      cache: 'no-store',
      headers: {
        Range: 'bytes=0-',
      },
    })
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`)

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('webm') || contentType.includes('ogg')) {
      throw new Error(t('videoEditor.support.formatError', { type: contentType }))
    }

    // Clean up previous tmp file (in case initEditor is re-run)
    await cleanupOpfsVideoFile()

    // Write stream to OPFS tmp file — avoids holding the entire file in RAM.
    // MP4Clip reads samples on-demand from OPFS instead of from an ArrayBuffer.
    opfsVideoFile = markRaw(tmpfile())
    await write(opfsVideoFile, response.body!)

    const rawClip = new MP4Clip(opfsVideoFile)
    mp4Clip = markRaw(rawClip)
    await mp4Clip.ready

    const { width, height, duration, audioSampleRate } = mp4Clip.meta
    hasAudioTrack.value = !!audioSampleRate
    durationUs.value = duration
    trimInUs.value = 0
    trimOutUs.value = duration

    await webAV.initCanvas(containerEl.value, width || 1280, height || 720, '#000')

    const rawSprite = new VisibleSprite(mp4Clip)
    videoSprite = markRaw(rawSprite)
    videoSprite.time.offset = 0
    videoSprite.time.duration = duration

    await avCanvas.value.addSprite(videoSprite)

    // Show first frame
    await avCanvas.value.previewFrame(0)
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    loadError.value = err?.message || 'Failed to load video'
    console.error('[MediaVideoEditor] init error:', err)
    await cleanupOpfsVideoFile()
  } finally {
    isLoading.value = false
  }
}

function play() {
  if (!avCanvas.value || durationUs.value === 0) return
  const start = currentTimeUs.value >= trimOutUs.value ? trimInUs.value : currentTimeUs.value
  webAV.play(start, trimOutUs.value)
}

function pause() {
  webAV.pause()
}

function togglePlayPause() {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

function rewind() {
  pause()
  currentTimeUs.value = trimInUs.value
  avCanvas.value?.previewFrame(trimInUs.value)
}

async function onSeek(timeUs: number) {
  const wasPlaying = isPlaying.value
  if (wasPlaying) pause()

  currentTimeUs.value = timeUs
  await avCanvas.value?.previewFrame(timeUs)

  if (wasPlaying) play()
}

async function onTrimInChange(value: number) {
  trimInUs.value = value
  // If playhead is before new trim-in, snap it
  if (currentTimeUs.value < value) {
    await onSeek(value)
  }
}

async function onTrimOutChange(value: number) {
  trimOutUs.value = value
  // If playhead is after new trim-out, snap it
  if (currentTimeUs.value > value) {
    await onSeek(value)
  }
}

function resetTrim() {
  trimInUs.value = 0
  trimOutUs.value = durationUs.value
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

async function exportTrimmed(options: ExportOptions): Promise<ReadableStream<Uint8Array>> {
  if (!opfsVideoFile) throw new Error('No video loaded')

  if (options.format === 'webm' || options.format === 'mkv') {
    const [{ MP4Clip }, { exportToContainer }] = await Promise.all([
      import('@webav/av-cliper'),
      import('~/utils/video-webm-export'),
    ])

    const exportClip = new MP4Clip(opfsVideoFile)
    await exportClip.ready

    return exportToContainer(exportClip, {
      format: options.format,
      trimInUs: trimInUs.value,
      trimOutUs: trimOutUs.value,
      bitrate: options.bitrate,
      audioBitrate: options.audioBitrate,
      audio: options.audio,
      width: options.width,
      height: options.height,
      fps: options.fps,
    })
  }

  const { MP4Clip, OffscreenSprite, Combinator } = await import('@webav/av-cliper')

  const trimDurationUs = trimOutUs.value - trimInUs.value

  // Reuse the same OPFS file — no extra RAM allocation
  const exportClip = new MP4Clip(opfsVideoFile)
  await exportClip.ready

  const hasAudioTrack = !!exportClip.meta?.audioSampleRate

  // Split at trim-in point; use the second part (after trim-in)
  const [, afterIn] = await exportClip.split(trimInUs.value)
  const clipToExport = trimInUs.value > 0 ? afterIn : exportClip

  const sprite = new OffscreenSprite(clipToExport)
  sprite.time.offset = 0
  sprite.time.duration = trimDurationUs

  const combinator = new Combinator({
    width: options.width,
    height: options.height,
    fps: options.fps,
    bgColor: '#000',
    videoCodec: options.videoCodec,
    bitrate: options.bitrate,
    audio: options.audio && hasAudioTrack ? { codec: options.audioCodec || 'aac' } : false,
  } as any)

  await combinator.addSprite(sprite)

  return combinator.output() as unknown as ReadableStream<Uint8Array>
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  webAV.destroyCanvas()
  mp4Clip = null
  videoSprite = null
  void cleanupOpfsVideoFile()
})
</script>

<template>
  <div class="flex flex-col h-full bg-gray-950 text-white select-none">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
      <span class="text-sm font-medium text-gray-300 truncate max-w-xs">
        {{ props.filename || 'Video Editor' }}
      </span>
      <UButton
        icon="i-heroicons-x-mark"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="emit('close')"
      />
    </div>

    <!-- Support Banner -->
    <div v-if="supportStatus && supportStatus !== 'full'" class="px-4 py-2 bg-gray-900 border-b border-gray-800">
      <UAlert
        :color="supportStatus === 'none' ? 'error' : 'warning'"
        variant="soft"
        :icon="supportStatus === 'none' ? 'i-heroicons-exclamation-circle' : 'i-heroicons-information-circle'"
        :title="t('videoEditor.support.title')"
        :description="t(`videoEditor.support.${supportStatus}`)"
        :actions="[{ label: t('common.close'), variant: 'ghost', color: 'neutral', onClick: () => { supportStatus = null } }]"
      />
    </div>
    <div v-else-if="supportStatus === 'full' && showSupportBanner" class="px-4 py-2 bg-gray-900 border-b border-gray-800">
      <UAlert
        color="success"
        variant="soft"
        icon="i-heroicons-check-circle"
        :title="t('videoEditor.support.title')"
        :description="t('videoEditor.support.full')"
        :actions="[{ label: t('common.close'), variant: 'ghost', color: 'neutral', onClick: () => { showSupportBanner = false } }]"
      />
    </div>

    <!-- Preview area -->
    <div class="flex-1 flex items-center justify-center overflow-hidden relative min-h-0">
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mr-2" />
        Loading video...
      </div>

      <div
        v-else-if="loadError"
        class="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-6 text-center"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 mr-2 shrink-0" />
        {{ loadError }}
      </div>

      <!-- WebAV canvas mounts here -->
      <div
        ref="containerEl"
        class="w-full h-full"
        :class="{ invisible: isLoading || loadError }"
      />
    </div>

    <!-- Timeline & controls -->
    <div class="shrink-0 border-t border-gray-800 px-4 py-3 flex flex-col gap-3">
      <!-- Trim timeline -->
      <MediaVideoTrimTimeline
        :duration="durationUs"
        :current-time="currentTimeUs"
        :trim-in="trimInUs"
        :trim-out="trimOutUs"
        :disabled="isLoading || !!loadError"
        @update:trim-in="onTrimInChange"
        @update:trim-out="onTrimOutChange"
        @seek="onSeek"
      />

      <!-- Playback controls row -->
      <div class="flex items-center justify-between">
        <!-- Left: time display -->
        <span class="text-xs text-gray-400 tabular-nums font-mono w-24">
          {{ formatTime(currentTimeUs / 1e6) }} / {{ formatTime(durationUs / 1e6) }}
        </span>

        <!-- Center: playback buttons -->
        <div class="flex items-center gap-2">
          <UButton
            icon="i-heroicons-backward"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="isLoading || !!loadError"
            @click="rewind"
          />

          <UButton
            :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
            variant="solid"
            color="primary"
            size="md"
            :disabled="isLoading || !!loadError || durationUs === 0"
            @click="togglePlayPause"
          />
        </div>

        <!-- Right: trim actions -->
        <div class="flex items-center gap-2 w-24 justify-end">
          <UButton
            v-if="isTrimmed"
            icon="i-heroicons-arrow-uturn-left"
            variant="ghost"
            color="neutral"
            size="xs"
            title="Reset trim"
            :disabled="isLoading || !!loadError"
            @click="resetTrim"
          />

          <UButton
            icon="i-heroicons-scissors"
            variant="soft"
            color="primary"
            size="sm"
            :disabled="isLoading || !!loadError || durationUs === 0"
            @click="openExportModal"
          >
            Export
          </UButton>
        </div>
      </div>

      <!-- Export modal -->
      <MediaVideoExportModal
        v-model:open="showExportModal"
        :filename="props.filename"
        :project-id="props.projectId"
        :collection-id="props.collectionId"
        :group-id="props.groupId"
        :has-audio="hasAudioTrack"
        :export-fn="exportTrimmed"
      />
    </div>
  </div>
</template>
