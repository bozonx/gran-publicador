<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { ProjectTemplate, TemplateBlock } from '~/types/channels'
import { containsBlockMarkdown } from '~/utils/markdown-validation'

interface Props {
  projectId: string
  readonly?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const toast = useToast()

const {
  templates,
  isLoading,
  fetchProjectTemplates,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  reorderProjectTemplates,
} = useProjectTemplates()

const insertOptions = [
  { value: 'title', label: t('channel.templateInsertTitle') },
  { value: 'content', label: t('channel.templateInsertContent') },
  { value: 'authorComment', label: t('channel.templateInsertAuthorComment') },
  { value: 'authorSignature', label: t('channel.templateInsertAuthorSignature') },
  { value: 'tags', label: t('channel.templateInsertTags') },
  { value: 'footer', label: t('channel.templateInsertFooter') },
  { value: 'custom', label: t('channel.templateInsertCustom') },
]

const tagCaseOptions = [
  { value: 'none', label: t('channel.tagCaseOptions.none') },
  { value: 'camelCase', label: t('channel.tagCaseOptions.camelCase') },
  { value: 'pascalCase', label: t('channel.tagCaseOptions.pascalCase') },
  { value: 'snake_case', label: t('channel.tagCaseOptions.snake_case') },
  { value: 'SNAKE_CASE', label: t('channel.tagCaseOptions.SNAKE_CASE') },
  { value: 'kebab-case', label: t('channel.tagCaseOptions.kebab-case') },
  { value: 'KEBAB-CASE', label: t('channel.tagCaseOptions.KEBAB-CASE') },
  { value: 'lower_case', label: t('channel.tagCaseOptions.lower_case') },
  { value: 'upper_case', label: t('channel.tagCaseOptions.upper_case') },
]

const postTypeOptions = [
  { value: null, label: t('common.all', 'All') },
  { value: 'POST', label: t('post.type_post', 'Post') },
  { value: 'ARTICLE', label: t('post.type_article', 'Article') },
  { value: 'NEWS', label: t('post.type_news', 'News') },
  { value: 'VIDEO', label: t('post.type_video', 'Video') },
  { value: 'SHORT', label: t('post.type_short', 'Short') },
  { value: 'STORY', label: t('post.type_story', 'Story') },
]

const getDefaultBlocks = (): TemplateBlock[] => [
  { enabled: false, insert: 'title', before: '', after: '' },
  { enabled: true, insert: 'content', before: '', after: '' },
  { enabled: true, insert: 'authorComment', before: '', after: '' },
  { enabled: true, insert: 'authorSignature', before: '', after: '' },
  { enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
  { enabled: false, insert: 'custom', before: '', after: '', content: '' },
  { enabled: true, insert: 'footer', before: '', after: '', content: '' },
]

const isModalOpen = ref(false)
const editingTemplate = ref<ProjectTemplate | null>(null)
const isSaving = ref(false)

const templateForm = reactive({
  name: '',
  postType: null as string | null,
  isDefault: false,
  template: [] as TemplateBlock[],
})

onMounted(() => {
  fetchProjectTemplates(props.projectId)
})

function openAddTemplate() {
  editingTemplate.value = null
  templateForm.name = ''
  templateForm.postType = null
  templateForm.isDefault = templates.value.length === 0
  templateForm.template = getDefaultBlocks()
  isModalOpen.value = true
}

function openEditTemplate(tpl: ProjectTemplate) {
  editingTemplate.value = tpl
  templateForm.name = tpl.name
  templateForm.postType = tpl.postType || null
  templateForm.isDefault = !!tpl.isDefault
  templateForm.template = JSON.parse(JSON.stringify(tpl.template))
  isModalOpen.value = true
}

async function handleSaveTemplate() {
  if (!templateForm.name) return

  // Validate block markdown
  for (const block of templateForm.template) {
    if (block.enabled) {
      if (containsBlockMarkdown(block.before || '') ||
          containsBlockMarkdown(block.after || '') ||
          (block.insert === 'custom' && containsBlockMarkdown(block.content || '')) ||
          (block.insert === 'footer' && containsBlockMarkdown(block.content || ''))) {
        toast.add({
          title: t('common.error'),
          description: t('validation.inlineMarkdownOnly'),
          color: 'error',
        })
        return
      }
    }
  }

  isSaving.value = true

  try {
    if (editingTemplate.value) {
      await updateProjectTemplate(props.projectId, editingTemplate.value.id, {
        name: templateForm.name,
        postType: templateForm.postType,
        isDefault: templateForm.isDefault,
        template: templateForm.template,
      })
    } else {
      await createProjectTemplate(props.projectId, {
        name: templateForm.name,
        postType: templateForm.postType,
        isDefault: templateForm.isDefault,
        template: templateForm.template,
      })
    }

    // Refresh templates to ensure default state and order are correct across all templates
    await fetchProjectTemplates(props.projectId)
    
    isModalOpen.value = false
  } finally {
    isSaving.value = false
  }
}

const showDeleteModal = ref(false)
const templateToDeleteId = ref<string | null>(null)

function handleDeleteRequest(id: string) {
  templateToDeleteId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!templateToDeleteId.value) return
  await deleteProjectTemplate(props.projectId, templateToDeleteId.value)
  showDeleteModal.value = false
  templateToDeleteId.value = null
}

async function handleDragEnd() {
  const ids = templates.value.map(t => t.id)
  await reorderProjectTemplates(props.projectId, ids)
}

function resetBlocks() {
  templateForm.template = getDefaultBlocks()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('projectTemplates.title', 'Publication Templates') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('projectTemplates.description', 'Define templates that control how publications are formatted when posted to channels.') }}
        </p>
      </div>
      <UButton
        v-if="!readonly"
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        @click="openAddTemplate"
      >
        {{ t('projectTemplates.add', 'Add Template') }}
      </UButton>
    </div>

    <div v-if="isLoading && templates.length === 0" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="templates.length === 0" class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-document-text" class="w-10 h-10 mx-auto text-gray-400 mb-3" />
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        {{ t('projectTemplates.empty', 'No templates yet. Create one to control how publications are formatted.') }}
      </p>
    </div>

    <VueDraggable
      v-else
      v-model="templates"
      :disabled="!!readonly"
      handle=".drag-handle"
      @end="handleDragEnd"
    >
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-2 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        @click="openEditTemplate(tpl)"
      >
        <UIcon
          v-if="!readonly"
          name="i-heroicons-bars-3"
          class="drag-handle w-5 h-5 text-gray-400 cursor-grab shrink-0"
          @click.stop
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white truncate">{{ tpl.name }}</span>
            <UBadge v-if="tpl.isDefault" color="primary" variant="subtle" size="xs">
              {{ t('common.default', 'Default') }}
            </UBadge>
            <UBadge v-if="tpl.postType" color="neutral" variant="subtle" size="xs">
              {{ tpl.postType }}
            </UBadge>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ tpl.template.filter((b: TemplateBlock) => b.enabled).length }} {{ t('projectTemplates.activeBlocks', 'active blocks') }}
          </p>
        </div>
      </div>
    </VueDraggable>

    <!-- Template Edit Modal -->
    <UiAppModal 
      v-model:open="isModalOpen" 
      :title="editingTemplate ? t('projectTemplates.edit', 'Edit Template') : t('projectTemplates.add', 'Add Template')"
    >
      <div class="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
        <div class="space-y-4">
          <UFormField :label="t('channel.templateName')" required>
            <UInput 
              v-model="templateForm.name" 
              :placeholder="t('projectTemplates.namePlaceholder', 'e.g. Default, News Format...')" 
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('post.postType')">
            <USelectMenu
              v-model="templateForm.postType"
              :items="postTypeOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <UCheckbox v-model="templateForm.isDefault" />
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('channel.templateIsDefault', 'Default Template') }}
              </div>
              <div class="text-xs text-gray-500">
                {{ t('channel.templateIsDefaultHelp', 'This template will be automatically selected') }}
              </div>
            </div>
          </div>
        </div>

        <!-- Template Blocks -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium text-gray-900 dark:text-white">{{ t('channel.templateBlocks') }}</h4>
            <UButton size="xs" variant="ghost" color="neutral" @click="resetBlocks">
              {{ t('channel.templateReset') }}
            </UButton>
          </div>

          <VueDraggable v-model="templateForm.template" handle=".block-drag-handle">
            <div
              v-for="(block, idx) in templateForm.template"
              :key="idx"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 bg-white dark:bg-gray-800 transition-all"
              :class="{ 'opacity-50 grayscale-[0.5]': !block.enabled, 'ring-1 ring-primary-500/10 border-primary-500/20': block.enabled }"
            >
              <div class="flex items-center gap-3 mb-3">
                <UIcon name="i-heroicons-bars-3" class="block-drag-handle w-5 h-5 text-gray-400 cursor-grab hover:text-gray-600 dark:hover:text-gray-200 transition-colors" />
                <UCheckbox v-model="block.enabled" color="primary" />
                <div class="flex-1 text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  {{ insertOptions.find(o => o.value === block.insert)?.label || block.insert }}
                </div>
              </div>

              <div v-show="block.enabled" class="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700/50 mt-2">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField :label="t('channel.templateBefore')">
                    <UInput v-model="block.before" :placeholder="t('channel.templateBefore')" size="sm" class="font-mono text-xs" />
                  </UFormField>
                  <UFormField :label="t('channel.templateAfter')">
                    <UInput v-model="block.after" :placeholder="t('channel.templateAfter')" size="sm" class="font-mono text-xs" />
                  </UFormField>
                </div>

                <UFormField v-if="block.insert === 'tags'" :label="t('channel.templateTagCase')">
                  <USelectMenu
                    v-model="block.tagCase"
                    :items="tagCaseOptions"
                    value-key="value"
                    label-key="label"
                    size="sm"
                    class="w-full"
                  />
                </UFormField>

                <UFormField 
                  v-if="block.insert === 'custom' || block.insert === 'footer'" 
                  :label="block.insert === 'footer' ? t('projectTemplates.footerContent') : t('channel.templateInsertCustom')"
                >
                  <UTextarea
                    v-model="block.content"
                    :placeholder="block.insert === 'footer' ? t('projectTemplates.footerContent', 'Footer text...') : t('channel.templateCustomContent')"
                    :rows="4"
                    size="sm"
                    class="font-mono text-xs w-full"
                    autoresize
                  />
                </UFormField>
              </div>
            </div>
          </VueDraggable>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <UButton
              v-if="editingTemplate"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="handleDeleteRequest(editingTemplate.id)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
          <div class="flex items-center gap-2">
            <UButton color="neutral" variant="ghost" @click="isModalOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="isSaving"
              :disabled="!templateForm.name"
              @click="handleSaveTemplate"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UiAppModal>

    <!-- Delete Confirmation -->
    <UiConfirmModal
      v-model:open="showDeleteModal"
      :title="t('projectTemplates.deleteTitle', 'Delete Template')"
      :description="t('projectTemplates.deleteWarning', 'This will also remove all channel variations linked to this template. Are you sure?')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      @confirm="confirmDelete"
    />
  </div>
</template>
