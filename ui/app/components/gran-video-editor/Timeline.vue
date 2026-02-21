<script setup lang="ts">
import { computed } from 'vue'
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

function timeUsToPx(timeUs: number) {
  return (timeUs / 1e6) * PX_PER_SECOND
}

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
      <div class="flex-1 overflow-x-auto overflow-y-hidden relative">
        <!-- Time ruler -->
        <div class="h-6 border-b border-gray-700 bg-gray-850 sticky top-0 flex items-end px-2 gap-16 text-xxs text-gray-600 font-mono select-none">
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
            >
              <span class="truncate" :title="item.kind === 'clip' ? item.name : 'gap'">{{ item.kind === 'clip' ? item.name : 'gap' }}</span>
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
            >
              <span class="truncate" :title="item.kind === 'clip' ? item.name : 'gap'">{{ item.kind === 'clip' ? item.name : 'gap' }}</span>
            </div>
          </div>
        </div>

        <!-- Playhead -->
        <div
          class="absolute top-0 bottom-0 w-px bg-primary-500 pointer-events-none"
          :style="{ left: `${timeUsToPx(videoEditorStore.currentTime)}px` }"
        >
          <div class="w-2.5 h-2.5 bg-primary-500 rounded-full -translate-x-1/2 mt-0.5" />
        </div>
      </div>
    </div>
  </div>
</template>
