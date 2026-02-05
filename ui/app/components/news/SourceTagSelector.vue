<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import UiAppModal from '~/components/ui/AppModal.vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()
const api = useApi()

// State
const isOpen = ref(false)
const searchQuery = ref('')
const isLoadingInitial = ref(false)
const isLoadingSearch = ref(false)
const isLoadingCategory = ref<string | null>(null)

// Data
interface Tag {
  tag: string
  category: string
  categoryLabel: string
  value: string
  label: string
}

interface Category {
  category: string
  label: string
  description: string
  count: number
}

const categories = ref<Category[]>([])
const tagsByCategory = ref<Record<string, Tag[]>>({})
const searchResults = ref<Tag[]>([])

// Selection
const selectedTags = computed({
  get: () => props.modelValue ? props.modelValue.split(',').filter(Boolean) : [],
  set: (val: string[]) => emit('update:modelValue', val.join(','))
})

const displayedSelectedTags = computed(() => {
  return selectedTags.value.map(tagStr => {
    for (const cat in tagsByCategory.value) {
      const tags = tagsByCategory.value[cat]
      if (tags) {
        const found = tags.find(t => t.tag === tagStr)
        if (found) return found
      }
    }
    const foundInSearch = searchResults.value.find(t => t.tag === tagStr)
    if (foundInSearch) return foundInSearch

    const parts = tagStr.split(':')
    if (parts.length > 1) {
        const val = parts[1]
        if (val) {
           return { label: val.charAt(0).toUpperCase() + val.slice(1), tag: tagStr }
        }
    }
    return { label: tagStr, tag: tagStr }
  })
})

const isSearching = computed(() => searchQuery.value.trim().length > 0)
const expandedCategories = ref<Set<string>>(new Set())

// Get color for tag based on category
function getTagColor(category: string) {
  const colors: Record<string, any> = {
    topic: 'primary',
    lang: 'info',
    country: 'warning',
    source: 'neutral'
  }
  return colors[category] || 'neutral'
}

// Methods
async function fetchCategories() {
  isLoadingInitial.value = true
  try {
    const res = await api.get<{ items: Category[] }>('/sources/tags/categories')
    categories.value = res.items
  } catch (e) {
    console.error('Failed to fetch categories', e)
  } finally {
    isLoadingInitial.value = false
  }
}

