<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref, computed, watch } from 'vue'
import { INFINITE_SCROLL_AUTO_LIMIT } from '~/constants'

interface Props {
  isLoading?: boolean
  hasMore?: boolean
  autoLimit?: number
  itemCount?: number
  showEndMessage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  hasMore: false,
  autoLimit: INFINITE_SCROLL_AUTO_LIMIT,
  itemCount: 0,
  showEndMessage: true,
})

const emit = defineEmits<{
  (e: 'loadMore'): void
}>()

const sentinelRef = ref<HTMLElement | null>(null)
const autoLoadCount = ref(0)
const hasSeenSentinel = ref(false)

// Show "Load More" button if we reached the auto limit
const showLoadMoreButton = computed(() => {
  return props.hasMore && autoLoadCount.value >= props.autoLimit
})

const showEndMessage = computed(() => {
  if (!props.showEndMessage) return false
  if (props.isLoading) return false
  if (props.hasMore) return false
  if ((props.itemCount ?? 0) <= 0) return false
  return hasSeenSentinel.value
})

// Function to trigger load more
const handleLoadMore = () => {
  if (props.isLoading || !props.hasMore) return
  emit('loadMore')
}

// Manual load more (resets auto count)
const manualLoadMore = () => {
  autoLoadCount.value = 0
  hasSeenSentinel.value = true
  handleLoadMore()
}

// Use Intersection Observer as a more robust way to detect when we need more data
// It works correctly regardless of whether the window or a parent div is scrolling.
useIntersectionObserver(
  sentinelRef,
  (entries: IntersectionObserverEntry[]) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting) {
      hasSeenSentinel.value = true
    }
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
    hasSeenSentinel.value = false
  }
})

watch(
  () => props.itemCount,
  (newCount, oldCount) => {
    if ((newCount ?? 0) <= 0) {
      hasSeenSentinel.value = false
      autoLoadCount.value = 0
      return
    }

    if ((oldCount ?? 0) > 0 && (newCount ?? 0) < (oldCount ?? 0)) {
      hasSeenSentinel.value = false
      autoLoadCount.value = 0
    }
  },
)
</script>

<template>
  <div class="flex flex-col">
    <slot />

    <!-- Sentinel element to detect end of list -->
    <div
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

    <div
      v-else-if="showEndMessage"
      class="flex justify-center py-6 text-sm text-gray-400 dark:text-gray-500"
    >
      {{ $t('common.endOfList') }}
    </div>
  </div>
</template>
