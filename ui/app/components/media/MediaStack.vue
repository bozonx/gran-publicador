<script setup lang="ts">
interface MediaItem {
  id: string
  type: string
  storageType: string
  storagePath: string
  filename?: string
  mimeType?: string
  sizeBytes?: number
}

interface Props {
  media: Array<{
    media?: MediaItem
    order: number
  }>
  clickable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'click', media: MediaItem): void
}>()

const firstMedia = computed(() => props.media[0]?.media)
const mediaCount = computed(() => props.media.length)

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  }
  return sizes[props.size]
})

const stackOffsets = computed(() => {
  // Generate stack offsets based on media count (max 3 visible layers)
  const count = Math.min(mediaCount.value - 1, 3)
  return Array.from({ length: count }, (_, i) => ({
    right: `${(i + 1) * 4}px`,
    top: `${(i + 1) * 4}px`,
    zIndex: count - i,
  }))
})

function handleClick() {
  if (props.clickable && firstMedia.value) {
    emit('click', firstMedia.value)
  }
}
</script>

<template>
  <div :class="['relative', sizeClasses]">
    <!-- Stack layers (visual only, no actual images) -->
    <div
      v-for="(offset, index) in stackOffsets"
      :key="`stack-${index}`"
      :class="[
        'absolute inset-0 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800',
      ]"
      :style="{
        transform: `translate(${offset.right}, ${offset.top})`,
        zIndex: offset.zIndex,
      }"
    />

    <!-- Main media card -->
    <div class="relative" style="z-index: 10">
      <MediaCard
        v-if="firstMedia"
        :media="firstMedia"
        :clickable="clickable"
        :size="size"
        @click="handleClick"
      >
        <template #actions>
          <slot name="actions" />
        </template>
      </MediaCard>

      <!-- Count badge -->
      <div
        v-if="mediaCount > 1"
        class="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full"
      >
        +{{ mediaCount - 1 }}
      </div>
    </div>
  </div>
</template>
