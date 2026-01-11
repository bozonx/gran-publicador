<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { 
  ChannelWithProject, 
  ChannelPostTemplate, 
  TemplateBlock 
} from '~/types/channels'

interface Props {
  channel: ChannelWithProject
}

const props = defineProps<Props>()
const { t } = useI18n()
const { updateChannel } = useChannels()
const { languageOptions } = useLanguages()

// Post type options (hardcoded based on PostType enum in prisma)
const postTypeOptions = [
  { value: null, label: t('common.all', 'All') },
  { value: 'POST', label: t('post.type_post', 'Post') },
  { value: 'ARTICLE', label: t('post.type_article', 'Article') },
  { value: 'NEWS', label: t('post.type_news', 'News') },
  { value: 'VIDEO', label: t('post.type_video', 'Video') },
  { value: 'SHORT', label: t('post.type_short', 'Short') },
  { value: 'STORY', label: t('post.type_story', 'Story') },
]

const languageSelectOptions = computed(() => [
  { value: null, label: t('common.all', 'All') },
  ...languageOptions
])

const insertOptions = [
  { value: 'title', label: t('channel.templateInsertTitle') },
  { value: 'content', label: t('channel.templateInsertContent') },
  { value: 'description', label: t('channel.templateInsertDescription') },
  { value: 'tags', label: t('channel.templateInsertTags') },
]

const tagCaseOptions = [
  { value: 'none', label: t('channel.tagCaseOptions.none') },
  { value: 'camelCase', label: t('channel.tagCaseOptions.camelCase') },
  { value: 'pascalCase', label: t('channel.tagCaseOptions.pascalCase') },
  { value: 'snake_case', label: t('channel.tagCaseOptions.snake_case') },
  { value: 'SNAKE_CASE', label: t('channel.tagCaseOptions.SNAKE_CASE') },
  { value: 'kebab-case', label: t('channel.tagCaseOptions.kebab-case') },
  { value: 'KEBAB-CASE', label: t('channel.tagCaseOptions.KEBAB-CASE') },
  { value: 'lowercase', label: t('channel.tagCaseOptions.lowercase') },
  { value: 'uppercase', label: t('channel.tagCaseOptions.uppercase') },
]

const getDefaultBlocks = (): TemplateBlock[] => [
  { enabled: false, insert: 'title', before: '', after: '\n\n' },
  { enabled: true, insert: 'content', before: '', after: '' },
  { enabled: true, insert: 'description', before: '\n\n', after: '' },
  { enabled: true, insert: 'tags', before: '\n\n', after: '', tagCase: 'none' },
]

const templates = ref<ChannelPostTemplate[]>(props.channel.preferences?.templates || [])

const isModalOpen = ref(false)
const editingTemplate = ref<ChannelPostTemplate | null>(null)
const templateForm = reactive({
  id: '',
  name: '',
  postType: null as string | null,
  language: null as string | null,
  template: [] as TemplateBlock[]
})

function openAddTemplate() {
  editingTemplate.value = null
  templateForm.id = crypto.randomUUID()
  templateForm.name = ''
  templateForm.postType = null
  templateForm.language = null
  templateForm.template = getDefaultBlocks()
  isModalOpen.value = true
}

function openEditTemplate(template: ChannelPostTemplate) {
  editingTemplate.value = template
  templateForm.id = template.id
  templateForm.name = template.name
  templateForm.postType = template.postType || null
  templateForm.language = template.language || null
  templateForm.template = JSON.parse(JSON.stringify(template.template))
  isModalOpen.value = true
}

async function saveTemplates() {
  const currentPreferences = props.channel.preferences || {}
  await updateChannel(props.channel.id, {
    preferences: {
      ...currentPreferences,
      templates: templates.value
    }
  })
}

function handleSaveTemplate() {
  if (!templateForm.name) return

  if (editingTemplate.value) {
    const index = templates.value.findIndex(t => t.id === templateForm.id)
    if (index !== -1 && templates.value[index]) {
      templates.value[index] = {
        id: templateForm.id,
        name: templateForm.name,
        order: templates.value[index].order,
        postType: templateForm.postType,
        language: templateForm.language,
        template: JSON.parse(JSON.stringify(templateForm.template))
      }
    }
  } else {
    templates.value.push({
      id: templateForm.id,
      name: templateForm.name,
      order: templates.value.length,
      postType: templateForm.postType,
      language: templateForm.language,
      template: JSON.parse(JSON.stringify(templateForm.template))
    })
  }

  saveTemplates()
  isModalOpen.value = false
}