async function fetchTagsForCategory(category: string) {
  if (tagsByCategory.value[category] && tagsByCategory.value[category].length > 0) return

  isLoadingCategory.value = category
  try {
    const res = await api.get<{ items: Tag[] }>('/sources/tags', {
      params: { category, limit: 500 }
    })
    tagsByCategory.value[category] = res.items
  } catch (e) {
    console.error(`Failed to fetch tags for ${category}`, e)
  } finally {
    isLoadingCategory.value = null
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isLoadingSearch.value = true
  try {
    const res = await api.get<{ items: Tag[] }>('/sources/tags', {
      params: { q: searchQuery.value, limit: 200 }
    })
    searchResults.value = res.items
  } catch (e) {
    console.error('Search failed', e)
  } finally {
    isLoadingSearch.value = false
  }
}

const debouncedSearch = useDebounceFn(handleSearch, 300)

watch(searchQuery, () => {
  if (searchQuery.value.trim()) {
    debouncedSearch()
  } else {
    searchResults.value = []
  }
})

function toggleCategory(category: string) {
  if (expandedCategories.value.has(category)) {
    expandedCategories.value.delete(category)
  } else {
    expandedCategories.value.add(category)
    fetchTagsForCategory(category)
  }
}

function isCategoryExpanded(category: string) {
  return expandedCategories.value.has(category)
}

function toggleTag(tagStr: string) {
  const current = new Set(selectedTags.value)
  if (current.has(tagStr)) {
    current.delete(tagStr)
  } else {
    current.add(tagStr)
  }
  selectedTags.value = Array.from(current)
}

function isTagSelected(tagStr: string) {
  return selectedTags.value.includes(tagStr)
}

function removeTag(tagStr: string) {
  const current = new Set(selectedTags.value)
  current.delete(tagStr)
  selectedTags.value = Array.from(current)
}

onMounted(() => {
  fetchCategories()
})
</script>

<template>
  <div class="w-full">
    <!-- Trigger Area -->
    <div
      class="group relative w-full min-h-[44px] px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm cursor-pointer hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all flex flex-wrap gap-2 items-center"
      @click="isOpen = true"
    >
        <!-- Selected Tags Chips -->
        <UBadge
          v-for="item in displayedSelectedTags"
          :key="item.tag"
          color="primary"
          variant="subtle"
          size="sm"
          class="flex items-center gap-1.5 py-1 px-2 rounded-lg"
        >
          {{ item.label }}
          <UIcon
            name="i-heroicons-x-mark"
            class="w-3.5 h-3.5 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            @click.stop="removeTag(item.tag)"
          />
        </UBadge>

        <!-- Placeholder -->
        <span v-if="selectedTags.length === 0" class="text-gray-400 dark:text-gray-500 text-sm ml-1">
          {{ props.placeholder || t('news.selectSourceTags') || 'Select source tags...' }}
        </span>

        <!-- Icon -->
        <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center shrink-0">
          <UIcon 
            name="i-heroicons-tag" 
            class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" 
          />
        </div>
    </div>

    <!-- Modal -->
    <UiAppModal
      v-model:open="isOpen"
      :title="t('news.selectSourceTags') || 'Select Source Tags'"
      :ui="{ body: '!p-0', footer: '!justify-between' }"
    >
      <div class="flex flex-col h-[70vh] max-h-[600px] min-h-[400px]">
        <!-- Search Header -->
        <div class="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
           <UInput
             v-model="searchQuery"
             icon="i-heroicons-magnifying-glass"
             :placeholder="t('common.search') || 'Search tags...'"
             size="lg"
             autofocus
             :loading="isLoadingSearch"
             variant="subtle"
             class="w-full"
           />
        </div>

        <!-- Scrollable Content Area -->
        <div class="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
           
           <!-- Search Results Layout -->
           <div v-if="isSearching" class="p-4 space-y-6">
              <div v-if="searchResults.length === 0 && !isLoadingSearch" class="flex flex-col items-center justify-center py-12 text-gray-400">
                  <UIcon name="i-heroicons-face-frown" class="w-12 h-12 mb-2 opacity-20" />
                  <p>{{ t('common.noResults') || 'No tags found.' }}</p>
              </div>
              
              <div v-else class="space-y-6">
                 <div
v-for="(group, catLabel) in searchResults.reduce((acc, tag) => {
                    (acc[tag.categoryLabel] = acc[tag.categoryLabel] || []).push(tag);
                    return acc;
                 }, {} as Record<string, Tag[]>)" :key="catLabel">
                    <div class="flex items-center gap-2 mb-3">
                       <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{{ catLabel }}</span>
                       <div class="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                         <UButton
                            v-for="tag in group"
                            :key="tag.tag"
                            :color="isTagSelected(tag.tag) ? 'primary' : 'neutral'"
                            :variant="isTagSelected(tag.tag) ? 'solid' : 'subtle'"
                            size="sm"
                            class="rounded-lg shadow-sm"
                            @click="toggleTag(tag.tag)"
                         >
                            {{ tag.label }}
                         </UButton>
                    </div>
                 </div>
              </div>
           </div>

           <!-- Multi-Accordion Categories View -->
           <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-if="isLoadingInitial" class="p-12 flex flex-col items-center gap-3">
                 <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary-500/50" />
                 <span class="text-sm text-gray-400">{{ t('common.loading') }}</span>
              </div>

              <div
                v-for="cat in categories"
                :key="cat.category"
                class="bg-white dark:bg-gray-950 transition-colors"
                :class="{'bg-primary-50/10 dark:bg-primary-900/5': isCategoryExpanded(cat.category)}"
              >
                 <!-- Category Trigger -->
                 <button
                   type="button"
                   class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-left"
                   @click="toggleCategory(cat.category)"
                 >
                    <div class="flex flex-col">
                       <div class="flex items-center gap-3">
                          <span class="font-bold text-gray-900 dark:text-white">{{ cat.label }}</span>
                          <span class="text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{{ cat.count }}</span>
                       </div>
                       <span v-if="cat.description" class="text-xs text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-1 truncate max-w-[280px]">{{ cat.description }}</span>
                    </div>
                    <UIcon
                      name="i-heroicons-chevron-right"
                      class="w-5 h-5 text-gray-400 transition-transform duration-300"
                      :class="{'rotate-90 text-primary-500': isCategoryExpanded(cat.category)}"
                    />
                 </button>

                 <!-- Tags Content -->
                 <div
                   v-if="isCategoryExpanded(cat.category)"
                   class="px-5 pb-6 pt-1 animate-fade-in"
                 >
                    <div v-if="isLoadingCategory === cat.category" class="py-8 flex justify-center">
                       <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
                    </div>
                    
                    <div v-else-if="tagsByCategory[cat.category]" class="flex flex-wrap gap-2">
                       <UButton
                          v-for="tag in tagsByCategory[cat.category]"
                          :key="tag.tag"
                          :color="isTagSelected(tag.tag) ? 'primary' : 'neutral'"
                          :variant="isTagSelected(tag.tag) ? 'solid' : 'subtle'"
                          size="sm"
                          class="rounded-lg shadow-sm min-h-[32px] px-3 font-medium transition-all"
                          @click="toggleTag(tag.tag)"
                       >
                          {{ tag.label }}
                       </UButton>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      <!-- Modal Footer -->
      <template #footer>
         <div class="flex items-center gap-2">
           <UBadge v-if="selectedTags.length" color="primary" variant="solid" size="sm" class="rounded-full">
             {{ selectedTags.length }}
           </UBadge>
           <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
             {{ t('news.selectedCount') || 'Selected' }}
           </span>
         </div>
         <div class="flex gap-3">
            <UButton 
              v-if="selectedTags.length > 0" 
              color="neutral" 
              variant="ghost"
              size="sm"
              @click="selectedTags = []"
            >
               {{ t('common.clear') || 'Clear' }}
            </UButton>
            <UButton 
              color="primary" 
              size="md" 
              class="px-6 rounded-xl"
              @click="isOpen = false"
            >
               {{ t('common.done') || 'Done' }}
            </UButton>
         </div>
      </template>
    </UiAppModal>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.animate-fade-in {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-200 dark:bg-gray-700 rounded-full;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-300 dark:bg-gray-600;
}
</style>
