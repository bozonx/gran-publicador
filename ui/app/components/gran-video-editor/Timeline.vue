<script setup lang="ts">
const { t } = useI18n()

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function stop() {
  isPlaying.value = false
  currentTime.value = 0
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
        :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
        :aria-label="isPlaying ? t('granVideoEditor.timeline.pause', 'Pause') : t('granVideoEditor.timeline.play', 'Play')"
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
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
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
          <div class="h-10 flex items-center px-2 relative">
            <div class="absolute inset-y-1 left-2 right-2 rounded bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center">
              <span class="text-xs text-gray-700">
                {{ t('granVideoEditor.timeline.dropClip', 'Drop clip here') }}
              </span>
            </div>
          </div>
          <!-- Audio track -->
          <div class="h-10 flex items-center px-2 relative">
            <div class="absolute inset-y-1 left-2 right-2 rounded bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center">
              <span class="text-xs text-gray-700">
                {{ t('granVideoEditor.timeline.dropClip', 'Drop clip here') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Playhead -->
        <div
          class="absolute top-0 bottom-0 w-px bg-primary-500 pointer-events-none"
          :style="{ left: `${currentTime * 10}px` }"
        >
          <div class="w-2.5 h-2.5 bg-primary-500 rounded-full -translate-x-1/2 mt-0.5" />
        </div>
      </div>
    </div>
  </div>
</template>
