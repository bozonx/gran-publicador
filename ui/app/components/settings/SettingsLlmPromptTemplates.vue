<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import { SEARCH_DEBOUNCE_MS } from '~/constants/search'

const props = defineProps<{
  projectId?: string
}>()

const { t } = useI18n()
const { user } = useAuth()
const {
  fetchSystemTemplates,
  fetchUserTemplates,
  fetchProjectTemplates,
  fetchAvailableTemplates,
  setAvailableOrder,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  hideSystemTemplate,
  unhideSystemTemplate,
  hideTemplate,
  unhideTemplate,
  fetchCopyTargets,
  isLoading
} = useLlmPromptTemplates()

// ─── Source filter ───────────────────────────────────────────────────
type SourceFilter = 'all' | 'system' | 'project' | 'personal'
const sourceFilter = ref<SourceFilter>('all')

const sourceOptions = computed(() => {
  const items: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: t('common.all', 'All') },
    { value: 'system', label: t('llm.systemTemplates') },
  ]
  if (props.projectId) {
    items.push({ value: 'project', label: t('llm.projectTemplates') })
  }
  items.push({ value: 'personal', label: t('llm.personalTemplates') })
  return items
})

// ─── State ──────────────────────────────────────────────────────────
const systemTemplates = ref<LlmPromptTemplate[]>([])
const userTemplates = ref<LlmPromptTemplate[]>([])
const projectTemplates = ref<LlmPromptTemplate[]>([])
const showHiddenOnly = ref(false)

const availableOrder = ref<string[]>([])

// Edit/Create modal
const isModalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingTemplate = ref<LlmPromptTemplate | null>(null)
const isSubmitting = ref(false)

// Delete confirmation
const isDeleteConfirmOpen = ref(false)
const tplToDelete = ref<LlmPromptTemplate | null>(null)

// Copy modal
const isCopyModalOpen = ref(false)
const copySource = ref<LlmPromptTemplate | null>(null)
const copyTargetProjects = ref<Array<{ id: string; name: string }>>([])
const selectedCopyTarget = ref<string>('personal')
const isCopying = ref(false)

// Form state
const formData = reactive({
  name: '',
  category: 'General',
  customCategory: '',
  prompt: ''
})

const CUSTOM_CATEGORY_VALUE = '__custom__'

const categoryOptions = computed(() => {
  const categories = new Set<string>()
  ;[...systemTemplates.value, ...userTemplates.value, ...projectTemplates.value].forEach((tpl) => {
    if (tpl.category) categories.add(tpl.category)
  })
  const sorted = [...categories].sort()
  return [
    ...sorted.map(c => ({ value: c, label: c })),
    { value: CUSTOM_CATEGORY_VALUE, label: t('common.custom', 'Custom') },
  ]
})

// ─── Search ─────────────────────────────────────────────────────────
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

const currentTemplates = computed<LlmPromptTemplate[]>(() => {
  if (sourceFilter.value === 'system') return systemTemplates.value
  if (sourceFilter.value === 'personal') return userTemplates.value
  if (sourceFilter.value === 'project') return projectTemplates.value
  return [...systemTemplates.value, ...projectTemplates.value, ...userTemplates.value]
})

const orderMap = computed(() => {
  const map = new Map<string, number>()
  availableOrder.value.forEach((id, idx) => {
    map.set(id, idx)
  })
  return map
})

function applyAvailableOrder(list: LlmPromptTemplate[]) {
  const map = orderMap.value
  if (!props.projectId) return list
  if (!map.size) return list

  return [...list].sort((a, b) => {
    const ai = map.get(a.id)
    const bi = map.get(b.id)
    if (ai === undefined && bi === undefined) return 0
    if (ai === undefined) return 1
    if (bi === undefined) return -1
    return ai - bi
  })
}

// ─── Filtered templates ─────────────────────────────────────────────
const filteredTemplates = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()

  return currentTemplates.value.filter((tpl) => {
    if (showHiddenOnly.value && !tpl.isHidden) return false
    if (!showHiddenOnly.value && tpl.isHidden) return false

    if (!query) return true

    return (
      tpl.name.toLowerCase().includes(query) ||
      tpl.prompt.toLowerCase().includes(query)
    )
  })
})

const orderedFilteredTemplates = computed(() => {
  if (sourceFilter.value !== 'all') return filteredTemplates.value
  if (!props.projectId) return filteredTemplates.value
  if (showHiddenOnly.value) return filteredTemplates.value
  if (searchQuery.value) return filteredTemplates.value
  return applyAvailableOrder(filteredTemplates.value)
})

// Validation
const canSubmit = computed(() => {
  return formData.name.trim().length > 0 && formData.prompt.trim().length > 0
})

