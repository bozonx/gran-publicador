<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useVideoEditorStore } from '~/stores/videoEditor'
import { useMediabunny } from '~/composables/useMediabunny'
import type { TimelineTrack, TimelineTrackItem } from '~/timeline/types'

const { t } = useI18n()
const videoEditorStore = useVideoEditorStore()
const mediaBunny = useMediabunny()

const videoTrack = computed(() => (videoEditorStore.timelineDoc?.tracks as TimelineTrack[] | undefined)?.find((track: TimelineTrack) => track.kind === 'video') ?? null)
const videoItems = computed(() => (videoTrack.value?.items ?? []).filter((it: TimelineTrackItem) => it.kind === 'clip'))

const containerEl = ref<HTMLDivElement | null>(null)
const viewportEl = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(false)

const MIN_CANVAS_DIMENSION = 16
const MAX_CANVAS_DIMENSION = 7680

const exportWidth = computed(() => {
  const value = Number(videoEditorStore.projectSettings.export.width)
  if (!Number.isFinite(value) || value <= 0) return 1920
  return Math.round(Math.min(MAX_CANVAS_DIMENSION, Math.max(MIN_CANVAS_DIMENSION, value)))
})

const exportHeight = computed(() => {
  const value = Number(videoEditorStore.projectSettings.export.height)
  if (!Number.isFinite(value) || value <= 0) return 1080
  return Math.round(Math.min(MAX_CANVAS_DIMENSION, Math.max(MIN_CANVAS_DIMENSION, value)))
})

const aspectRatio = computed(() => {
  const width = exportWidth.value
  const height = exportHeight.value
  if (width <= 0 || height <= 0) return 16 / 9
  return width / height
})

const canvasDisplaySize = ref({ width: 0, height: 0 })

const canvasScale = computed(() => {
  const dw = canvasDisplaySize.value.width
  const dh = canvasDisplaySize.value.height
  if (!dw || !dh || !exportWidth.value || !exportHeight.value) return 1
  return Math.min(dw / exportWidth.value, dh / exportHeight.value)
})

function getCanvasWrapperStyle() {
  return {
    width: `${canvasDisplaySize.value.width}px`,
    height: `${canvasDisplaySize.value.height}px`,
    overflow: 'hidden',
  }
}

function getCanvasInnerStyle() {
  return {
    width: `${exportWidth.value}px`,
    height: `${exportHeight.value}px`,
    transform: `scale(${canvasScale.value})`,
    transformOrigin: 'top left',
  }
}

let viewportResizeObserver: ResizeObserver | null = null
let buildRequestId = 0

function updateCanvasDisplaySize() {
  const viewport = viewportEl.value
  if (!viewport) return

  const availableWidth = viewport.clientWidth
  const availableHeight = viewport.clientHeight

  if (availableWidth <= 0 || availableHeight <= 0) {
    canvasDisplaySize.value = { width: 0, height: 0 }
    return
  }

  let width = availableWidth
  let height = Math.round(width / aspectRatio.value)

  if (height > availableHeight) {
    height = availableHeight
    width = Math.round(height * aspectRatio.value)
  }

  canvasDisplaySize.value = { width, height }
}


async function buildTimeline() {
  if (!containerEl.value) return
  const requestId = ++buildRequestId
  isLoading.value = true
  loadError.value = null

  try {
    const clips = videoItems.value
    console.log('[Monitor] Timeline clips count:', clips.length)
    if (clips.length === 0) {
      isLoading.value = false
      return
    }

    await mediaBunny.initCanvas(containerEl.value, exportWidth.value, exportHeight.value, '#000')
    console.log('[Monitor] PixiJS+Mediabunny initialized canvas', exportWidth.value, exportHeight.value)

    let maxDuration = 0

    // Load each video clip based on timelineRange.startUs
    for (const clip of clips) {
      if (requestId !== buildRequestId) return
      const fileHandle = await videoEditorStore.getFileHandleByPath(clip.source.path)
      if (fileHandle) {
        console.log('[Monitor] Processing clip:', clip.name)
        const file = await fileHandle.getFile()
        console.log('[Monitor] Got file:', file.name, 'size:', file.size)

        const startUs = clip.timelineRange.startUs
        
        const { Input, BlobSource, VideoSampleSink, ALL_FORMATS } = await import('mediabunny')
        
        const source = new BlobSource(file)
        const input = new Input({ source, formats: ALL_FORMATS } as any)
        const track = await input.getPrimaryVideoTrack()
        if (track && await track.canDecode()) {
          const sink = new VideoSampleSink(track)
          const durS = await track.computeDuration()
          const clipDurationUs = Math.floor(durS * 1_000_000)
          
          const canvas = new OffscreenCanvas(exportWidth.value, exportHeight.value)
          const ctx = canvas.getContext('2d')!
          const { Texture, Sprite, CanvasSource } = await import('pixi.js')
          const canvasSource = new CanvasSource({ resource: canvas as any })
          const texture = new Texture({ source: canvasSource })
          const sprite = new Sprite(texture)
          
          sprite.width = exportWidth.value
          sprite.height = exportHeight.value
          sprite.visible = false
          
          mediaBunny.app.value!.stage.addChild(sprite)
          
          mediaBunny.clips.value.push({
            fileHandle,
            input,
            sink,
            startUs,
            endUs: startUs + clipDurationUs,
            durationUs: clipDurationUs,
            sprite,
            canvas,
            ctx
          })
        }
      }
    }
    
    maxDuration = Math.max(0, ...mediaBunny.clips.value.map(c => c.endUs))
    mediaBunny.durationUs.value = maxDuration
    videoEditorStore.duration = maxDuration
    console.log('[Monitor] Timeline duration:', maxDuration)

    // Show first frame
    console.log('[Monitor] Previewing first frame...')
    await mediaBunny.seek(0)
    console.log('[Monitor] First frame previewed')

    videoEditorStore.currentTime = 0
    videoEditorStore.isPlaying = false

  } catch (e: any) {
    console.error('Failed to build timeline components', e)
    if (requestId === buildRequestId) {
      loadError.value = e.message || t('granVideoEditor.monitor.loadError', 'Error loading timeline')
    }
  } finally {
    if (requestId === buildRequestId) {
      isLoading.value = false
    }
  }
}

