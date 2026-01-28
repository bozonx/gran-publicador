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

const { channel } = defineProps<Props>()
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

const footerOptions = computed(() => {
  const footers = channel.preferences?.footers || []
  const defaultFooter = footers.find(f => f.isDefault)
  const defaultLabel = defaultFooter 
    ? `${t('channel.footerDefault')} (${defaultFooter.name})`
    : t('channel.footerDefault')
    
  return [
    { value: null, label: defaultLabel },
    ...footers.map(f => ({ value: f.id, label: f.name }))
  ]
})

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

const getDefaultBlocks = (): TemplateBlock[] => [
  { enabled: false, insert: 'title', before: '', after: '' },
  { enabled: true, insert: 'content', before: '', after: '' },
  { enabled: true, insert: 'authorComment', before: '', after: '' },
  { enabled: true, insert: 'authorSignature', before: '', after: '' },
  { enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
  { enabled: true, insert: 'custom', before: '', after: '', content: '' },
  { enabled: true, insert: 'footer', before: '', after: '' },
]

const templates = ref<ChannelPostTemplate[]>(channel.preferences?.templates || [])

const isModalOpen = ref(false)
const editingTemplate = ref<ChannelPostTemplate | null>(null)
const templateForm = reactive({
  id: '',
  name: '',
  postType: null as string | null,
  language: null as string | null,
  isDefault: false,
  template: [] as TemplateBlock[]
})

function openAddTemplate() {
  editingTemplate.value = null
  templateForm.id = crypto.randomUUID()
  templateForm.name = ''
  templateForm.postType = null
  templateForm.language = null
  templateForm.isDefault = false
  templateForm.template = getDefaultBlocks()
  isModalOpen.value = true
}

function openEditTemplate(template: ChannelPostTemplate) {
  editingTemplate.value = template
  templateForm.id = template.id
  templateForm.name = template.name
  templateForm.postType = template.postType || null
  templateForm.language = template.language || null
  templateForm.isDefault = !!template.isDefault
  templateForm.template = JSON.parse(JSON.stringify(template.template))
  isModalOpen.value = true
}

async function saveTemplates() {
  const currentPreferences = channel.preferences || {}
  await updateChannel(channel.id, {
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
        isDefault: templateForm.isDefault,
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
      isDefault: templateForm.isDefault,
      template: JSON.parse(JSON.stringify(templateForm.template))
    })
  }

  // If this template is set as default, reset others
  if (templateForm.isDefault) {
     templates.value.forEach(t => {
         if (t.id !== templateForm.id) {
             t.isDefault = false
         }
     })
  }

  saveTemplates()
  isModalOpen.value = false
}

const isDeleteWarningModalOpen = ref(false)
const templateToDeleteId = ref<string | null>(null)
const affectedPostsCount = ref(0)
const isCheckingUsage = ref(false)

async function checkTemplateUsage(id: string): Promise<number> {
    const api = useApi()
    try {
        // Fetch posts for this channel that might need this template
        // We only care about posts that are waiting to be published (PENDING) 
        // and belong to a publication that is SCHEDULED.
        // It's hard to filter deeply via simple API params unless we have a specific endpoint or deep filter support.
        // Let's assume we can fetch PENDING posts for this channel and filter client side for now.
        // Or better: Assume the user doesn't have thousands of pending posts per channel.
        const posts = await api.get<any[]>('/posts', { 
            params: { 
                channelId: channel.id, 
                status: 'PENDING',
                limit: 100 // Limit check to 100 recent pending posts to avoid heavy load
            } 
        })
        
        // Filter those where publication is scheduled and template matches
        const affected = posts.filter(p => {
             // We need publication status. If 'posts' endpoint returns relations, we are good.
             // Based on PostWithRelations it does.
             if (p.publication?.status !== 'SCHEDULED') return false
             
             // Check if post uses this template explicitly
             // p.template is the JSON field.
             const templateData = typeof p.template === 'string' ? JSON.parse(p.template) : p.template
             return templateData?.id === id
        })
        
        return affected.length
    } catch (e) {
        console.error('Failed to check template usage', e)
        return 0
    }
}

const deletedTemplates = ref<ChannelPostTemplate[]>([])
const showDeleted = ref(false)

async function handleDeleteRequest(id: string) {
    templateToDeleteId.value = id
    isCheckingUsage.value = true
    
    const count = await checkTemplateUsage(id)
    affectedPostsCount.value = count
    isCheckingUsage.value = false
    
    isDeleteWarningModalOpen.value = true
}

function confirmDeleteTemplate() {
  if (!templateToDeleteId.value) return
  
  const template = templates.value.find(t => t.id === templateToDeleteId.value)
  if (template) {
      deletedTemplates.value.push({ ...template })
  }
  
  templates.value = templates.value.filter(t => t.id !== templateToDeleteId.value)
  saveTemplates()
  isDeleteWarningModalOpen.value = false
  templateToDeleteId.value = null
}

function restoreTemplate(template: ChannelPostTemplate) {
  templates.value.push({ ...template })
  deletedTemplates.value = deletedTemplates.value.filter(t => t.id !== template.id)
  saveTemplates()
}

function resetBlocks() {
  templateForm.template = getDefaultBlocks()
}