// ─── Data loading ───────────────────────────────────────────────────
const loadTemplates = async () => {
  const includeHidden = true

  systemTemplates.value = await fetchSystemTemplates(includeHidden)

  if (user.value?.id) {
    userTemplates.value = await fetchUserTemplates(user.value.id, includeHidden)
  } else {
    userTemplates.value = []
  }

  if (props.projectId) {
    projectTemplates.value = await fetchProjectTemplates(props.projectId, includeHidden)
  } else {
    projectTemplates.value = []
  }

  if (props.projectId) {
    const available = await fetchAvailableTemplates({ projectId: props.projectId })
    if (available.order?.length) {
      availableOrder.value = available.order
    } else {
      availableOrder.value = [...systemTemplates.value, ...projectTemplates.value, ...userTemplates.value]
        .filter(tpl => !tpl.isHidden)
        .map(tpl => tpl.id)
    }
  } else {
    availableOrder.value = []
  }
}

watch(sourceFilter, () => {
  searchQuery.value = ''
  showHiddenOnly.value = false
})

onMounted(() => {
  loadTemplates()
})

// ─── Create / Edit modal ────────────────────────────────────────────
const openCreateModal = () => {
  modalMode.value = 'create'
  editingTemplate.value = null
  formData.name = ''
  formData.category = categoryOptions.value[0]?.value || 'General'
  formData.customCategory = ''
  formData.prompt = ''
  isModalOpen.value = true
}

const openEditModal = (template: LlmPromptTemplate) => {
  modalMode.value = 'edit'
  editingTemplate.value = template
  formData.name = template.name
  const existingCategories = categoryOptions.value.map(o => o.value)
  const templateCategory = template.category || 'General'
  if (existingCategories.includes(templateCategory)) {
    formData.category = templateCategory
    formData.customCategory = ''
  } else {
    formData.category = CUSTOM_CATEGORY_VALUE
    formData.customCategory = templateCategory
  }
  formData.prompt = template.prompt
  isModalOpen.value = true
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  const category = formData.category === CUSTOM_CATEGORY_VALUE
    ? formData.customCategory.trim()
    : formData.category

  if (!category) return

  isSubmitting.value = true
  try {
    if (modalMode.value === 'create') {
      await createTemplate({
        name: formData.name,
        category,
        prompt: formData.prompt,
        userId: props.projectId ? undefined : user.value?.id,
        projectId: props.projectId
      })
    } else if (editingTemplate.value) {
      await updateTemplate(editingTemplate.value.id, {
        name: formData.name,
        category,
        prompt: formData.prompt,
      })
    }

    await loadTemplates()
    isModalOpen.value = false
  } finally {
    isSubmitting.value = false
  }
}

// ─── Delete ─────────────────────────────────────────────────────────
const handleDelete = (tpl: LlmPromptTemplate) => {
  tplToDelete.value = tpl
  isDeleteConfirmOpen.value = true
}

const confirmDelete = async () => {
  if (!tplToDelete.value) return

  const success = await deleteTemplate(tplToDelete.value.id)
  if (success) {
    await loadTemplates()
  }
  isDeleteConfirmOpen.value = false
  tplToDelete.value = null
}

// ─── Hide / Unhide ──────────────────────────────────────────────────
const handleHide = async (tpl: LlmPromptTemplate) => {
  let success = false
  if (tpl.isSystem) {
    success = await hideSystemTemplate(tpl.id)
  } else {
    success = await hideTemplate(tpl.id)
  }
  if (success) await loadTemplates()
}

const handleUnhide = async (tpl: LlmPromptTemplate) => {
  let success = false
  if (tpl.isSystem) {
    success = await unhideSystemTemplate(tpl.id)
  } else {
    success = await unhideTemplate(tpl.id)
  }
  if (success) await loadTemplates()
}

// ─── Copy ───────────────────────────────────────────────────────────
const openCopyModal = async (tpl: LlmPromptTemplate) => {
  copySource.value = tpl
  selectedCopyTarget.value = 'personal'
  isCopyModalOpen.value = true
  copyTargetProjects.value = await fetchCopyTargets()
}

const handleCopy = async () => {
  if (!copySource.value) return

  isCopying.value = true
  try {
    const data: any = {
      name: copySource.value.name,
      category: copySource.value.category,
      prompt: copySource.value.prompt,
    }

    if (selectedCopyTarget.value === 'personal') {
      data.userId = user.value?.id
    } else {
      data.projectId = selectedCopyTarget.value
    }

    const result = await createTemplate(data)
    if (result) {
      isCopyModalOpen.value = false
      await loadTemplates()
    }
  } finally {
    isCopying.value = false
  }
}

const copyTargetOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [
    { value: 'personal', label: t('llm.personalTemplates') },
  ]
  copyTargetProjects.value.forEach(p => {
    options.push({ value: p.id, label: p.name })
  })
  return options
})

