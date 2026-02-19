<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import UiLoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import CommonFoundCount from '~/components/common/CommonFoundCount.vue'
import ContentItemCard from './ContentItemCard.vue'

const props = defineProps<{
  items: any[]
  selectedIds: string[]
  isLoading: boolean
  hasMore: boolean
  total: number
  totalUnfiltered: number
  archiveStatus: 'active' | 'archived'
  q: string
  selectedTags: string
  error: string | null
  isUploadingFiles: boolean
  isArchivingId: string | null
  isRestoringId: string | null
  hideActions?: boolean
  disableSelection?: boolean
  activeCollectionId?: string | null
  activeCollectionType?: string | null
}>()  

const emit = defineEmits<{
  'select-all': []
  'toggle-selection': [itemId: string]
  'load-more': []
  'open-edit': [item: any]
  'archive': [id: string]
  'restore': [id: string]
  'delete-forever': [id: string]
  'create-publication': [item: any]
  'move': [ids: string[]]
}>()

const { t } = useI18n()

const isAllSelected = computed(() => props.items.length > 0 && props.items.every(item => props.selectedIds.includes(item.id)))
const isSomeSelected = computed(() => props.selectedIds.length > 0 && !isAllSelected.value)

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
const hasSeenSentinel = ref(false)

const showEndMessage = computed(() => {
  if (props.isLoading) return false
  if (props.hasMore) return false
  if ((props.items?.length ?? 0) <= 0) return false
  return hasSeenSentinel.value
})

const setupObserver = () => {
  if (observer) {
    observer.disconnect()
  }
  if (!sentinelRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting) {
        hasSeenSentinel.value = true
      }
      if (entry?.isIntersecting && props.hasMore && !props.isLoading) {
        emit('load-more')
      }
    },
    { rootMargin: '200px' },
  )
  observer.observe(sentinelRef.value)
}

onMounted(() => { setupObserver() })
onBeforeUnmount(() => { observer?.disconnect() })

watch(sentinelRef, () => { setupObserver() })

watch(
  () => props.items.length,
  (newCount, oldCount) => {
    if (newCount <= 0) {
      hasSeenSentinel.value = false
      return
    }

    if (oldCount > 0 && newCount < oldCount) {
      hasSeenSentinel.value = false
    }
  },
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="isLoading && items.length === 0" class="flex justify-center py-8">
      <UiLoadingSpinner />
    </div>

    <div v-else class="space-y-4">
      <div v-if="error" class="text-red-600 dark:text-red-400 px-2">
        {{ error }}
      </div>
      <!-- Selection & Status -->
      <div class="flex items-center justify-between gap-4 px-2">
        <UCheckbox
          v-if="!disableSelection"
          :model-value="isAllSelected"
          :indeterminate="isSomeSelected"
          :disabled="items.length === 0"
          :label="isAllSelected ? t('common.deselectAll') : t('common.selectAll')"
          @update:model-value="emit('select-all')"
        />

        <div class="flex items-center gap-2">
          <UiLoadingSpinner v-if="isLoading || isUploadingFiles" size="xs" color="primary" />
          <CommonFoundCount :count="total" :show="true" class="mb-0!" />
        </div>
      </div>

      <!-- Items grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ContentItemCard
          v-for="item in items"
          :key="item.id"
          class="h-full shadow-sm!"
          :item="item as any"
          :selected="selectedIds.includes(item.id)"
          :archive-status="archiveStatus"
          :is-archiving="isArchivingId === item.id"
          :is-restoring="isRestoringId === item.id"
          :hide-checkbox="disableSelection"
          :hide-actions="hideActions"
          :active-collection-id="props.activeCollectionId"
          :active-collection-type="props.activeCollectionType"
          @click="emit('open-edit', item)"
          @toggle-selection="() => { if (!disableSelection) emit('toggle-selection', item.id) }"
          @archive="emit('archive', $event.id)"
          @restore="emit('restore', $event)"
          @delete-forever="emit('delete-forever', $event)"
          @create-publication="emit('create-publication', $event)"
          @move="emit('move', [$event.id])"
        />
      </div>

      <!-- Empty State -->
      <div v-if="items.length === 0" class="py-10 text-center text-gray-500 dark:text-gray-400">
        {{ q.length > 0 || selectedTags.length > 0 ? t('common.noResults') : t('contentLibrary.empty') }}
      </div>

      <!-- Infinite scroll sentinel -->
      <div ref="sentinelRef" class="h-1" aria-hidden="true" />

      <div
        v-if="showEndMessage"
        class="flex justify-center py-6 text-sm text-gray-400 dark:text-gray-500"
      >
        {{ t('common.endOfList') }}
      </div>

      <!-- Loading indicator for subsequent pages -->
      <div v-if="isLoading && items.length > 0" class="flex justify-center py-4">
        <UiLoadingSpinner size="sm" color="primary" />
      </div>
    </div>
  </div>
</template>
