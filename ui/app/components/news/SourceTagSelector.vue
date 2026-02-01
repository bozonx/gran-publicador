<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

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
const isLoadingCategory = ref<string | null>(null) // category key currently loading

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
  // Try to find full tag objects for selected tags to display nice labels
  // If not found, fall back to the tag string
  return selectedTags.value.map(tagStr => {
    // Search in all loaded tags
    for (const cat in tagsByCategory.value) {
      const tags = tagsByCategory.value[cat]
      if (tags) {
        const found = tags.find(t => t.tag === tagStr)
        if (found) return found
      }
    }
    // Search in search results
    const foundInSearch = searchResults.value.find(t => t.tag === tagStr)
    if (foundInSearch) return foundInSearch

    // Fallback: try to parse it if we can't find it
    // ex: "topic:politics" -> "Politics"
    const parts = tagStr.split(':')
    if (parts.length > 1) {
        // Capitalize first letter of value
        const val = parts[1]
        if (val) {
           return { label: val.charAt(0).toUpperCase() + val.slice(1), tag: tagStr }
        }
    }
    return { label: tagStr, tag: tagStr }
  })
})

const isSearching = computed(() => searchQuery.value.trim().length > 0)

// Expanded categories (accordion state)
const expandedCategories = ref<Set<string>>(new Set())

// Methods

async function fetchCategories() {
  isLoadingInitial.value = true
  try {
    const res = await api.get<{ items: Category[] }>('/source-tags/categories')
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
    // Fetch all tags for category. Assuming limit 500 is enough as per docs "1-500".
    const res = await api.get<{ items: Tag[] }>('/source-tags', {
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
    const res = await api.get<{ items: Tag[] }>('/source-tags', {
      params: { q: searchQuery.value, limit: 100 }
    })
    searchResults.value = res.items
  } catch (e) {
    console.error('Search failed', e)
  } finally {
    isLoadingSearch.value = false
  }
}

// Debounced search
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
    <!-- Trigger Button / Input Area -->
    <div
      @click="isOpen = true"
      class="relative w-full min-h-[42px] px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm cursor-text hover:border-gray-400 dark:hover:border-gray-600 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-colors flex flex-wrap gap-2 items-center"
    >
        <!-- Selected Tags Chips -->
        <UBadge
          v-for="item in displayedSelectedTags"
          :key="item.tag"
          color="primary"
          variant="subtle"
          size="sm"
          class="flex items-center gap-1"
        >
          {{ item.label }}
          <UIcon
            name="i-heroicons-x-mark"
            class="w-3 h-3 cursor-pointer hover:text-primary-700 dark:hover:text-primary-300"
            @click.stop="removeTag(item.tag)"
          />
        </UBadge>

        <!-- Placeholder if empty -->
        <span v-if="selectedTags.length === 0" class="text-gray-400 dark:text-gray-500 text-sm">
          {{ props.placeholder || t('news.selectSourceTags') || 'Select source tags...' }}
        </span>

        <!-- Icon -->
        <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <UIcon name="i-heroicons-tag" class="w-5 h-5 text-gray-400" />
        </div>
    </div>

    <!-- Modal -->
    <AppModal
      v-model:open="isOpen"
      :title="t('news.selectSourceTags') || 'Select Source Tags'"
      :ui="{ body: '!p-0', footer: '!justify-between' }"
    >
      <div class="flex flex-col h-[60vh] sm:h-[500px]">
        <!-- Search Input -->
        <div class="p-4 border-b border-gray-100 dark:border-gray-800">
           <UInput
             v-model="searchQuery"
             icon="i-heroicons-magnifying-glass"
             :placeholder="t('common.search') || 'Search tags...'"
             size="lg"
             autofocus
             :loading="isLoadingSearch"
             class="w-full"
           />
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900/50">
           
           <!-- Search Results -->
           <div v-if="isSearching" class="p-4 space-y-4">
              <div v-if="searchResults.length === 0 && !isLoadingSearch" class="text-center py-8 text-gray-500">
                  {{ t('common.noResults') || 'No tags found.' }}
              </div>
              
              <!-- Group Search Results by Category for clarity -->
              <div v-else class="space-y-4">
                 <div v-for="(group, catKey) in searchResults.reduce((acc, tag) => {
                    (acc[tag.categoryLabel] = acc[tag.categoryLabel] || []).push(tag);
                    return acc;
                 }, {} as Record<string, Tag[]>)" :key="catKey">
                    <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{{ catKey }}</h4>
                    <div class="flex flex-wrap gap-2">
                         <UButton
                            v-for="tag in group"
                            :key="tag.tag"
                            :color="isTagSelected(tag.tag) ? 'primary' : 'neutral'"
                            :variant="isTagSelected(tag.tag) ? 'solid' : 'subtle'"
                            size="sm"
                            class="rounded-full shadow-sm"
                            @click="toggleTag(tag.tag)"
                         >
                            {{ tag.label }}
                         </UButton>
                    </div>
                 </div>
              </div>
           </div>

           <!-- Categories List (Default View) -->
           <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-if="isLoadingInitial" class="p-8 text-center">
                 <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              </div>

              <div
                v-for="cat in categories"
                :key="cat.category"
                class="bg-white dark:bg-gray-900 first:border-t-0 border-t border-gray-100 dark:border-gray-800"
              >
                 <!-- Category Header -->
                 <button
                   type="button"
                   class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                   @click="toggleCategory(cat.category)"
                 >
                    <div class="flex items-center gap-3">
                       <span class="font-medium text-gray-900 dark:text-white">{{ cat.label }}</span>
                       <UBadge color="neutral" variant="subtle" size="xs">{{ cat.count }}</UBadge>
                    </div>
                    <UIcon
                      name="i-heroicons-chevron-down"
                      class="w-5 h-5 text-gray-400 transition-transform duration-200"
                      :class="{'rotate-180': isCategoryExpanded(cat.category)}"
                    />
                 </button>

                 <!-- Category Content -->
                 <div
                   v-show="isCategoryExpanded(cat.category)"
                   class="px-4 pb-4 pt-1"
                 >
                    <div v-if="isLoadingCategory === cat.category" class="py-4 text-center">
                       <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary-500 mx-auto" />
                    </div>
                    
                    <div v-else-if="tagsByCategory[cat.category]" class="flex flex-wrap gap-2 animate-fade-in">
                       <UButton
                          v-for="tag in tagsByCategory[cat.category]"
                          :key="tag.tag"
                          :color="isTagSelected(tag.tag) ? 'primary' : 'neutral'"
                          :variant="isTagSelected(tag.tag) ? 'solid' : 'subtle'"
                          size="sm"
                          class="rounded-full shadow-sm"
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
      
      <!-- Footer -->
      <template #footer>
         <div class="flex items-center text-sm text-gray-500">
           {{ selectedTags.length }} tags selected
         </div>
         <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" @click="selectedTags = []" v-if="selectedTags.length > 0">
               {{ t('common.clear') || 'Clear' }}
            </UButton>
            <UButton color="primary" @click="isOpen = false">
               {{ t('common.done') || 'Done' }}
            </UButton>
         </div>
      </template>
    </AppModal>
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
