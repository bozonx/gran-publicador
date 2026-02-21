<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useGranVideoEditorMediaStore } from '~/stores/granVideoEditor/media.store'
import { useGranVideoEditorProjectStore } from '~/stores/granVideoEditor/project.store'
import { useGranVideoEditorTimelineStore } from '~/stores/granVideoEditor/timeline.store'
import { VideoCompositor } from '~/utils/video-editor/VideoCompositor'
import type { TimelineTrack, TimelineTrackItem } from '~/timeline/types'

const { t } = useI18n()
const projectStore = useGranVideoEditorProjectStore()
const timelineStore = useGranVideoEditorTimelineStore()
const mediaStore = useGranVideoEditorMediaStore()

const videoTrack = computed(() => (timelineStore.timelineDoc?.tracks as TimelineTrack[] | undefined)?.find((track: TimelineTrack) => track.kind === 'video') ?? null)
const videoItems = computed(() => (videoTrack.value?.items ?? []).filter((it: TimelineTrackItem) => it.kind === 'clip'))

const containerEl = ref<HTMLDivElement | null>(null)
const viewportEl = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(false)

const MIN_CANVAS_DIMENSION = 16
const MAX_CANVAS_DIMENSION = 7680

const exportWidth = computed(() => {
  const value = Number(projectStore.projectSettings.export.width)
  if (!Number.isFinite(value) || value <= 0) return 1920
  return Math.round(Math.min(MAX_CANVAS_DIMENSION, Math.max(MIN_CANVAS_DIMENSION, value)))
})

const exportHeight = computed(() => {
  const value = Number(projectStore.projectSettings.export.height)
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

const compositor = new VideoCompositor()

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
      compositor.clearClips()
      isLoading.value = false
      return
    }

    await compositor.init(exportWidth.value, exportHeight.value, '#000', false)
    if (containerEl.value) {
      containerEl.value.innerHTML = ''
      if (compositor.app && compositor.app.canvas) {
        containerEl.value.appendChild(compositor.app.canvas as unknown as HTMLCanvasElement)
      }
    }

    console.log('[Monitor] VideoCompositor initialized canvas', exportWidth.value, exportHeight.value)

    const maxDuration = await compositor.loadTimeline(clips, async (path) => {
      return await projectStore.getFileHandleByPath(path)
    })

    timelineStore.duration = maxDuration
    console.log('[Monitor] Timeline duration:', maxDuration)

    // Show first frame
    console.log('[Monitor] Previewing first frame...')
    await compositor.renderFrame(0)
    console.log('[Monitor] First frame previewed')

    timelineStore.currentTime = 0
    timelineStore.isPlaying = false

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
watch(() => timelineStore.timelineDoc, () => {
  buildTimeline()
}, { deep: true })

watch(
  () => [projectStore.projectSettings.export.width, projectStore.projectSettings.export.height],
  () => {
    updateCanvasDisplaySize()
    buildTimeline()
  },
)

// Playback loop state
let playbackLoopId = 0
let lastFrameTimeMs = 0
let renderQueue: Promise<any> = Promise.resolve()

function updatePlayback(timestamp: number) {
  if (!timelineStore.isPlaying) return

  const deltaMs = timestamp - lastFrameTimeMs
  lastFrameTimeMs = timestamp

  let newTimeUs = timelineStore.currentTime + deltaMs * 1000
  if (newTimeUs >= timelineStore.duration) {
    newTimeUs = timelineStore.duration
    timelineStore.isPlaying = false
    timelineStore.currentTime = newTimeUs
    renderQueue = renderQueue.then(() => compositor.renderFrame(newTimeUs))
    return
  }

  timelineStore.currentTime = newTimeUs
  renderQueue = renderQueue.then(() => compositor.renderFrame(newTimeUs))

  if (timelineStore.isPlaying) {
    playbackLoopId = requestAnimationFrame(updatePlayback)
  }
}

watch(() => timelineStore.isPlaying, (playing) => {
  if (isLoading.value || loadError.value) {
    if (playing) timelineStore.isPlaying = false
    return
  }

  if (playing) {
    if (timelineStore.currentTime >= timelineStore.duration) {
      timelineStore.currentTime = 0
    }
    lastFrameTimeMs = performance.now()
    playbackLoopId = requestAnimationFrame(updatePlayback)
  } else {
    cancelAnimationFrame(playbackLoopId)
  }
})

// Sync time to store (initial seek or external seek)
watch(() => timelineStore.currentTime, (val) => {
  if (!timelineStore.isPlaying) {
    renderQueue = renderQueue.then(() => compositor.renderFrame(val))
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
  cancelAnimationFrame(playbackLoopId)
  compositor.destroy()
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
        @click="timelineStore.currentTime = 0"
      />
      <UButton
        size="sm"
        variant="solid"
        color="primary"
        :icon="timelineStore.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
        :aria-label="t('granVideoEditor.monitor.play', 'Play')"
        :disabled="videoItems.length === 0 || isLoading"
        @click="timelineStore.isPlaying = !timelineStore.isPlaying"
      />
      <span class="text-xs text-gray-600 ml-2 font-mono">
        {{ formatTime(timelineStore.currentTime / 1e6) }} / {{ formatTime(timelineStore.duration / 1e6) }}
      </span>
    </div>
  </div>
</template>
