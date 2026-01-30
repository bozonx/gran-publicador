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
  fetchUserTemplates,
  fetchProjectTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
  isLoading
} = useLlmPromptTemplates()

// State
const templates = ref<LlmPromptTemplate[]>([])
const isModalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingTemplate = ref<LlmPromptTemplate | null>(null)
const isSubmitting = ref(false)
const isDeleteConfirmOpen = ref(false)
const tplToDelete = ref<LlmPromptTemplate | null>(null)

// Form state
const formData = reactive({
  name: '',
  description: '',
  prompt: ''
})

// Search
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, SEARCH_DEBOUNCE_MS)

// Filtered templates based on search
const filteredTemplates = computed(() => {
  if (!debouncedSearch.value.trim()) {
    return templates.value
  }
  
  const query = debouncedSearch.value.toLowerCase()
  return templates.value.filter(tpl => 
    tpl.name.toLowerCase().includes(query) ||
    (tpl.description && tpl.description.toLowerCase().includes(query)) ||
    tpl.prompt.toLowerCase().includes(query)
  )
})

// Character count for prompt
const promptCharCount = computed(() => formData.prompt.length)

// Validation
const canSubmit = computed(() => {
  return formData.name.trim().length > 0 && formData.prompt.trim().length > 0
})

// Load templates
const loadTemplates = async () => {
  if (props.projectId) {
    templates.value = await fetchProjectTemplates(props.projectId)
  } else if (user.value?.id) {
    templates.value = await fetchUserTemplates(user.value.id)
  }
}

onMounted(() => {
  loadTemplates()
})

// Modal Actions
const openCreateModal = () => {
  modalMode.value = 'create'
  editingTemplate.value = null
  formData.name = ''
  formData.description = ''
  formData.prompt = ''
  isModalOpen.value = true
}

const openEditModal = (template: LlmPromptTemplate) => {
  modalMode.value = 'edit'
  editingTemplate.value = template
  formData.name = template.name
  formData.description = template.description || ''
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

// Delete Action
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

// Reorder Action
const handleReorder = async () => {
  const ids = templates.value.map((tpl: LlmPromptTemplate) => tpl.id)
  await reorderTemplates(ids)
}

const title = computed(() => props.projectId ? t('llm.projectTemplates_desc') : t('llm.userTemplates_desc'))

// Use filtered templates for draggable
const displayTemplates = computed({
  get: () => filteredTemplates.value,
  set: (value) => {
    // When reordering, update the original templates array
    templates.value = value
  }
})
</script>

<template>
  <UiAppCard :title="t('llm.manageTemplates')" :description="title">
    <template #actions>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        variant="soft"
        size="sm"
        @click="openCreateModal"
      >
        {{ t('llm.addTemplate') }}
      </UButton>
    </template>

    <!-- Search Field -->
    <div v-if="templates.length > 0" class="mb-4">
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
    </div>

    <!-- Templates List -->
    <div v-if="isLoading && templates.length === 0" class="py-4 text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400 mx-auto" />
    </div>
    
    <div v-else-if="templates.length === 0" class="text-center py-12 px-4">
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
        icon="i-heroicons-plus"
        color="primary"
        @click="openCreateModal"
      >
        {{ t('llm.createFirstTemplate') }}
      </UButton>
    </div>

    <div v-else-if="filteredTemplates.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      {{ t('llm.noTemplatesFound') }}
    </div>

    <VueDraggable
      v-else-if="filteredTemplates.length > 0"
      v-model="displayTemplates"
      handle=".drag-handle"
      class="space-y-3"
      :disabled="searchQuery.length > 0"
      @end="handleReorder"
    >
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg group"
      >
        <!-- Drag Handle -->
        <div class="drag-handle mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <UIcon name="i-heroicons-bars-2" class="w-5 h-5" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ tpl.name }}
            </h4>
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
            icon="i-heroicons-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            :title="t('common.edit')"
            @click.stop="openEditModal(tpl)"
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

    <!-- Create/Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="modalMode === 'create' ? t('llm.addTemplate') : t('llm.editTemplate')"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField :label="t('llm.templateName')" required>
          <UInput
            v-model="formData.name"
            :placeholder="t('llm.templateNamePlaceholder')"
            autofocus
          />
        </UFormField>

        <UFormField :label="t('llm.templateDescription')">
          <UInput
            v-model="formData.description"
            :placeholder="t('llm.templateDescriptionPlaceholder')"
          />
        </UFormField>

        <UFormField :label="t('llm.templatePrompt')" required>
          <UTextarea
            v-model="formData.prompt"
            :placeholder="t('llm.templatePromptPlaceholder')"
            :rows="6"
            autoresize
            class="font-mono text-sm"
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
