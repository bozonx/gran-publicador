<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

interface Props {
  title: string
  icon?: string
  iconColor?: string
  publications: PublicationWithRelations[]
  totalCount: number
  loading?: boolean
  hasMore?: boolean
  viewAllTo?: string
  showStatus?: boolean
  showDate?: boolean
  dateType?: 'scheduled' | 'created'
  isProblematic?: boolean
  noDataText?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-heroicons-document-text',
  iconColor: 'text-gray-400',
  loading: false,
  hasMore: false,
  showStatus: false,
  showDate: false,
  dateType: 'scheduled',
  isProblematic: false,
  noDataText: ''
})

const emit = defineEmits<{
  (e: 'loadMore'): void
}>()

const { t } = useI18n()

const displayNoDataText = computed(() => props.noDataText || t('common.noData'))

// 5.5 items height logic
// PublicationMiniItem is roughly 64px (p-3.5 is 14px * 2 + text lines)
// Let's use 380px as a safe height for 5.5 items
const scrollContainerStyle = {
  maxHeight: '380px'
}
</script>

<template>
  <div class="app-card p-4 sm:p-6 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon :name="icon" class="w-5 h-5" :class="iconColor" />
        {{ title }}
        <CommonCountBadge :count="totalCount" :color="isProblematic ? 'error' : 'neutral'" />
      </h3>
      
      <UButton
        v-if="viewAllTo"
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-arrow-right"
        trailing
        :to="viewAllTo"
      >
        {{ t('common.viewAll') }}
      </UButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar pr-1" :style="scrollContainerStyle">
      <div v-if="loading && !publications.length" class="flex justify-center py-8">
        <UiLoadingSpinner size="sm" />
      </div>

      <div v-else-if="publications.length > 0">
        <CommonInfiniteList
          :is-loading="loading"
          :has-more="hasMore"
          :item-count="publications.length"
          @load-more="emit('loadMore')"
        >
          <div class="grid grid-cols-1 gap-2 pb-2">
            <PublicationsPublicationMiniItem
              v-for="pub in publications"
              :key="pub.id"
              :publication="pub"
              :show-status="showStatus"
              :show-date="showDate"
              :date-type="dateType"
              :is-problematic="isProblematic"
            />
          </div>
        </CommonInfiniteList>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
        {{ displayNoDataText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}
</style>