// Watch global store timelineClips changes and rebuild timeline
watch(() => videoEditorStore.timelineDoc, () => {
  buildTimeline()
}, { deep: true })

watch(
  () => [videoEditorStore.projectSettings.export.width, videoEditorStore.projectSettings.export.height],
  () => {
    updateCanvasDisplaySize()
    buildTimeline()
  },
)

// Sync playback controls from store
watch(() => videoEditorStore.isPlaying, (playing) => {
  if (isLoading.value || loadError.value) {
    if (playing) videoEditorStore.isPlaying = false
    return
  }

  if (playing) {
    const start = Math.max(0, videoEditorStore.currentTime)
    mediaBunny.play(start)
  } else {
    mediaBunny.pause()
  }
})

// Update playback loop timing
let playbackLoopId = 0
function updatePlayback() {
  if (videoEditorStore.isPlaying && mediaBunny.isPlaying.value) {
    videoEditorStore.currentTime = mediaBunny.currentTimeUs.value
    playbackLoopId = requestAnimationFrame(updatePlayback)
  } else if (!mediaBunny.isPlaying.value) {
    videoEditorStore.isPlaying = false
  }
}

watch(() => mediaBunny.isPlaying.value, (isPlaying) => {
  if (isPlaying) {
    playbackLoopId = requestAnimationFrame(updatePlayback)
  } else {
    cancelAnimationFrame(playbackLoopId)
  }
})

// Sync time to store (initial seek or external seek)
watch(() => videoEditorStore.currentTime, (val) => {
  if (!videoEditorStore.isPlaying && Math.abs(val - mediaBunny.currentTimeUs.value) > 100000) { // 100ms difference threshold
    mediaBunny.seek(val)
  }
})

onMounted(() => {
  updateCanvasDisplaySize()
  if (typeof ResizeObserver !== 'undefined' && viewportEl.value) {
    viewportResizeObserver = new ResizeObserver(() => {
      updateCanvasDisplaySize()
    })
    viewportResizeObserver.observe(viewportEl.value)
  }
  buildTimeline()
})

onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect()
  viewportResizeObserver = null
  mediaBunny.destroyCanvas()
})

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-950">
    <!-- Header -->
    <div class="flex items-center px-3 py-2 border-b border-gray-700 shrink-0">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {{ t('granVideoEditor.monitor.title', 'Monitor') }}
      </span>
    </div>

    <!-- Video area -->
    <div ref="viewportEl" class="flex-1 flex items-center justify-center overflow-hidden relative">
      <div v-if="videoItems.length === 0" class="flex flex-col items-center gap-3 text-gray-700">
        <UIcon name="i-heroicons-play-circle" class="w-16 h-16" />
        <p class="text-sm">
          {{ t('granVideoEditor.monitor.empty', 'No clip selected') }}
        </p>
      </div>
      <div v-else-if="isLoading" class="absolute inset-0 flex items-center justify-center text-gray-400">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin" />
      </div>
      <div v-else-if="loadError" class="absolute inset-0 flex items-center justify-center text-red-500">
        {{ loadError }}
      </div>
      
      <div
        class="shrink-0"
        :style="getCanvasWrapperStyle()"
        :class="{ invisible: loadError || videoItems.length === 0 }"
      >
        <div ref="containerEl" :style="getCanvasInnerStyle()" />
      </div>
    </div>

    <!-- Playback controls -->
    <div class="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-700 shrink-0">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-backward"
        :aria-label="t('granVideoEditor.monitor.rewind', 'Rewind')"
        :disabled="videoItems.length === 0 || isLoading"
        @click="videoEditorStore.currentTime = 0"
      />
      <UButton
        size="sm"
        variant="solid"
        color="primary"
        :icon="videoEditorStore.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
        :aria-label="t('granVideoEditor.monitor.play', 'Play')"
        :disabled="videoItems.length === 0 || isLoading"
        @click="videoEditorStore.isPlaying = !videoEditorStore.isPlaying"
      />
      <span class="text-xs text-gray-600 ml-2 font-mono">
        {{ formatTime(videoEditorStore.currentTime / 1e6) }} / {{ formatTime(videoEditorStore.duration / 1e6) }}
      </span>
    </div>
  </div>
</template>
