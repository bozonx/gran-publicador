<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { Source } from '~/types/source'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const { t } = useI18n()
const { fetchSources, isLoading } = useSources()

const searchTerm = ref('')
const searchTermDebounced = refDebounced(searchTerm, 300)
const items = ref<Source[]>([])

// Handle search logic
const handleSearch = async (q: string) => {
  const res = await fetchSources({ 
    q, 
    limit: 20,
    orderBy: 'itemCount',
    order: 'desc'
  })
  items.value = res?.items || []
}

// Watch searchTermDebounced to trigger fetch
watch(searchTermDebounced, (newVal) => {
  handleSearch(newVal)
}, { immediate: true })

// Compute internal value to handle modelValue
const internalValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val as string[])
})
</script>

<template>
  <USelectMenu
    v-model="internalValue"
    v-model:search-term="searchTerm"
    multiple
    :items="items"
    :loading="isLoading"
    ignore-filter
    :search-input="{
      placeholder: t('common.search') || 'Search...',
      icon: 'i-heroicons-magnifying-glass'
    }"
    :placeholder="t('news.filterBySource')"
    label-key="name"
    value-key="name"
  >
    <template #leading v-if="modelValue.length">
       <UIcon name="i-heroicons-funnel" class="w-4 h-4 text-primary-500" />
    </template>

    <template #label>
      <span v-if="modelValue.length" class="truncate font-semibold text-primary-600 dark:text-primary-400">
        {{ modelValue.length === 1 ? modelValue[0] : `${modelValue.length} ${t('news.sourcesSelected')}` }}
      </span>
      <span v-else class="text-gray-400 dark:text-gray-500">
        {{ t('news.filterBySource') }}
      </span>
    </template>

    <template #item-label="{ item: option }">
      <div class="flex flex-col min-w-0 py-0.5">
        <span class="truncate font-medium">{{ option.name }}</span>
        <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
          <span v-if="option.lang" class="bg-gray-100 dark:bg-gray-800 px-1 rounded font-bold">{{ option.lang }}</span>
          <span v-if="option.type" class="opacity-80">{{ option.type }}</span>
          <span class="ml-auto lowercase italic opacity-60 font-medium">{{ option.itemCount }} {{ t('news.items') || 'items' }}</span>
        </div>
      </div>
    </template>

    <template #empty>
      <div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('common.noResults') || 'No sources found' }}
      </div>
    </template>
  </USelectMenu>
</template>
