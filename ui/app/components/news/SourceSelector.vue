<script setup lang="ts">
import type { Source } from '~/types/source'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const { t } = useI18n()
const { fetchSources, isLoading } = useSources()

// We need to keep track of selected sources objects to display them correctly
// even if they are not in the current search results
const selectedSourceObjects = ref<Source[]>([])

// Initially fetch selected sources if any (or just rely on the fact that we might need a way to resolve names for IDs if we only stored IDs)
// In this case we store source 'name' which is the unique identifier and label, so it's easier.

const searchSources = async (q: string) => {
  const res = await fetchSources({ 
    q, 
    limit: 20,
    orderBy: 'itemCount',
    order: 'desc'
  })
  return res?.items || []
}

// Helper to keep selected objects in sync (if we needed more elaborate display)
// For now, since 'name' is the value, we can just use the items directly.
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    multiple
    searchable
    :searchable-placeholder="t('common.search')"
    :search="searchSources"
    option-attribute="name"
    value-attribute="name"
    :loading="isLoading"
    :placeholder="t('news.filterBySource')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #label>
      <span v-if="modelValue.length" class="truncate">
        {{ modelValue.length }} {{ t('news.sourcesSelected') }}
      </span>
      <span v-else class="text-gray-400 dark:text-gray-500">
        {{ t('news.filterBySource') }}
      </span>
    </template>

    <template #option="{ option }">
      <div class="flex flex-col min-w-0">
        <span class="truncate font-medium">{{ option.name }}</span>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span v-if="option.lang" class="uppercase">{{ option.lang }}</span>
          <span v-if="option.type">{{ option.type }}</span>
          <span>{{ option.itemCount }} items</span>
        </div>
      </div>
    </template>
  </USelectMenu>
</template>
