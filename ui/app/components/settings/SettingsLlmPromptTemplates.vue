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
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
  hideSystemTemplate,
  unhideSystemTemplate,
  hideTemplate,
  unhideTemplate,
  fetchCopyTargets,
  isLoading
} = useLlmPromptTemplates()

// ─── Source tab ──────────────────────────────────────────────────────
type SourceTab = 'system' | 'project' | 'personal'
const activeTab = ref<SourceTab>(props.projectId ? 'project' : 'personal')

const tabItems = computed(() => {
  const items: Array<{ value: SourceTab; label: string }> = [
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
const templates = ref<LlmPromptTemplate[]>([])
const showHidden = ref(false)

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
  description: '',
  category: 'General',
  prompt: ''
})

// ─── Category filter (dynamic from data) ────────────────────────────
const categoryFilter = ref('ALL')

const currentTemplateList = computed(() => {
  if (activeTab.value === 'system') return systemTemplates.value
  return templates.value
})

const categoryOptions = computed(() => {
  const categories = new Set<string>()
  currentTemplateList.value.forEach(tpl => {
    if (tpl.category) categories.add(tpl.category)
  })
  const sorted = [...categories].sort()
  return [
    { value: 'ALL', label: t('common.all') },
    ...sorted.map(c => ({ value: c, label: c })),
  ]
})

// ─── Search ─────────────────────────────────────────────────────────
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

// ─── Filtered templates ─────────────────────────────────────────────
const filteredTemplates = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()

  return currentTemplateList.value.filter((tpl) => {
    if (!showHidden.value && tpl.isHidden) return false
    if (showHidden.value && activeTab.value !== 'system' && !tpl.isHidden) return false

    const matchesCategory =
      categoryFilter.value === 'ALL' || tpl.category === categoryFilter.value

    if (!matchesCategory) return false
    if (!query) return true

    return (
      tpl.name.toLowerCase().includes(query) ||
      (tpl.description && tpl.description.toLowerCase().includes(query)) ||
      tpl.prompt.toLowerCase().includes(query)
    )
  })
})

// Validation
const canSubmit = computed(() => {
  return formData.name.trim().length > 0 && formData.prompt.trim().length > 0
})

// ─── Data loading ───────────────────────────────────────────────────
const loadTemplates = async () => {
  const includeHidden = true

  if (activeTab.value === 'system') {
    systemTemplates.value = await fetchSystemTemplates(includeHidden)
  } else if (activeTab.value === 'project' && props.projectId) {
    templates.value = await fetchProjectTemplates(props.projectId, includeHidden)
  } else if (user.value?.id) {
    templates.value = await fetchUserTemplates(user.value.id, includeHidden)
  }
}

watch(activeTab, () => {
  categoryFilter.value = 'ALL'
  searchQuery.value = ''
  showHidden.value = false
  loadTemplates()
})

onMounted(() => {
  loadTemplates()
})

// ─── Create / Edit modal ────────────────────────────────────────────
const openCreateModal = () => {
  modalMode.value = 'create'
  editingTemplate.value = null
  formData.name = ''
  formData.description = ''
  formData.category = 'General'
  formData.prompt = ''
  isModalOpen.value = true
}