function deleteTemplate(id: string) {
  if (!confirm(t('channel.templateDeleteConfirm'))) return
  
  templates.value = templates.value.filter(t => t.id !== id)
  saveTemplates()
}

function resetBlocks() {
  templateForm.template = getDefaultBlocks()
}

// Watch for external changes to channel
watch(() => props.channel.preferences?.templates, (newTemplates) => {
  if (newTemplates) {
    templates.value = newTemplates
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('channel.templates') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('channel.templateSectionDesc') }}
        </p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        @click="openAddTemplate"
      >
        {{ t('channel.addTemplate') }}
      </UButton>
    </div>

    <div v-if="templates.length === 0" class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-document-text" class="w-10 h-10 mx-auto text-gray-400 mb-3" />
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        {{ t('channel.noTemplates') }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="template in templates"
        :key="template.id"
        class="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-all"
      >
        <div class="flex items-center gap-4 overflow-hidden">
          <div class="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div class="min-w-0">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ template.name }}
            </h4>
            <div class="flex items-center gap-2 mt-1">
              <UBadge v-if="template.postType" size="xs" color="neutral" variant="subtle">
                {{ postTypeOptions.find(o => o.value === template.postType)?.label }}
              </UBadge>
              <UBadge v-if="template.language" size="xs" color="neutral" variant="subtle">
                {{ languageOptions.find(o => o.value === template.language)?.label }}
              </UBadge>
              <span v-if="!template.postType && !template.language" class="text-xs text-gray-400 italic">
                {{ t('common.all') }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton
            icon="i-heroicons-pencil-square"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="openEditTemplate(template)"
          />
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click="deleteTemplate(template.id)"
          />
        </div>
      </div>
    </div>

    <!-- Template Edit Modal -->
    <UModal v-model:open="isModalOpen">
      <template #content>
        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ editingTemplate ? t('channel.templateSettings') : t('channel.addTemplate') }}
                </h3>
              </div>
              <UButton color="neutral" variant="ghost" icon="i-heroicons-x-mark" class="-my-1" @click="isModalOpen = false" />
            </div>
          </template>

          <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <!-- Basic info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField :label="t('channel.templateName')" required class="md:col-span-2">
                <UInput
                  v-model="templateForm.name"
                  :placeholder="t('channel.templateNamePlaceholder')"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="t('channel.templatePostType')">
                <USelectMenu
                  v-model="templateForm.postType"
                  :items="postTypeOptions"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="t('channel.templateLanguage')">
                <USelectMenu
                  v-model="templateForm.language"
                  :items="languageSelectOptions"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Blocks Editor -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  {{ t('channel.templateBlocks') }}
                </h4>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-heroicons-arrow-path"
                  @click="resetBlocks"
                >
                  {{ t('channel.templateReset') }}
                </UButton>
              </div>

              <VueDraggable
                v-model="templateForm.template"
                handle=".drag-handle"
                class="space-y-3"
              >
                <div 
                  v-for="(block, index) in templateForm.template" 
                  :key="index"
                  class="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl relative"
                  :class="{ 'opacity-50': !block.enabled }"
                >
                  <div class="flex items-center gap-4">
                    <div class="drag-handle cursor-move p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <UIcon name="i-heroicons-bars-2" class="w-5 h-5" />
                    </div>

                    <USwitch v-model="block.enabled" size="sm" />

                    <USelectMenu
                      v-model="block.insert"
                      :items="insertOptions"
                      value-key="value"
                      label-key="label"
                      class="w-40"
                    />

                    <div class="flex-1"></div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3" v-if="block.enabled">
                    <UFormField :label="t('channel.templateBefore')">
                      <UTextarea
                        v-model="block.before"
                        :rows="1"
                        autoresize
                        class="font-mono text-xs"
                      />
                    </UFormField>
                    <UFormField :label="t('channel.templateAfter')">
                      <UTextarea
                        v-model="block.after"
                        :rows="1"
                        autoresize
                        class="font-mono text-xs"
                      />
                    </UFormField>

                    <template v-if="block.insert === 'tags'">
                      <UFormField :label="t('channel.templateTagCase')" class="md:col-span-2">
                        <USelectMenu
                          v-model="block.tagCase"
                          :items="tagCaseOptions"
                          value-key="value"
                          label-key="label"
                          class="w-full"
                        />
                      </UFormField>
                    </template>
                  </div>
                </div>
              </VueDraggable>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="ghost" @click="isModalOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton color="primary" @click="handleSaveTemplate" :disabled="!templateForm.name">
                {{ t('common.save') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
