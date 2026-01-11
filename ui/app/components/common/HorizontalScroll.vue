<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const scrollContainer = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const startX = ref(0)
const scrollLeft = ref(0)
const hasMoved = ref(false)

const startDragging = (e: MouseEvent) => {
  if (!scrollContainer.value) return
  isDragging.value = true
  startX.value = e.pageX - scrollContainer.value.offsetLeft
  scrollLeft.value = scrollContainer.value.scrollLeft
  hasMoved.value = false
  
  // Add global listeners to handle drag when mouse leaves container
  window.addEventListener('mousemove', handleDragging)
  window.addEventListener('mouseup', stopDragging)
}

const stopDragging = () => {
  isDragging.value = false
  window.removeEventListener('mousemove', handleDragging)
  window.removeEventListener('mouseup', stopDragging)
}

const handleDragging = (e: MouseEvent) => {
  if (!isDragging.value || !scrollContainer.value) return
  e.preventDefault()
  
  const x = e.pageX - scrollContainer.value.offsetLeft
  const walk = (x - startX.value) * 1.5 // Multiplier for faster scroll
  
  if (Math.abs(walk) > 5) {
    hasMoved.value = true
  }
  
  scrollContainer.value.scrollLeft = scrollLeft.value - walk
}

// Prevent click if there was a drag movement
const handleClickCapture = (e: MouseEvent) => {
  if (hasMoved.value) {
    e.stopPropagation()
    e.preventDefault()
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', handleDragging)
  window.removeEventListener('mouseup', stopDragging)
})
</script>

<template>
  <div 
    ref="scrollContainer"
    class="horizontal-scroll-container overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing select-none"
    @mousedown="startDragging"
    @click.capture="handleClickCapture"
  >
    <div class="flex flex-nowrap gap-4 pb-4 px-1">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.horizontal-scroll-container {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
  -webkit-overflow-scrolling: touch;
}

.horizontal-scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
</style>
