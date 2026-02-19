<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref, computed } from 'vue'
import { INFINITE_SCROLL_AUTO_LIMIT } from '~/constants'

interface Props {
  isLoading?: boolean
  hasMore?: boolean
  autoLimit?: number
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  hasMore: false,
  autoLimit: INFINITE_SCROLL_AUTO_LIMIT
})

const emit = defineEmits<{
  (e: 'loadMore'): void
}>()

const sentinelRef = ref<HTMLElement | null>(null)
const autoLoadCount = ref(0)

// Show "Load More" button if we reached the auto limit
const showLoadMoreButton = computed(() => {
  return props.hasMore && autoLoadCount.value >= props.autoLimit
})

// Function to trigger load more
const handleLoadMore = () => {
  if (props.isLoading || !props.hasMore) return
  emit('loadMore')
}

// Manual load more (resets auto count)
const manualLoadMore = () => {
  autoLoadCount.value = 0
  handleLoadMore()
}

// Use Intersection Observer as a more robust way to detect when we need more data
// It works correctly regardless of whether the window or a parent div is scrolling.
useIntersectionObserver(
  sentinelRef,
  (entries: IntersectionObserverEntry[]) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting && props.hasMore && !props.isLoading && !showLoadMoreButton.value) {
      autoLoadCount.value++
      handleLoadMore()
    }
  },
  {
    // Trigger slightly before it becomes visible to keep the scroll smooth
    rootMargin: '50px',
  }
)

defineExpose({
  resetAutoLimit: () => {
    autoLoadCount.value = 0
  }
})
</script>

<template>
  <div class="flex flex-col">
    <slot />

    <!-- Sentinel element to detect end of list -->
    <div 
      v-if="hasMore" 
      ref="sentinelRef" 
      class="h-px w-full invisible pointer-events-none" 
      aria-hidden="true"
    />

    <div v-if="hasMore" class="flex flex-col items-center py-8">
      <!-- "Load More" button when limit reached -->
      <UButton
        v-if="showLoadMoreButton"
        color="neutral"
        variant="outline"
        icon="i-heroicons-arrow-path"
        :loading="isLoading"
        @click="manualLoadMore"
      >
        {{ $t('common.loadMore') }}
      </UButton>

      <!-- Spinner during auto-loading -->
      <UiLoadingSpinner
        v-else-if="isLoading"
        size="md"
        color="primary"
      />
    </div>
  </div>
</template>
