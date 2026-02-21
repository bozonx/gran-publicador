<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useVideoEditorStore } from '~/stores/videoEditor'
import { useWebAV } from '~/composables/useWebAV'

const { t } = useI18n()
const videoEditorStore = useVideoEditorStore()
const webAV = useWebAV()

const containerEl = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(false)

async function buildTimeline() {
  if (!containerEl.value) return
  isLoading.value = true
  loadError.value = null

  try {
    const { MP4Clip, VisibleSprite } = await import('@webav/av-cliper')

    // Always re-init canvas to clear previous sprites
    await webAV.initCanvas(containerEl.value, 1280, 720, '#000')

    const clips = videoEditorStore.timelineClips
    if (clips.length === 0) {
      isLoading.value = false
      return
    }

    let maxDuration = 0

    // Load each video clip (audio later if needed/supported)
    for (const clip of clips) {
      if (clip.track === 'video' && clip.fileHandle) {
        const file = await clip.fileHandle.getFile()
        // Provide stream directly. MP4Clip accepts a ReadableStream
        const rawClipObj = new MP4Clip(file.stream() as any)
        const clipObj = markRaw(rawClipObj)
        await clipObj.ready

        const rawSprite = new VisibleSprite(clipObj)
        const sprite = markRaw(rawSprite)
        // Set basic positioning. Later we can read trimIn, trimOut and timeline offset.
        // For now: stack them at t=0
        sprite.time.offset = 0
        sprite.time.duration = clipObj.meta.duration
        
        await webAV.avCanvas.value.addSprite(sprite)
        
        if (clipObj.meta.duration > maxDuration) {
          maxDuration = clipObj.meta.duration
        }
      }
    }

    videoEditorStore.duration = maxDuration

    // Show first frame
    await webAV.avCanvas.value.previewFrame(0)

  } catch (e: any) {
    console.error('Failed to build timeline components', e)
    loadError.value = e.message || 'Error loading timeline'
  } finally {
    isLoading.value = false
  }
}

// Watch global store timelineClips changes and rebuild timeline
watch(() => videoEditorStore.timelineClips, () => {
  buildTimeline()
}, { deep: true })

// Sync playback controls from store
watch(() => videoEditorStore.isPlaying, (playing) => {
  if (playing) {
    webAV.play()
  } else {
    webAV.pause()
  }
})

// Sync time to store
watch(() => webAV.currentTimeUs.value, (val) => {
  videoEditorStore.currentTime = val
})

// Monitor seeks when the user scrubs the timeline (placeholder if timeline emitted seek)
watch(() => videoEditorStore.currentTime, (val) => {
  if (Math.abs(val - webAV.currentTimeUs.value) > 100000) { // 100ms
    webAV.seek(val)
  }
})

onMounted(() => {
  buildTimeline()
})

onBeforeUnmount(() => {
  webAV.destroyCanvas()
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
    <div class="flex-1 flex items-center justify-center overflow-hidden relative">
      <div v-if="videoEditorStore.timelineClips.length === 0" class="flex flex-col items-center gap-3 text-gray-700">
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
        ref="containerEl"
        class="w-full h-full"
        :class="{ invisible: isLoading || loadError || videoEditorStore.timelineClips.length === 0 }"
      />
    </div>

    <!-- Playback controls -->
    <div class="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-700 shrink-0">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-backward"
        :aria-label="t('granVideoEditor.monitor.rewind', 'Rewind')"
        :disabled="videoEditorStore.timelineClips.length === 0 || isLoading"
        @click="videoEditorStore.currentTime = 0"
      />
      <UButton
        size="sm"
        variant="solid"
        color="primary"
        :icon="videoEditorStore.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
        :aria-label="t('granVideoEditor.monitor.play', 'Play')"
        :disabled="videoEditorStore.timelineClips.length === 0 || isLoading"
        @click="videoEditorStore.isPlaying = !videoEditorStore.isPlaying"
      />
      <span class="text-xs text-gray-600 ml-2 font-mono">
        {{ formatTime(videoEditorStore.currentTime / 1e6) }} / {{ formatTime(videoEditorStore.duration / 1e6) }}
      </span>
    </div>
  </div>
</template>