// ─── Reorder ────────────────────────────────────────────────────────
const canReorder = computed(() => {
  return !!props.projectId && sourceFilter.value === 'all' && !showHiddenOnly.value && !searchQuery.value
})

const title = computed(() => props.projectId ? t('llm.projectTemplates_desc') : t('llm.userTemplates_desc'))

type GroupedTemplates = Array<{ category: string; items: LlmPromptTemplate[] }>

const groupedTemplates = computed<GroupedTemplates>(() => {
  const groups = new Map<string, LlmPromptTemplate[]>()
  orderedFilteredTemplates.value.forEach((tpl) => {
    const key = tpl.category || 'General'
    const list = groups.get(key) || []
    list.push(tpl)
    groups.set(key, list)
  })
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }))
})

const reorderableGroups = ref<GroupedTemplates>([])

function rebuildReorderableGroups() {
  if (!canReorder.value) {
    reorderableGroups.value = []
    return
  }

  const active = applyAvailableOrder(
    [...systemTemplates.value, ...projectTemplates.value, ...userTemplates.value].filter(tpl => !tpl.isHidden),
  )

  const groups = new Map<string, LlmPromptTemplate[]>()
  active.forEach((tpl) => {
    const key = tpl.category || 'General'
    const list = groups.get(key) || []
    list.push(tpl)
    groups.set(key, list)
  })

  reorderableGroups.value = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }))
}

watch([sourceFilter, showHiddenOnly, searchQuery, userTemplates, projectTemplates, systemTemplates, availableOrder], () => {
  rebuildReorderableGroups()
}, { deep: true })

function getNextAvailableOrderFromReorderableGroups(): string[] {
  const ids: string[] = []
  reorderableGroups.value.forEach((group) => {
    group.items.forEach((tpl) => {
      if (!tpl.isHidden) ids.push(tpl.id)
    })
  })
  return ids
}

async function handleReorder() {
  if (!props.projectId) return
  const ids = getNextAvailableOrderFromReorderableGroups()
  const success = await setAvailableOrder({ projectId: props.projectId, ids })
  if (success) {
    availableOrder.value = ids
  }
}

function applyCategoryReorder(category: string, orderedItems: LlmPromptTemplate[]) {
  const groups = reorderableGroups.value.map((g) => {
    if (g.category !== category) return g
    return { ...g, items: orderedItems }
  })
  reorderableGroups.value = groups
}

function handleTemplateClick(tpl: LlmPromptTemplate) {
  if (tpl.isSystem) return
  openEditModal(tpl)
}

function toggleHiddenOnly() {
  showHiddenOnly.value = !showHiddenOnly.value
}

function getTemplateBadge(tpl: LlmPromptTemplate): { label: string; color: 'info' | 'primary' | 'success' } {
  if (tpl.isSystem) {
    return { label: t('llm.system'), color: 'info' }
  }
  if (tpl.projectId) {
    return { label: t('llm.project'), color: 'primary' }
  }
  return { label: t('llm.personal'), color: 'success' }
}

</script>