const openEditModal = (template: LlmPromptTemplate) => {
  modalMode.value = 'edit'
  editingTemplate.value = template
  formData.name = template.name
  formData.description = template.description || ''
  formData.category = template.category || 'General'
  formData.prompt = template.prompt
  isModalOpen.value = true
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  isSubmitting.value = true
  try {
    if (modalMode.value === 'create') {
      await createTemplate({
        ...formData,
        userId: props.projectId ? undefined : user.value?.id,
        projectId: props.projectId
      })
    } else if (editingTemplate.value) {
      await updateTemplate(editingTemplate.value.id, formData)
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
      description: copySource.value.description,
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
const handleReorder = async () => {
  const ids = templates.value.filter(t => !t.isHidden).map((tpl: LlmPromptTemplate) => tpl.id)
  await reorderTemplates(ids)
}

const displayTemplates = computed({
  get: () => filteredTemplates.value,
  set: (value) => {
    templates.value = value
  }
})

const isCustomTab = computed(() => activeTab.value === 'personal' || activeTab.value === 'project')
const title = computed(() => props.projectId ? t('llm.projectTemplates_desc') : t('llm.userTemplates_desc'))
</script>

<template>
  <UiAppCard :title="t('llm.manageTemplates')" :description="title">
    <template #actions>
      <UButton
        v-if="isCustomTab"
        icon="i-heroicons-plus"
        color="primary"
        variant="soft"
        size="sm"
        @click="openCreateModal"
      >
        {{ t('llm.addTemplate') }}
      </UButton>
    </template>

    <!-- Source Tabs -->
    <div class="mb-4">
      <UTabs
        :items="tabItems"
        :model-value="activeTab"
        @update:model-value="activeTab = $event as SourceTab"
      />
    </div>

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
          v-model="categoryFilter"
          :items="categoryOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />

        <div class="flex items-center gap-2">
          <UToggle v-model="showHidden" />
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('llm.showHidden') }}</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && filteredTemplates.length === 0" class="py-4 text-center">
      <UiLoadingSpinner />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredTemplates.length === 0 && !showHidden" class="text-center py-12 px-4">
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
        v-if="isCustomTab"
        icon="i-heroicons-plus"
        color="primary"
        @click="openCreateModal"
      >
        {{ t('llm.createFirstTemplate') }}
      </UButton>
    </div>

    <div v-else-if="filteredTemplates.length === 0 && showHidden" class="text-center py-8 text-gray-500 dark:text-gray-400">
      {{ t('llm.noHiddenTemplates') }}
    </div>

    <!-- System templates list (no drag) -->
    <div v-else-if="activeTab === 'system'" class="space-y-3">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="flex items-start gap-3 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg group"
        :class="{ 'opacity-60': tpl.isHidden }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ tpl.name }}
            </h4>

            <UBadge v-if="tpl.isHidden" size="xs" color="neutral" variant="subtle">
              {{ t('common.hidden') }}
            </UBadge>

            <UBadge size="xs" color="neutral" variant="subtle">
              {{ tpl.category }}
            </UBadge>
          </div>
          <p v-if="tpl.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {{ tpl.description }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2 font-mono bg-white/50 dark:bg-gray-900/50 p-1.5 rounded">
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

    <!-- User/Project templates list (draggable) -->
    <VueDraggable
      v-else-if="filteredTemplates.length > 0 && !showHidden"
      v-model="displayTemplates"
      handle=".drag-handle"
      class="space-y-3"
      :disabled="searchQuery.length > 0 || categoryFilter !== 'ALL'"
      @end="handleReorder"
    >
      <div
        v-for="tpl in displayTemplates"
        :key="tpl.id"
        class="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg group"
      >
        <div class="drag-handle mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <UIcon name="i-heroicons-bars-2" class="w-5 h-5" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ tpl.name }}
            </h4>

            <UBadge size="xs" color="neutral" variant="subtle">
              {{ tpl.category }}
            </UBadge>
          </div>
          <p v-if="tpl.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {{ tpl.description }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2 font-mono bg-gray-50 dark:bg-gray-800 p-1.5 rounded">
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
            icon="i-heroicons-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            :title="t('common.edit')"
            @click.stop="openEditModal(tpl)"
          />
          <UButton
            icon="i-heroicons-eye-slash"
            color="neutral"
            variant="ghost"
            size="xs"
            :title="t('llm.hide')"
            @click.stop="handleHide(tpl)"
          />
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            :title="t('common.delete')"
            @click.stop="handleDelete(tpl)"
          />
        </div>
      </div>
    </VueDraggable>

    <!-- Hidden custom templates list (no drag, show unhide + delete) -->
    <div v-else-if="showHidden && filteredTemplates.length > 0" class="space-y-3">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg group opacity-60"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ tpl.name }}
            </h4>
            <UBadge size="xs" color="neutral" variant="subtle">
              {{ t('common.hidden') }}
            </UBadge>
            <UBadge size="xs" color="neutral" variant="subtle">
              {{ tpl.category }}
            </UBadge>
          </div>
          <p v-if="tpl.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {{ tpl.description }}
          </p>
        </div>

        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton
            icon="i-heroicons-eye"
            color="primary"
            variant="ghost"
            size="xs"
            :title="t('llm.unhide')"
            @click.stop="handleUnhide(tpl)"
          />
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            :title="t('common.delete')"
            @click.stop="handleDelete(tpl)"
          />
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
          <UInput
            v-model="formData.category"
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

        <UFormField :label="t('llm.templateDescription')" class="w-full">
          <UTextarea
            v-model="formData.description"
            :placeholder="t('llm.templateDescriptionPlaceholder')"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
      </form>

      <template #footer>
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
