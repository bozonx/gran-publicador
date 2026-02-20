<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

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
const isPlaying = ref(false)

// Time in microseconds (WebAV uses µs internally)
const currentTimeUs = ref(0)
const durationUs = ref(0)

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

let avCanvas: any = null
let videoSprite: any = null
let mp4Clip: any = null
let videoArrayBuffer: ArrayBuffer | null = null
let unsubscribers: Array<() => void> = []

async function initEditor() {
  if (!containerEl.value) return
  isLoading.value = true
  loadError.value = null

  try {
    const [{ AVCanvas }, { MP4Clip, VisibleSprite }] = await Promise.all([
      import('@webav/av-canvas'),
      import('@webav/av-cliper'),
    ])

    const response = await fetch(props.src, {
      cache: 'no-store',
      headers: {
        Range: 'bytes=0-',
      },
    })
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`)

    const contentType = response.headers.get('content-type') || ''

    // Download fully before passing to MP4Clip — streaming fetch can fail
    // with ERR_CONTENT_LENGTH_MISMATCH on large files or proxied responses
    videoArrayBuffer = await response.arrayBuffer()
    const stream = new Blob([videoArrayBuffer], { type: contentType || 'video/mp4' }).stream()

    mp4Clip = new MP4Clip(stream)
    await mp4Clip.ready

    const { width, height, duration } = mp4Clip.meta
    durationUs.value = duration
    trimInUs.value = 0
    trimOutUs.value = duration

    avCanvas = new AVCanvas(containerEl.value, {
      bgColor: '#000',
      width: width || 1280,
      height: height || 720,
    })

    videoSprite = new VisibleSprite(mp4Clip)
    videoSprite.time.offset = 0
    videoSprite.time.duration = duration

    await avCanvas.addSprite(videoSprite)

    // Show first frame
    await avCanvas.previewFrame(0)

    const offTime = avCanvas.on('timeupdate', (time: number) => {
      currentTimeUs.value = time
    })

    const offPaused = avCanvas.on('paused', () => {
      isPlaying.value = false
      // Sync time when paused at end
      if (currentTimeUs.value >= trimOutUs.value) {
        currentTimeUs.value = trimOutUs.value
      }
    })

    const offPlaying = avCanvas.on('playing', () => {
      isPlaying.value = true
    })

    unsubscribers.push(offTime, offPaused, offPlaying)
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    loadError.value = err?.message || 'Failed to load video'
    console.error('[MediaVideoEditor] init error:', err)
  } finally {
    isLoading.value = false
  }
}

function play() {
  if (!avCanvas || durationUs.value === 0) return
  const start = currentTimeUs.value >= trimOutUs.value ? trimInUs.value : currentTimeUs.value
  avCanvas.play({ start, end: trimOutUs.value })
}

function pause() {
  avCanvas?.pause()
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
  avCanvas?.previewFrame(trimInUs.value)
}

async function onSeek(timeUs: number) {
  const wasPlaying = isPlaying.value
  if (wasPlaying) pause()

  currentTimeUs.value = timeUs
  await avCanvas?.previewFrame(timeUs)

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
  videoCodec: string
  bitrate: number
  audio: boolean
  audioCodec?: string
}

async function exportTrimmed(options: ExportOptions): Promise<Blob> {
  if (!videoArrayBuffer) throw new Error('No video loaded')

  const { MP4Clip, OffscreenSprite, Combinator } = await import('@webav/av-cliper')

  const trimDurationUs = trimOutUs.value - trimInUs.value

  // Create a fresh clip from the stored buffer for export
  const exportStream = new Blob([videoArrayBuffer], { type: 'video/mp4' }).stream()
  const exportClip = new MP4Clip(exportStream)
  await exportClip.ready

  const hasAudioTrack = !!exportClip.meta?.audioSampleRate

  // Split at trim-in point; use the second part (after trim-in)
  const [, afterIn] = await exportClip.split(trimInUs.value)
  const clipToExport = trimInUs.value > 0 ? afterIn : exportClip

  const sprite = new OffscreenSprite(clipToExport)
  sprite.time.offset = 0
  sprite.time.duration = trimDurationUs

  const { width, height } = exportClip.meta

  const combinator = new Combinator({
    width: width || 1280,
    height: height || 720,
    bgColor: '#000',
    videoCodec: options.videoCodec,
    bitrate: options.bitrate,
    audio: options.audio && hasAudioTrack ? undefined : false,
  })

  await combinator.addSprite(sprite)

  const chunks: ArrayBuffer[] = []
  const reader = combinator.output().getReader()

  let done = false
  while (!done) {
    const result = await reader.read()
    done = result.done
    if (result.value) {
      chunks.push(result.value.buffer as ArrayBuffer)
    }
  }

  return new Blob(chunks, { type: 'video/mp4' })
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  unsubscribers.forEach((fn) => fn())
  unsubscribers = []
  avCanvas?.destroy()
  avCanvas = null
  mp4Clip = null
  videoSprite = null
  videoArrayBuffer = null
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
        :export-fn="exportTrimmed"
      />
    </div>
  </div>
</template>
