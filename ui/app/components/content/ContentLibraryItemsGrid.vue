<script setup lang="ts">
import { type ContentCollection } from '~/composables/useContentCollections'
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
  q: string
  selectedTags: string
  error: string | null
  isUploadingFiles: boolean
  isArchivingId: string | null
  isRestoringId: string | null
}>()

const emit = defineEmits<{
  'select-all': []
  'toggle-selection': [itemId: string]
  'load-more': []
  'open-edit': [item: any]
  'archive': [id: string]
  'restore': [id: string]
  'create-publication': [item: any]
  'move': [ids: string[]]
}>()

const { t } = useI18n()

const isAllSelected = computed(() => props.items.length > 0 && props.items.every(item => props.selectedIds.includes(item.id)))
const isSomeSelected = computed(() => props.selectedIds.length > 0 && !isAllSelected.value)
</script>

<template>
  <div class="space-y-4">
    <div v-if="isLoading && items.length === 0" class="flex justify-center py-8">
      <UiLoadingSpinner />
    </div>

    <div v-else class="space-y-4">
      <CommonFoundCount :count="total" :show="q.length > 0 || selectedTags.length > 0" class="mb-2" />
      
      <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <!-- Selection & Status -->
      <div class="flex items-center justify-between gap-4 px-2">
        <UCheckbox
          :model-value="isAllSelected"
          :indeterminate="isSomeSelected"
          :disabled="items.length === 0"
          :label="isAllSelected ? t('common.deselectAll') : t('common.selectAll')"
          @update:model-value="emit('select-all')"
        />

        <div v-if="isUploadingFiles" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-primary-500 animate-spin" />
          <span>{{ t('common.loading') }}</span>
        </div>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ContentItemCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :selected="selectedIds.includes(item.id)"
          :is-archiving="isArchivingId === item.id"
          :is-restoring="isRestoringId === item.id"
          @click="emit('open-edit', item)"
          @toggle-selection="emit('toggle-selection', $event)"
          @archive="emit('archive', $event)"
          @restore="emit('restore', $event)"
          @create-publication="emit('create-publication', $event)"
          @move="emit('move', [$event.id])"
        />
      </div>

      <!-- Empty State -->
      <div v-if="items.length === 0" class="py-10 text-center text-gray-500 dark:text-gray-400">
        {{ q.length > 0 || selectedTags.length > 0 ? t('common.noResults') : t('contentLibrary.empty') }}
      </div>

      <!-- Pagination -->
      <div v-if="hasMore" class="pt-2 flex justify-center">
        <UButton
          :loading="isLoading"
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-down"
          @click="emit('load-more')"
        >
          {{ t('common.loadMore') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
