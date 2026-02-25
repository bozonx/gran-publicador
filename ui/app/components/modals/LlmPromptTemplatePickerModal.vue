<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'

type SourceFilter = 'all' | 'personal' | 'project' | 'system'

interface Emits {
  (e: 'select', template: LlmPromptTemplate): void
  (e: 'close'): void
}

interface Props {
  projectId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { fetchAvailableTemplates } = useLlmPromptTemplates()

const isOpen = defineModel<boolean>('open', { required: true })

const isLoadingTemplates = ref(false)

const systemTemplates = ref<LlmPromptTemplate[]>([])
const userTemplates = ref<LlmPromptTemplate[]>([])
const projectTemplates = ref<LlmPromptTemplate[]>([])
const templatesOrder = ref<string[]>([])

const sourceFilter = ref<SourceFilter>('all')
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

const modalRootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref()

useModalAutoFocus({
  open: isOpen,
  root: modalRootRef,
  candidates: [{ target: searchInputRef }],
})

function resetState() {
  sourceFilter.value = 'all'
  searchQuery.value = ''
}

watch(isOpen, async (open) => {
  if (!open) {
    resetState()
    systemTemplates.value = []
    userTemplates.value = []
    projectTemplates.value = []
    templatesOrder.value = []
    return
  }

  isLoadingTemplates.value = true
  try {
    const templates = await fetchAvailableTemplates({ projectId: props.projectId })
    systemTemplates.value = templates.system
    userTemplates.value = templates.user
    projectTemplates.value = templates.project
    templatesOrder.value = templates.order || []
  } finally {
    isLoadingTemplates.value = false
  }
})

const orderedAllTemplates = computed<LlmPromptTemplate[]>(() => {
  const allTemplates = [...systemTemplates.value, ...userTemplates.value, ...projectTemplates.value]
    .filter(tpl => !tpl.isHidden)

  if (!props.projectId) return allTemplates
  if (templatesOrder.value.length === 0) return allTemplates

  const byId = new Map(allTemplates.map(t => [t.id, t]))
  const ordered: LlmPromptTemplate[] = []

  templatesOrder.value.forEach((id) => {
    const tpl = byId.get(id)
    if (tpl) ordered.push(tpl)
  })

  allTemplates.forEach((tpl) => {
    if (!templatesOrder.value.includes(tpl.id)) ordered.push(tpl)
  })

  return ordered
})

const activeTemplates = computed<LlmPromptTemplate[]>(() => {
  const base = orderedAllTemplates.value

  if (sourceFilter.value === 'system') return base.filter(tpl => tpl.isSystem)
  if (sourceFilter.value === 'project') return base.filter(tpl => Boolean(tpl.projectId) && !tpl.isSystem)
  if (sourceFilter.value === 'personal') return base.filter(tpl => Boolean(tpl.userId) && !tpl.isSystem)
  return base
})

const filteredTemplates = computed<LlmPromptTemplate[]>(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (!query) return activeTemplates.value

  return activeTemplates.value.filter((tpl) => {
    return (
      (tpl.name?.toLowerCase() || '').includes(query) ||
      tpl.prompt.toLowerCase().includes(query)
    )
  })
})

type GroupedTemplates = Array<{ category: string; items: LlmPromptTemplate[] }>

const SYSTEM_CATEGORY_KEYS = ['chat', 'content', 'editing', 'general', 'metadata']

const groupedTemplates = computed<GroupedTemplates>(() => {
  const groups = new Map<string, LlmPromptTemplate[]>()

  filteredTemplates.value.forEach((tpl) => {
    const key = tpl.category || 'General'
    const list = groups.get(key) || []
    list.push(tpl)
    groups.set(key, list)
  })

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      const aIdx = SYSTEM_CATEGORY_KEYS.indexOf(aLower)
      const bIdx = SYSTEM_CATEGORY_KEYS.indexOf(bLower)

      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.localeCompare(b)
    })
    .map(([category, items]) => {
      const lower = category.toLowerCase()
      const isSystem = SYSTEM_CATEGORY_KEYS.includes(lower)
      return {
        category: isSystem ? t(`llm.categories.${lower}`) : category,
        items
      }
    })
})

const filterOptions = computed(() => {
  const items: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: t('common.all', 'All') },
    { value: 'personal', label: t('llm.personalTemplates') },
  ]

  if (props.projectId) {
    items.push({ value: 'project', label: t('llm.projectTemplates') })
  }

  items.push({ value: 'system', label: t('llm.systemTemplates') })

  return items
})

function getTemplateBadge(tpl: LlmPromptTemplate): { label: string; color: 'info' | 'primary' | 'success' } {
  if (tpl.isSystem) {
    return { label: t('llm.system'), color: 'info' }
  }
  if (tpl.projectId) {
    return { label: t('llm.project'), color: 'primary' }
  }
  return { label: t('llm.personal'), color: 'success' }
}

function handleSelect(tpl: LlmPromptTemplate) {
  emit('select', tpl)
  isOpen.value = false
  emit('close')
}

function handleClose() {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('llm.selectTemplate')"
    :description="t('llm.selectTemplateDescription', 'Choose a prompt template')"
    size="2xl"
  >
    <div ref="modalRootRef" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CommonSearchInput
          ref="searchInputRef"
          v-model="searchQuery"
          :placeholder="t('llm.searchTemplates')"
        />

        <USelectMenu
          v-model="sourceFilter"
          :items="filterOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />

        <div class="flex items-center justify-end">
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            :disabled="isLoadingTemplates"
            icon="i-heroicons-x-mark"
            @click="handleClose"
          >
            {{ t('common.close', 'Close') }}
          </UButton>
        </div>
      </div>

      <div v-if="isLoadingTemplates" class="py-6 text-center">
        <UiLoadingSpinner />
      </div>

      <div v-else-if="filteredTemplates.length === 0" class="text-center py-10 px-4">
        <div class="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('llm.noTemplates') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('llm.noTemplatesDescription') }}
        </p>
      </div>

      <div v-else class="space-y-5">
        <div v-for="group in groupedTemplates" :key="group.category" class="space-y-2">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {{ group.category }}
          </div>

          <div class="space-y-3">
            <button
              v-for="tpl in group.items"
              :key="tpl.id"
              type="button"
              class="w-full text-left flex items-start gap-3 p-4 rounded-lg group border transition-colors relative bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-700"
              @click="handleSelect(tpl)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <h4 v-if="tpl.name" class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ tpl.name }}
                  </h4>

                  <UBadge
                    :color="getTemplateBadge(tpl).color"
                    variant="subtle"
                    size="xs"
                    class="ml-1"
                  >
                    {{ getTemplateBadge(tpl).label }}
                  </UBadge>
                </div>

                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 font-mono bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800/50">
                  {{ tpl.prompt }}
                </p>
              </div>

              <div class="mt-1 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                <UIcon name="i-heroicons-arrow-right" class="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </UiAppModal>
</template>
