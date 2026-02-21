<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useVideoEditorStore } from '~/stores/videoEditor'
import type { TimelineTrack } from '~/timeline/types'

const { t } = useI18n()
const toast = useToast()
const videoEditorStore = useVideoEditorStore()

const videoTrack = computed(() => (videoEditorStore.timelineDoc?.tracks as TimelineTrack[] | undefined)?.find((track: TimelineTrack) => track.kind === 'video') ?? null)
const audioTrack = computed(() => (videoEditorStore.timelineDoc?.tracks as TimelineTrack[] | undefined)?.find((track: TimelineTrack) => track.kind === 'audio') ?? null)

const videoItems = computed(() => videoTrack.value?.items ?? [])
const audioItems = computed(() => audioTrack.value?.items ?? [])

const PX_PER_SECOND = 10

const scrollEl = ref<HTMLElement | null>(null)
const isDraggingPlayhead = ref(false)
const draggingItemId = ref<string | null>(null)
const draggingTrackId = ref<string | null>(null)
const draggingMode = ref<'move' | 'trim_start' | 'trim_end' | null>(null)
const dragAnchorClientX = ref(0)
const dragAnchorStartUs = ref(0)
const dragAnchorDurationUs = ref(0)
const hasPendingTimelinePersist = ref(false)

function timeUsToPx(timeUs: number) {
  return (timeUs / 1e6) * PX_PER_SECOND
}

function pxToTimeUs(px: number) {
  return Math.max(0, Math.round((px / PX_PER_SECOND) * 1e6))
}

function pxToDeltaUs(px: number) {
  return Math.round((px / PX_PER_SECOND) * 1e6)
}

function getLocalX(e: MouseEvent): number {
  const target = e.currentTarget as HTMLElement | null
  const rect = target?.getBoundingClientRect()
  const scrollX = scrollEl.value?.scrollLeft ?? 0
  if (!rect) return 0
  return e.clientX - rect.left + scrollX
}

function seekByMouseEvent(e: MouseEvent) {
  const x = getLocalX(e)
  videoEditorStore.currentTime = pxToTimeUs(x)
}

function onTimeRulerMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  seekByMouseEvent(e)
  startPlayheadDrag(e)
}

function startPlayheadDrag(e: MouseEvent) {
  if (e.button !== 0) return
  isDraggingPlayhead.value = true
  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

function startMoveItem(e: MouseEvent, trackId: string, itemId: string, startUs: number) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()

  draggingMode.value = 'move'
  draggingTrackId.value = trackId
  draggingItemId.value = itemId
  dragAnchorClientX.value = e.clientX
  dragAnchorStartUs.value = startUs

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

function startTrimItem(
  e: MouseEvent,
  input: { trackId: string; itemId: string; edge: 'start' | 'end'; startUs: number; durationUs: number },
) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()

  draggingMode.value = input.edge === 'start' ? 'trim_start' : 'trim_end'
  draggingTrackId.value = input.trackId
  draggingItemId.value = input.itemId
  dragAnchorClientX.value = e.clientX
  dragAnchorStartUs.value = input.startUs
  dragAnchorDurationUs.value = input.durationUs

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

function onGlobalMouseMove(e: MouseEvent) {
  if (isDraggingPlayhead.value) {
    const scrollerRect = scrollEl.value?.getBoundingClientRect()
    if (!scrollerRect) return
    const scrollX = scrollEl.value?.scrollLeft ?? 0
    const x = e.clientX - scrollerRect.left + scrollX
    videoEditorStore.currentTime = pxToTimeUs(x)
    return
  }

  const mode = draggingMode.value
  const trackId = draggingTrackId.value
  const itemId = draggingItemId.value
  if (!mode || !trackId || !itemId) return

  const dxPx = e.clientX - dragAnchorClientX.value
  const deltaUs = pxToDeltaUs(dxPx)

  if (mode === 'move') {
    const startUs = Math.max(0, dragAnchorStartUs.value + deltaUs)
    try {
      videoEditorStore.applyTimeline({ type: 'move_item', trackId, itemId, startUs }, { saveMode: 'none' })
      hasPendingTimelinePersist.value = true
    } catch {
    }
    return
  }

  if (mode === 'trim_start') {
    const maxDeltaUs = Math.max(0, dragAnchorDurationUs.value)
    const trimmedDeltaUs = Math.min(maxDeltaUs, Math.max(0, deltaUs))
    try {
      videoEditorStore.applyTimeline(
        { type: 'trim_item', trackId, itemId, edge: 'start', deltaUs: trimmedDeltaUs },
        { saveMode: 'none' },
      )
      hasPendingTimelinePersist.value = true
    } catch {
    }
    return
  }

  if (mode === 'trim_end') {
    const maxDeltaUs = Math.max(0, dragAnchorDurationUs.value)
    const trimmedDeltaUs = Math.min(maxDeltaUs, Math.max(0, deltaUs))
    try {
      videoEditorStore.applyTimeline(
        { type: 'trim_item', trackId, itemId, edge: 'end', deltaUs: trimmedDeltaUs },
        { saveMode: 'none' },
      )
      hasPendingTimelinePersist.value = true
    } catch {
    }
  }
}

function onGlobalMouseUp() {
  if (hasPendingTimelinePersist.value) {
    void videoEditorStore.requestTimelineSave({ immediate: true })
    hasPendingTimelinePersist.value = false
  }

  isDraggingPlayhead.value = false
  draggingMode.value = null
  draggingItemId.value = null
  draggingTrackId.value = null

  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
})