<template>
  <UiAppCard :title="t('llm.manageTemplates')" :description="title">
    <template #actions>
      <UButton
        v-if="sourceFilter === 'personal' || sourceFilter === 'project'"
        icon="i-heroicons-plus"
        color="primary"
        variant="soft"
        size="sm"
        @click="openCreateModal"
      >
        {{ t('llm.addTemplate') }}
      </UButton>
    </template>

    <!-- Filters -->
    <div class="mb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="t('llm.searchTemplates')"
        >
          <template v-if="searchQuery" #trailing>
            <UButton
              color="neutral"
              variant="link"
              icon="i-heroicons-x-mark"
              :padded="false"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>

        <USelectMenu
          v-model="sourceFilter"
          :items="sourceOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            :icon="showHiddenOnly ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-eye-slash'"
            @click="toggleHiddenOnly"
          >
            {{ showHiddenOnly ? t('common.active', 'Active') : t('common.hidden', 'Hidden') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && filteredTemplates.length === 0" class="py-4 text-center">
      <UiLoadingSpinner />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredTemplates.length === 0 && !showHiddenOnly" class="text-center py-12 px-4">
      <div class="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ t('llm.noTemplates') }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {{ t('llm.noTemplatesDescription') }}
      </p>
      <UButton
        v-if="sourceFilter === 'personal' || sourceFilter === 'project'"
        icon="i-heroicons-plus"
        color="primary"
        @click="openCreateModal"
      >
        {{ t('llm.createFirstTemplate') }}
      </UButton>
    </div>

    <div v-else-if="filteredTemplates.length === 0 && showHiddenOnly" class="text-center py-8 text-gray-500 dark:text-gray-400">
      {{ t('llm.noHiddenTemplates') }}
    </div>

    <!-- Grouped list -->
    <div v-else class="space-y-5">
      <div
        v-for="group in (canReorder ? reorderableGroups : groupedTemplates)"
        :key="group.category"
        class="space-y-2"
      >
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {{ group.category }}
        </div>

        <VueDraggable
          v-if="canReorder"
          v-model="group.items"
          handle=".drag-handle"
          class="space-y-3"
          @end="() => { applyCategoryReorder(group.category, group.items); handleReorder() }"
        >
          <div
            v-for="tpl in group.items"
            :key="tpl.id"
            class="flex items-start gap-3 p-4 rounded-lg group cursor-pointer border transition-colors relative"
            :class="[
              tpl.isSystem 
                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800',
              { 'opacity-60': tpl.isHidden }
            ]"
            @click="handleTemplateClick(tpl)"
          >
            <div
              class="drag-handle mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              @click.stop
            >
              <UIcon name="i-heroicons-bars-2" class="w-5 h-5" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
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

                <UBadge v-if="tpl.isHidden" size="xs" color="neutral" variant="subtle" class="ml-1">
                  {{ t('common.hidden') }}
                </UBadge>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 font-mono bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800/50">
                {{ tpl.prompt }}
              </p>
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <UButton
                icon="i-heroicons-document-duplicate"
                color="neutral"
                variant="ghost"
                size="xs"
                :title="t('common.copy')"
                @click.stop="openCopyModal(tpl)"
              />
              <UButton
                icon="i-heroicons-eye-slash"
                color="neutral"
                variant="ghost"
                size="xs"
                :title="t('llm.hide')"
                @click.stop="handleHide(tpl)"
              />
            </div>
          </div>
        </VueDraggable>

        <div v-else class="space-y-3">
          <div
            v-for="tpl in group.items"
            :key="tpl.id"
            class="flex items-start gap-3 p-4 rounded-lg group border transition-colors relative"
            :class="[
              tpl.isSystem 
                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800',
              { 'opacity-60': tpl.isHidden }
            ]"
            @click="handleTemplateClick(tpl)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
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

                <UBadge v-if="tpl.isHidden" size="xs" color="neutral" variant="subtle" class="ml-1">
                  {{ t('common.hidden') }}
                </UBadge>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 font-mono bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800/50">
                {{ tpl.prompt }}
              </p>
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <UButton
                icon="i-heroicons-document-duplicate"
                color="neutral"
                variant="ghost"
                size="xs"
                :title="t('common.copy')"
                @click.stop="openCopyModal(tpl)"
              />
              <UButton
                v-if="tpl.isHidden"
                icon="i-heroicons-eye"
                color="primary"
                variant="ghost"
                size="xs"
                :title="t('llm.unhide')"
                @click.stop="handleUnhide(tpl)"
              />
              <UButton
                v-else
                icon="i-heroicons-eye-slash"
                color="neutral"
                variant="ghost"
                size="xs"
                :title="t('llm.hide')"
                @click.stop="handleHide(tpl)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="modalMode === 'create' ? t('llm.addTemplate') : t('llm.editTemplate')"
    >
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="t('llm.templateName')" required class="w-full">
          <UInput
            v-model="formData.name"
            :placeholder="t('llm.templateNamePlaceholder')"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('llm.templateCategory')" class="w-full">
          <USelectMenu
            v-model="formData.category"
            :items="categoryOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="formData.category === CUSTOM_CATEGORY_VALUE" :label="t('llm.templateCategory')" class="w-full">
          <UInput
            v-model="formData.customCategory"
            :placeholder="t('llm.templateCategoryPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('llm.templatePrompt')" required class="w-full">
          <UTextarea
            v-model="formData.prompt"
            :placeholder="t('llm.templatePromptPlaceholder')"
            :rows="6"
            autoresize
            class="font-mono text-sm w-full"
          />
        </UFormField>
      </form>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <UButton
              v-if="modalMode === 'edit' && editingTemplate && !editingTemplate.isSystem"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="handleDelete(editingTemplate)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="isModalOpen = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              {{ modalMode === 'create' ? t('common.create') : t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UiAppModal>

    <!-- Copy Modal -->
    <UiAppModal
      v-model:open="isCopyModalOpen"
      :title="t('llm.copyTemplate')"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('llm.copyTemplateDescription', { name: copySource?.name }) }}
        </p>

        <UFormField :label="t('llm.copyTarget')" class="w-full">
          <USelectMenu
            v-model="selectedCopyTarget"
            :items="copyTargetOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
      </div>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="isCopyModalOpen = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isCopying"
          @click="handleCopy"
        >
          {{ t('common.copy') }}
        </UButton>
      </template>
    </UiAppModal>

    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isDeleteConfirmOpen"
      :title="t('llm.deleteTemplateTitle')"
      :description="t('llm.confirmDelete')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isLoading"
      @confirm="confirmDelete"
    />
  </UiAppCard>
</template>
