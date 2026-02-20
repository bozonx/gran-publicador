<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface Props {
  src: string
  filename?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(true)
const isPlaying = ref(false)

// Time in microseconds (WebAV uses µs internally)
const currentTimeUs = ref(0)
const durationUs = ref(0)

// Formatted display values
const currentTimeSec = computed(() => currentTimeUs.value / 1e6)
const durationSec = computed(() => durationUs.value / 1e6)

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

let avCanvas: any = null
let videoSprite: any = null
let mp4Clip: any = null
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

    const response = await fetch(props.src)
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`)

    // Check content type — MP4Clip only supports H.264/H.265 in MP4 container
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('webm') || contentType.includes('ogg')) {
      throw new Error(
        `Unsupported format: ${contentType}. WebAV editor requires MP4 (H.264/H.265). VP9/WebM is not supported.`,
      )
    }

    // Download fully before passing to MP4Clip — streaming fetch can fail
    // with ERR_CONTENT_LENGTH_MISMATCH on large files or proxied responses
    const arrayBuffer = await response.arrayBuffer()
    const stream = new Blob([arrayBuffer], { type: 'video/mp4' }).stream()

    mp4Clip = new MP4Clip(stream)
    await mp4Clip.ready

    const { width, height, duration } = mp4Clip.meta
    durationUs.value = duration

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
      if (currentTimeUs.value >= durationUs.value) {
        currentTimeUs.value = durationUs.value
      }
    })

    const offPlaying = avCanvas.on('playing', () => {
      isPlaying.value = true
    })

    unsubscribers.push(offTime, offPaused, offPlaying)
  } catch (err: any) {
    loadError.value = err?.message || 'Failed to load video'
    console.error('[MediaVideoEditor] init error:', err)
  } finally {
    isLoading.value = false
  }
}

function play() {
  if (!avCanvas || durationUs.value === 0) return
  const start = currentTimeUs.value >= durationUs.value ? 0 : currentTimeUs.value
  avCanvas.play({ start, end: durationUs.value })
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
  currentTimeUs.value = 0
  avCanvas?.previewFrame(0)
}

async function onTimelineInput(event: Event) {
  const input = event.target as HTMLInputElement
  const sec = Number(input.value)
  const timeUs = Math.round(sec * 1e6)
  const wasPlaying = isPlaying.value

  if (wasPlaying) pause()

  currentTimeUs.value = timeUs
  await avCanvas?.previewFrame(timeUs)

  if (wasPlaying) play()
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
      <!-- Timeline scrubber -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400 tabular-nums w-10 text-right shrink-0">
          {{ formatTime(currentTimeSec) }}
        </span>

        <input
          type="range"
          class="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
          :min="0"
          :max="durationSec"
          :step="0.033"
          :value="currentTimeSec"
          :disabled="isLoading || !!loadError"
          @input="onTimelineInput"
        />

        <span class="text-xs text-gray-400 tabular-nums w-10 shrink-0">
          {{ formatTime(durationSec) }}
        </span>
      </div>

      <!-- Playback controls -->
      <div class="flex items-center justify-center gap-2">
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
    </div>
  </div>
</template>