async function onDrop(e: DragEvent, track: 'video' | 'audio') {
  const data = e.dataTransfer?.getData('application/json')
  if (data) {
    try {
      const parsed = JSON.parse(data)
      if (parsed.name && parsed.path) {
        await videoEditorStore.addClipToTimelineFromPath({
          trackKind: track,
          name: parsed.name,
          path: parsed.path,
        })
        
        toast.add({
          title: t('granVideoEditor.timeline.clipAdded', 'Clip Added'),
          description: `${parsed.name} added to track`,
          icon: 'i-heroicons-check-circle',
          color: 'success'
        })
      }
    } catch (err) {
      console.error('Failed to parse dropped data', err)
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function togglePlay() {
  videoEditorStore.isPlaying = !videoEditorStore.isPlaying
}

function stop() {
  videoEditorStore.isPlaying = false
  videoEditorStore.currentTime = 0
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900 border-t border-gray-700">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-backward"
        :aria-label="t('granVideoEditor.timeline.rewind', 'Rewind to start')"
        @click="stop"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="videoEditorStore.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
        :aria-label="videoEditorStore.isPlaying ? t('granVideoEditor.timeline.pause', 'Pause') : t('granVideoEditor.timeline.play', 'Play')"
        @click="togglePlay"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-stop"
        :aria-label="t('granVideoEditor.timeline.stop', 'Stop')"
        @click="stop"
      />

      <span class="text-xs font-mono text-gray-400 ml-2">
        {{ formatTime(videoEditorStore.currentTime / 1e6) }} / {{ formatTime(videoEditorStore.duration / 1e6) }}
      </span>

      <div class="ml-auto flex items-center gap-1 text-xs text-gray-500">
        <UIcon name="i-heroicons-magnifying-glass-minus" class="w-3.5 h-3.5" />
        <input
          type="range"
          min="10"
          max="200"
          value="100"
          class="w-20 accent-primary-500"
          :aria-label="t('granVideoEditor.timeline.zoom', 'Zoom')"
        />
        <UIcon name="i-heroicons-magnifying-glass-plus" class="w-3.5 h-3.5" />
      </div>
    </div>

    <!-- Timeline area -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Track labels -->
      <div class="w-28 shrink-0 border-r border-gray-700 flex flex-col">
        <div class="h-6 border-b border-gray-700 bg-gray-850" />
        <div class="flex flex-col divide-y divide-gray-700 flex-1">
          <div class="flex items-center px-2 h-10 text-xs text-gray-500 font-medium">
            {{ t('granVideoEditor.timeline.videoTrack', 'Video 1') }}
          </div>
          <div class="flex items-center px-2 h-10 text-xs text-gray-500 font-medium">
            {{ t('granVideoEditor.timeline.audioTrack', 'Audio 1') }}
          </div>
        </div>
      </div>

      <!-- Scrollable track area -->
      <div ref="scrollEl" class="flex-1 overflow-x-auto overflow-y-hidden relative">
        <!-- Time ruler -->
        <div
          class="h-6 border-b border-gray-700 bg-gray-850 sticky top-0 flex items-end px-2 gap-16 text-xxs text-gray-600 font-mono select-none cursor-pointer"
          @mousedown="onTimeRulerMouseDown"
        >
          <span v-for="n in 10" :key="n">{{ formatTime((n - 1) * 10) }}</span>
        </div>

        <!-- Tracks -->
        <div class="flex flex-col divide-y divide-gray-700">
          <!-- Video track -->
          <div 
            class="h-10 flex items-center px-2 relative"
            @dragover.prevent
            @drop.prevent="onDrop($event, 'video')"
          >
            <div class="absolute inset-y-1 left-2 right-2 rounded bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center">
              <span class="text-xs text-gray-700" v-if="videoItems.length === 0">
                {{ t('granVideoEditor.timeline.dropClip', 'Drop clip here') }}
              </span>
            </div>
            <!-- Render items -->
            <div 
              v-for="item in videoItems" 
              :key="item.id"
              class="absolute inset-y-1 bg-indigo-600 border border-indigo-400 rounded px-2 flex items-center text-xs text-white z-10 cursor-pointer hover:bg-indigo-500"
              :style="{ left: `${2 + timeUsToPx(item.timelineRange.startUs)}px`, width: `${Math.max(30, timeUsToPx(item.timelineRange.durationUs))}px` }"
              @mousedown="startMoveItem($event, item.trackId, item.id, item.timelineRange.startUs)"
            >
              <div
                v-if="item.kind === 'clip'"
                class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/50"
                @mousedown="startTrimItem($event, { trackId: item.trackId, itemId: item.id, edge: 'start', startUs: item.timelineRange.startUs, durationUs: item.timelineRange.durationUs })"
              />
              <span class="truncate" :title="item.kind === 'clip' ? item.name : 'gap'">{{ item.kind === 'clip' ? item.name : 'gap' }}</span>
              <div
                v-if="item.kind === 'clip'"
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/50"
                @mousedown="startTrimItem($event, { trackId: item.trackId, itemId: item.id, edge: 'end', startUs: item.timelineRange.startUs, durationUs: item.timelineRange.durationUs })"
              />
            </div>
          </div>
          <!-- Audio track -->
          <div 
            class="h-10 flex items-center px-2 relative"
            @dragover.prevent
            @drop.prevent="onDrop($event, 'audio')"
          >
            <div class="absolute inset-y-1 left-2 right-2 rounded bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center">
              <span class="text-xs text-gray-700" v-if="audioItems.length === 0">
                {{ t('granVideoEditor.timeline.dropClip', 'Drop clip here') }}
              </span>
            </div>
            <!-- Render items -->
            <div 
              v-for="item in audioItems" 
              :key="item.id"
              class="absolute inset-y-1 bg-teal-600 border border-teal-400 rounded px-2 flex items-center text-xs text-white z-10 cursor-pointer hover:bg-teal-500"
              :style="{ left: `${2 + timeUsToPx(item.timelineRange.startUs)}px`, width: `${Math.max(30, timeUsToPx(item.timelineRange.durationUs))}px` }"
              @mousedown="startMoveItem($event, item.trackId, item.id, item.timelineRange.startUs)"
            >
              <div
                v-if="item.kind === 'clip'"
                class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/50"
                @mousedown="startTrimItem($event, { trackId: item.trackId, itemId: item.id, edge: 'start', startUs: item.timelineRange.startUs, durationUs: item.timelineRange.durationUs })"
              />
              <span class="truncate" :title="item.kind === 'clip' ? item.name : 'gap'">{{ item.kind === 'clip' ? item.name : 'gap' }}</span>
              <div
                v-if="item.kind === 'clip'"
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/50"
                @mousedown="startTrimItem($event, { trackId: item.trackId, itemId: item.id, edge: 'end', startUs: item.timelineRange.startUs, durationUs: item.timelineRange.durationUs })"
              />
            </div>
          </div>
        </div>

        <!-- Playhead -->
        <div
          class="absolute top-0 bottom-0 w-px bg-primary-500 cursor-ew-resize"
          :style="{ left: `${timeUsToPx(videoEditorStore.currentTime)}px` }"
          @mousedown="startPlayheadDrag"
        >
          <div class="w-2.5 h-2.5 bg-primary-500 rounded-full -translate-x-1/2 mt-0.5" />
        </div>
      </div>
    </div>
  </div>
</template>
