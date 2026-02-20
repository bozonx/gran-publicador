<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  duration: number
  currentTime: number
  trimIn: number
  trimOut: number
  disabled?: boolean
}

interface Emits {
  (e: 'update:trimIn', value: number): void
  (e: 'update:trimOut', value: number): void
  (e: 'seek', value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const trackEl = ref<HTMLDivElement | null>(null)

type DragTarget = 'in' | 'out' | 'playhead' | null
const dragging = ref<DragTarget>(null)

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function toPercent(timeUs: number): string {
  if (props.duration === 0) return '0%'
  return `${clamp((timeUs / props.duration) * 100, 0, 100)}%`
}

function getTimeFromEvent(event: MouseEvent | TouchEvent): number {
  if (!trackEl.value || props.duration === 0) return 0
  const rect = trackEl.value.getBoundingClientRect()
  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
  return Math.round(ratio * props.duration)
}

function onTrackPointerDown(event: MouseEvent | TouchEvent) {
  if (props.disabled) return
  const time = getTimeFromEvent(event)
  emit('seek', time)
  dragging.value = 'playhead'
  attachListeners()
}

function onHandlePointerDown(target: 'in' | 'out', event: MouseEvent | TouchEvent) {
  if (props.disabled) return
  event.stopPropagation()
  dragging.value = target
  attachListeners()
}

function onPointerMove(event: MouseEvent | TouchEvent) {
  if (!dragging.value) return
  const time = getTimeFromEvent(event)

  if (dragging.value === 'in') {
    const newIn = clamp(time, 0, props.trimOut - 1e6)
    emit('update:trimIn', newIn)
    emit('seek', newIn)
  } else if (dragging.value === 'out') {
    const newOut = clamp(time, props.trimIn + 1e6, props.duration)
    emit('update:trimOut', newOut)
    emit('seek', newOut)
  } else if (dragging.value === 'playhead') {
    emit('seek', clamp(time, props.trimIn, props.trimOut))
  }
}

function onPointerUp() {
  dragging.value = null
  removeListeners()
}

function attachListeners() {
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('touchend', onPointerUp)
}

function removeListeners() {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
}

onBeforeUnmount(() => removeListeners())

function formatTime(us: number): string {
  const sec = us / 1e6
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
}

const trimDurationSec = computed(() => {
  const sec = (props.trimOut - props.trimIn) / 1e6
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <div class="flex flex-col gap-1.5 select-none">
    <!-- Time labels row -->
    <div class="flex items-center justify-between px-1">
      <span class="text-xs text-blue-400 tabular-nums font-mono">{{ formatTime(trimIn) }}</span>
      <span class="text-xs text-gray-500 tabular-nums font-mono">{{ trimDurationSec }}</span>
      <span class="text-xs text-blue-400 tabular-nums font-mono">{{ formatTime(trimOut) }}</span>
    </div>

    <!-- Track -->
    <div
      ref="trackEl"
      class="relative h-10 rounded-md overflow-visible cursor-pointer"
      :class="disabled ? 'opacity-40 pointer-events-none' : ''"
      @mousedown="onTrackPointerDown"
      @touchstart.prevent="onTrackPointerDown"
    >
      <!-- Full track background -->
      <div class="absolute inset-0 bg-gray-800 rounded-md" />

      <!-- Dimmed region before trim-in -->
      <div
        class="absolute top-0 bottom-0 left-0 bg-gray-900/70 rounded-l-md"
        :style="{ width: toPercent(trimIn) }"
      />

      <!-- Active trim region -->
      <div
        class="absolute top-0 bottom-0 bg-blue-600/30 border-t-2 border-b-2 border-blue-500"
        :style="{ left: toPercent(trimIn), width: `calc(${toPercent(trimOut)} - ${toPercent(trimIn)})` }"
      />

      <!-- Dimmed region after trim-out -->
      <div
        class="absolute top-0 bottom-0 right-0 bg-gray-900/70 rounded-r-md"
        :style="{ left: toPercent(trimOut) }"
      />

      <!-- Trim-in handle -->
      <div
        class="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 group"
        :style="{ left: toPercent(trimIn) }"
        @mousedown.stop="onHandlePointerDown('in', $event)"
        @touchstart.prevent.stop="onHandlePointerDown('in', $event)"
      >
        <div
          class="w-2.5 h-full rounded-l bg-blue-500 group-hover:bg-blue-400 transition-colors flex items-center justify-center"
          :class="dragging === 'in' ? 'bg-blue-300' : ''"
        >
          <div class="w-0.5 h-4 bg-white/60 rounded-full" />
        </div>
      </div>

      <!-- Trim-out handle -->
      <div
        class="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 group"
        :style="{ left: toPercent(trimOut) }"
        @mousedown.stop="onHandlePointerDown('out', $event)"
        @touchstart.prevent.stop="onHandlePointerDown('out', $event)"
      >
        <div
          class="w-2.5 h-full rounded-r bg-blue-500 group-hover:bg-blue-400 transition-colors flex items-center justify-center"
          :class="dragging === 'out' ? 'bg-blue-300' : ''"
        >
          <div class="w-0.5 h-4 bg-white/60 rounded-full" />
        </div>
      </div>

      <!-- Playhead -->
      <div
        class="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white z-30 pointer-events-none"
        :style="{ left: toPercent(currentTime) }"
      >
        <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full" />
      </div>
    </div>
  </div>
</template>
