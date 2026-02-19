<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core'
import { ref, computed, watch } from 'vue'
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

const containerRef = ref<HTMLElement | null>(null)
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

// Set up infinite scroll
useInfiniteScroll(
  containerRef,
  () => {
    if (!showLoadMoreButton.value) {
      autoLoadCount.value++
      handleLoadMore()
    }
  },
  { 
    distance: 200, 
    canLoadMore: () => props.hasMore && !props.isLoading && !showLoadMoreButton.value 
  }
)

// When hasMore or isLoading changes, we might need to reset or re-check
defineExpose({
  resetAutoLimit: () => {
    autoLoadCount.value = 0
  }
})
</script>

<template>
  <div ref="containerRef" class="space-y-4">
    <slot />

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