// Watch for external changes to channel
watch(() => channel.preferences?.templates, (newTemplates) => {
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

    <div v-else class="space-y-3">
      <div
        v-for="template in templates"
        :key="template.id"
        class="group flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer group"
        @click="openEditTemplate(template)"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div class="min-w-0">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {{ template.name }}
            </h4>
            <div class="flex items-center gap-2 mt-0.5">
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
        
        <div class="flex items-center gap-1">
          <UIcon 
            v-if="template.isDefault" 
            name="i-heroicons-star-20-solid" 
            class="w-4 h-4 text-primary-500 mr-2" 
          />
          <div class="w-4 h-4 mr-2" v-else></div>

          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click.stop="handleDeleteRequest(template.id)"
          />
        </div>
      </div>

      <!-- Deleted Templates (Session only) -->
      <div v-if="deletedTemplates.length > 0" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="showDeleted ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
          @click="showDeleted = !showDeleted"
        >
          {{ t('channel.deletedTemplates', { count: deletedTemplates.length }) }}
        </UButton>
        
        <div v-if="showDeleted" class="mt-2 space-y-2">
          <div
            v-for="template in deletedTemplates"
            :key="template.id"
            class="flex items-center justify-between py-1.5 px-3 bg-gray-50/30 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
          >
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-gray-400" />
              <div class="text-xs truncate max-w-[200px]">
                <span class="text-gray-500 dark:text-gray-400 italic line-through mr-2">{{ template.name }}</span>
              </div>
            </div>
            <UButton
              icon="i-heroicons-arrow-path"
              size="xs"
              variant="ghost"
              color="primary"
              class="scale-90"
              @click="restoreTemplate(template)"
            >
              {{ t('common.restore', 'Restore') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Edit Modal -->
    <UiAppModal 
      v-model:open="isModalOpen"
      :title="editingTemplate ? t('channel.templateSettings') : t('channel.addTemplate')"
    >

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
                <CommonLanguageSelect
                  v-model="templateForm.language"
                  mode="all"
                  allow-all
                />
              </UFormField>



              <div class="md:col-span-2">
                 <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <USwitch v-model="templateForm.isDefault" size="md" />
                    <div>
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                            {{ t('channel.templateIsDefault') }}
                        </div>
                        <div class="text-xs text-gray-500">
                             {{ t('channel.templateIsDefaultHelp') }}
                        </div>
                    </div>
                 </div>
              </div>
            </div>

            <!-- Blocks Editor -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>{{ t('channel.templateBlocks') }}</span>
                  <CommonInfoTooltip :text="t('channel.templateBlocksTooltip')" />
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

                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">
                      {{ insertOptions.find(o => o.value === block.insert)?.label }}
                    </span>

                    <div class="flex-1"></div>
                  </div>

                  <div class="space-y-4 pt-2" v-if="block.enabled">
                    <template v-if="block.insert !== 'custom'">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UFormField class="w-full">
                          <template #label>
                            <div class="flex items-center gap-1.5">
                              <span>{{ t('channel.templateBefore') }}</span>
                              <CommonInfoTooltip :text="t('channel.templateBeforeTooltip')" />
                            </div>
                          </template>
                          <UTextarea
                            v-model="block.before"
                            :rows="2"
                            class="font-mono text-xs w-full"
                            autoresize
                          />
                          <CommonWhitespaceVisualizer :text="block.before" class="mt-1" />
                        </UFormField>
                        <UFormField class="w-full">
                          <template #label>
                            <div class="flex items-center gap-1.5">
                              <span>{{ t('channel.templateAfter') }}</span>
                              <CommonInfoTooltip :text="t('channel.templateAfterTooltip')" />
                            </div>
                          </template>
                          <UTextarea
                            v-model="block.after"
                            :rows="2"
                            class="font-mono text-xs w-full"
                            autoresize
                          />
                          <CommonWhitespaceVisualizer :text="block.after" class="mt-1" />
                        </UFormField>
                      </div>
                    </template>

                    <template v-if="block.insert === 'tags'">
                      <UFormField :label="t('channel.templateTagCase')" class="w-full">
                        <USelectMenu
                          v-model="block.tagCase"
                          :items="tagCaseOptions"
                          value-key="value"
                          label-key="label"
                          class="w-full"
                        />
                      </UFormField>
                    </template>

                    <template v-if="block.insert === 'footer'">
                      <UFormField :label="t('channel.footers')" class="w-full">
                        <USelectMenu
                          v-model="block.footerId"
                          :items="footerOptions"
                          value-key="value"
                          label-key="label"
                          class="w-full"
                        />
                      </UFormField>
                    </template>

                    <template v-if="block.insert === 'custom'">
                      <UFormField :label="t('channel.templateInsertCustom')" class="w-full">
                        <UTextarea
                          v-model="block.content"
                          :rows="4"
                          class="font-mono text-xs w-full"
                          :placeholder="t('channel.templateInsertCustomPlaceholder')"
                          autoresize
                        />
                        <CommonWhitespaceVisualizer :text="block.content" class="mt-1" />
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
    </UiAppModal>

    <!-- Delete Warning Modal -->
    <UiConfirmModal
      v-model:open="isDeleteWarningModalOpen"
      :title="t('channel.templateUpdateWarning')"
      :description="affectedPostsCount > 0 ? t('channel.templateInUseWarning', { count: affectedPostsCount }, `This template is used in ${affectedPostsCount} scheduled posts. Deleting it will cause these posts to use the default template.`) + '\n\n' + t('common.areYouSure') : t('channel.templateDeleteConfirm')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      @confirm="confirmDeleteTemplate"
    />
  </div>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
