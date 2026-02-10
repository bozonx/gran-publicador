<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { ProjectTemplate, TemplateBlock, ChannelTemplateVariation, BlockOverride, ChannelWithProject } from '~/types/channels'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import CommonInfoTooltip from '~/components/common/CommonInfoTooltip.vue'
import { getSocialMediaIcon } from '~/utils/socialMedia'
import AppTabs from '~/components/ui/AppTabs.vue'

interface Props {
  projectId: string
  readonly?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const toast = useToast()
const api = useApi()

const {
  templates,
  isLoading,
  fetchProjectTemplates,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  reorderProjectTemplates,
} = useProjectTemplates()

const { fetchChannels } = useChannels()
const { languageOptions } = useLanguages()

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

// ─── State ──────────────────────────────────────────────────────────
const isModalOpen = ref(false)
const editingTemplate = ref<ProjectTemplate | null>(null)
const isCreating = ref(false)

// Active tab: 'project' or channel id
const activeTab = ref<string>('project')

// Autosave form data for project-level template
const templateForm = ref({
  id: '',
  name: '',
  postType: null as string | null,
  isDefault: false,
  language: 'ru-RU',
  template: [] as TemplateBlock[],
})

// Channel overrides state: channelId -> { excluded, overrides }
const channelOverridesMap = ref<Record<string, { excluded: boolean; overrides: Record<string, BlockOverride> }>>({})

// ─── Channels for template language ─────────────────────────────────
const projectChannels = ref<ChannelWithProject[]>([])

const filteredChannels = computed(() => {
  return projectChannels.value.filter(ch =>
    ch.language === templateForm.value.language && !ch.archivedAt
  )
})

// ─── Tab items ──────────────────────────────────────────────────────
const tabItems = computed(() => {
  const items: Array<{ value: string; label: string; icon?: string }> = [
    { value: 'project', label: t('projectTemplates.projectTab'), icon: 'i-heroicons-cog-6-tooth' },
  ]
  filteredChannels.value.forEach(ch => {
    const isExcluded = channelOverridesMap.value[ch.id]?.excluded
    items.push({
      value: ch.id,
      label: ch.name + (isExcluded ? ` (${t('common.disabled')})` : ''),
      icon: getSocialMediaIcon(ch.socialMedia),
    })
  })
  return items
})

// ─── Autosave for project template ──────────────────────────────────
const { saveStatus, saveError, forceSave, isIndicatorVisible, indicatorStatus, retrySave, syncBaseline } = useAutosave({
  data: templateForm,
  saveFn: async (data) => {
    if (!data.id || !data.name) return { saved: false, skipped: true }
    await updateProjectTemplate(props.projectId, data.id, {
      name: data.name,
      postType: data.postType,
      isDefault: data.isDefault,
      language: data.language,
      template: data.template,
    })
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
  enableNavigationGuards: false,
})

// ─── Data loading ───────────────────────────────────────────────────
onMounted(async () => {
  await fetchProjectTemplates(props.projectId)
  projectChannels.value = await fetchChannels({ projectId: props.projectId, limit: 100 })
})

// ─── Create and open ────────────────────────────────────────────────
async function handleCreate() {
  isCreating.value = true
  try {
    // Determine default language from project channels
    const defaultLang = projectChannels.value.find(ch => !ch.archivedAt)?.language || 'ru-RU'

    const result = await createProjectTemplate(props.projectId, {
      name: t('projectTemplates.newTemplateName'),
      isDefault: templates.value.length === 0,
      language: defaultLang,
      template: getDefaultBlocks(),
    })
    if (result) {
      await fetchProjectTemplates(props.projectId)
      openEditModal(result)
    }
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.message || 'Failed to create template',
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

// ─── Open edit modal ────────────────────────────────────────────────
function openEditModal(tpl: ProjectTemplate) {
  editingTemplate.value = tpl
  templateForm.value = {
    id: tpl.id,
    name: tpl.name,
    postType: tpl.postType || null,
    isDefault: !!tpl.isDefault,
    language: tpl.language || 'ru-RU',
    template: JSON.parse(JSON.stringify(tpl.template)),
  }
  activeTab.value = 'project'

  // Load channel overrides for this template
  loadChannelOverrides(tpl.id)

  isModalOpen.value = true

  nextTick(() => {
    syncBaseline()
  })
}

// ─── Channel overrides loading ──────────────────────────────────────
function loadChannelOverrides(templateId: string) {
  const map: Record<string, { excluded: boolean; overrides: Record<string, BlockOverride> }> = {}

  projectChannels.value.forEach(ch => {
    const prefs = ch.preferences?.templates || []
    const variation = prefs.find(v => v.projectTemplateId === templateId)
    map[ch.id] = {
      excluded: variation?.excluded ?? false,
      overrides: variation?.overrides ? JSON.parse(JSON.stringify(variation.overrides)) : {},
    }
  })

  channelOverridesMap.value = map
}

// ─── Channel override save (debounced per channel) ──────────────────
const channelSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function scheduleChannelSave(channelId: string) {
  if (channelSaveTimers[channelId]) clearTimeout(channelSaveTimers[channelId])
  channelSaveTimers[channelId] = setTimeout(() => {
    saveChannelOverrides(channelId)
  }, AUTO_SAVE_DEBOUNCE_MS)
}

async function saveChannelOverrides(channelId: string) {
  const channel = projectChannels.value.find(ch => ch.id === channelId)
  if (!channel || !editingTemplate.value) return

  const templateId = editingTemplate.value.id
  const overrideData = channelOverridesMap.value[channelId]
  if (!overrideData) return

  const currentPrefs = channel.preferences || {}
  const currentVariations: ChannelTemplateVariation[] = currentPrefs.templates || []

  // Find or create variation for this template
  const existingIdx = currentVariations.findIndex(v => v.projectTemplateId === templateId)
  const variation: ChannelTemplateVariation = {
    id: templateId,
    name: editingTemplate.value.name,
    order: existingIdx >= 0 ? currentVariations[existingIdx]!.order : currentVariations.length,
    projectTemplateId: templateId,
    excluded: overrideData.excluded,
    overrides: overrideData.overrides,
  }

  let updatedVariations: ChannelTemplateVariation[]
  if (existingIdx >= 0) {
    updatedVariations = [...currentVariations]
    updatedVariations[existingIdx] = variation
  } else {
    updatedVariations = [...currentVariations, variation]
  }

  try {
    await api.patch(`/channels/${channelId}`, {
      preferences: {
        ...currentPrefs,
        templates: updatedVariations,
      },
    })

    // Keep local state in sync so switching tabs / reopening modal reflects saved data
    const chIdx = projectChannels.value.findIndex(ch => ch.id === channelId)
    if (chIdx !== -1) {
      projectChannels.value[chIdx] = {
        ...projectChannels.value[chIdx]!,
        preferences: {
          ...currentPrefs,
          templates: updatedVariations,
        },
      }
    }
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.message || 'Failed to save channel overrides',
      color: 'error',
    })
  }
}

// ─── Channel override helpers ───────────────────────────────────────
function getOverrideValue(channelId: string, blockInsert: string, field: keyof BlockOverride): string {
  return (channelOverridesMap.value[channelId]?.overrides[blockInsert]?.[field] as string) ?? ''
}

function setOverrideValue(channelId: string, blockInsert: string, field: keyof BlockOverride, value: string) {
  if (!channelOverridesMap.value[channelId]) {
    channelOverridesMap.value[channelId] = { excluded: false, overrides: {} }
  }
  const overrides = channelOverridesMap.value[channelId]!.overrides
  if (!overrides[blockInsert]) {
    overrides[blockInsert] = {}
  }
  if (value === '') {
    delete overrides[blockInsert]![field]
    if (Object.keys(overrides[blockInsert]!).length === 0) {
      delete overrides[blockInsert]
    }
  } else {
    (overrides[blockInsert] as any)[field] = value
  }
  scheduleChannelSave(channelId)
}

function toggleChannelExcluded(channelId: string) {
  if (!channelOverridesMap.value[channelId]) {
    channelOverridesMap.value[channelId] = { excluded: false, overrides: {} }
  }
  channelOverridesMap.value[channelId]!.excluded = !channelOverridesMap.value[channelId]!.excluded
  scheduleChannelSave(channelId)
}

function isChannelExcluded(channelId: string): boolean {
  return channelOverridesMap.value[channelId]?.excluded ?? false
}

// ─── Close modal ────────────────────────────────────────────────────
async function handleCloseModal() {
  // Force save pending project template changes
  await forceSave()

  // Flush pending channel saves
  for (const channelId of Object.keys(channelSaveTimers)) {
    clearTimeout(channelSaveTimers[channelId])
    await saveChannelOverrides(channelId)
  }

  isModalOpen.value = false
  editingTemplate.value = null

  // Refresh templates list
  await fetchProjectTemplates(props.projectId)
}

// ─── Delete ─────────────────────────────────────────────────────────
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
  isModalOpen.value = false
  editingTemplate.value = null
}

// ─── Reorder ────────────────────────────────────────────────────────
async function handleDragEnd() {
  const ids = templates.value.map(t => t.id)
  await reorderProjectTemplates(props.projectId, ids)
}

function resetBlocks() {
  templateForm.value.template = getDefaultBlocks()
}

// ─── Enabled blocks for channel tabs ────────────────────────────────
const enabledBlocks = computed(() => {
  return templateForm.value.template.filter(b => b.enabled)
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="isLoading && templates.length === 0" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="templates.length === 0" class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-document-text" class="w-10 h-10 mx-auto text-gray-400 mb-3" />
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
        {{ t('projectTemplates.empty') }}
      </p>
      <UButton
        v-if="!readonly"
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        :loading="isCreating"
        @click="handleCreate"
      >
        {{ t('projectTemplates.add') }}
      </UButton>
    </div>

    <div v-else>
      <div class="flex justify-end mb-4">
        <UButton
          v-if="!readonly"
          icon="i-heroicons-plus"
          size="sm"
          color="primary"
          variant="soft"
          :loading="isCreating"
          @click="handleCreate"
        >
          {{ t('projectTemplates.add') }}
        </UButton>
      </div>

      <VueDraggable
        v-model="templates"
        :disabled="!!readonly"
        handle=".drag-handle"
        @end="handleDragEnd"
      >
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-2 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click="openEditModal(tpl)"
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
                {{ t('common.default') }}
              </UBadge>
              <UBadge v-if="tpl.postType" color="neutral" variant="subtle" size="xs">
                {{ tpl.postType }}
              </UBadge>
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ languageOptions.find(l => l.value === tpl.language)?.label || tpl.language }}
              </UBadge>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ tpl.template.filter((b: TemplateBlock) => b.enabled).length }} {{ t('projectTemplates.activeBlocks') }}
            </p>
          </div>
        </div>
      </VueDraggable>
    </div>

    <!-- Template Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="t('projectTemplates.edit')"
      :ui="{ content: 'w-[90vw] max-w-4xl' }"
      :prevent-close="saveStatus === 'saving'"
    >
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ t('projectTemplates.edit') }}
          </span>
          <UiSaveStatusIndicator
            :status="indicatorStatus"
            :visible="isIndicatorVisible"
            :error="saveError"
            show-retry
            @retry="retrySave"
          />
        </div>
      </template>

      <div class="space-y-4">
        <!-- Tabs -->
        <AppTabs
          :items="tabItems.map(i => ({ id: i.value, label: i.label, icon: i.icon }))"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        >
          <template #tab="{ item, selected, select }">
            <UTooltip :text="item.label">
              <UButton
                :variant="selected ? 'soft' : 'ghost'"
                :color="selected ? 'primary' : 'neutral'"
                size="sm"
                class="transition-all duration-200"
                @click="select"
              >
                <template v-if="item.icon" #leading>
                  <UIcon :name="item.icon" class="w-4 h-4" />
                </template>
                <span v-if="item.id === 'project'">{{ item.label }}</span>
              </UButton>
            </UTooltip>
          </template>
        </AppTabs>

        <!-- Project Tab -->
        <div v-if="activeTab === 'project'" class="space-y-6">
          <!-- Basic fields -->
          <div class="space-y-4">
            <UFormField :label="t('channel.templateName')" required>
              <UInput
                v-model="templateForm.name"
                :placeholder="t('projectTemplates.namePlaceholder')"
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UFormField :label="t('projectTemplates.language')">
                <USelectMenu
                  v-model="templateForm.language"
                  :items="languageOptions"
                  value-key="value"
                  label-key="label"
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

              <div
                class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors self-end"
                @click="templateForm.isDefault = !templateForm.isDefault"
              >
                <UCheckbox v-model="templateForm.isDefault" @click.stop />
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {{ t('channel.templateIsDefault') }}
                  </div>
                  <div class="text-xxs text-gray-500 truncate">
                    {{ t('channel.templateIsDefaultHelp') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Template Blocks (no text fields, only drag + toggle) -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-gray-900 dark:text-white">{{ t('channel.templateBlocks') }}</h4>
                <CommonInfoTooltip
                  :text="t('projectTemplates.blocksHint')"
                  placement="bottom"
                />
              </div>
              <UButton size="xs" variant="ghost" color="neutral" @click="resetBlocks">
                {{ t('channel.templateReset') }}
              </UButton>
            </div>

            <VueDraggable v-model="templateForm.template" handle=".block-drag-handle">
              <div
                v-for="(block, idx) in templateForm.template"
                :key="idx"
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2 bg-white dark:bg-gray-800 transition-all"
                :class="{ 'opacity-50 grayscale-[0.5]': !block.enabled, 'ring-1 ring-primary-500/10 border-primary-500/20': block.enabled }"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-bars-3" class="block-drag-handle w-5 h-5 text-gray-400 cursor-grab hover:text-gray-600 dark:hover:text-gray-200 transition-colors" />
                  <UCheckbox v-model="block.enabled" color="primary" />
                  <div class="flex-1 text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    {{ insertOptions.find(o => o.value === block.insert)?.label || block.insert }}
                  </div>
                </div>
              </div>
            </VueDraggable>
          </div>

        </div>

        <!-- Channel Tab -->
        <div v-else class="space-y-4">
          <template v-if="filteredChannels.find(ch => ch.id === activeTab)">
            <!-- Exclude channel toggle -->
            <div
              class="flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer"
              :class="isChannelExcluded(activeTab)
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'"
              @click="toggleChannelExcluded(activeTab)"
            >
              <UCheckbox :model-value="isChannelExcluded(activeTab)" color="error" @click.stop="toggleChannelExcluded(activeTab)" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium" :class="isChannelExcluded(activeTab) ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'">
                  {{ t('projectTemplates.excludeChannel') }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ t('projectTemplates.excludeChannelHelp') }}
                </div>
              </div>
            </div>

            <!-- Block overrides (only if not excluded) -->
            <div v-if="!isChannelExcluded(activeTab)" class="space-y-4">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('channel.textOverridesHelp') }}
              </p>

              <div
                v-for="block in enabledBlocks"
                :key="block.insert"
                class="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ insertOptions.find(o => o.value === block.insert)?.label }}
                  </span>
                </div>

                <div class="space-y-2">
                  <!-- Before/After overrides for non-custom blocks -->
                  <template v-if="block.insert !== 'custom' && block.insert !== 'footer'">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <UFormField :label="t('channel.templateBefore')" class="w-full">
                        <UTextarea
                          :model-value="getOverrideValue(activeTab, block.insert, 'before')"
                          :rows="1"
                          class="font-mono text-xs w-full"
                          :placeholder="block.before || t('channel.noOverride')"
                          autoresize
                          @update:model-value="(v: string) => setOverrideValue(activeTab, block.insert, 'before', v)"
                        />
                      </UFormField>
                      <UFormField :label="t('channel.templateAfter')" class="w-full">
                        <UTextarea
                          :model-value="getOverrideValue(activeTab, block.insert, 'after')"
                          :rows="1"
                          class="font-mono text-xs w-full"
                          :placeholder="block.after || t('channel.noOverride')"
                          autoresize
                          @update:model-value="(v: string) => setOverrideValue(activeTab, block.insert, 'after', v)"
                        />
                      </UFormField>
                    </div>
                  </template>

                  <!-- Tag case override -->
                  <template v-if="block.insert === 'tags'">
                    <UFormField :label="t('channel.templateTagCase')" class="w-full">
                      <USelectMenu
                        :model-value="getOverrideValue(activeTab, block.insert, 'tagCase') || block.tagCase || 'none'"
                        :items="tagCaseOptions"
                        value-key="value"
                        label-key="label"
                        class="w-full"
                        @update:model-value="(v: string) => setOverrideValue(activeTab, block.insert, 'tagCase', v === (block.tagCase || 'none') ? '' : v)"
                      />
                    </UFormField>
                  </template>

                  <!-- Content override for custom/footer blocks -->
                  <template v-if="block.insert === 'custom' || block.insert === 'footer'">
                    <UFormField :label="block.insert === 'footer' ? t('projectTemplates.footerContent') : t('channel.templateInsertCustom')" class="w-full">
                      <UTextarea
                        :model-value="getOverrideValue(activeTab, block.insert, 'content')"
                        :rows="2"
                        class="font-mono text-xs w-full"
                        :placeholder="block.content || t('channel.noOverride')"
                        autoresize
                        @update:model-value="(v: string) => setOverrideValue(activeTab, block.insert, 'content', v)"
                      />
                    </UFormField>
                  </template>
                </div>
              </div>

              <div v-if="enabledBlocks.length === 0" class="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                {{ t('projectTemplates.noEnabledBlocks') }}
              </div>
            </div>
          </template>

          <!-- No channels for this language -->
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-language" class="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p class="text-sm">{{ t('projectTemplates.noChannelsForLanguage') }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <UButton
              v-if="templateForm.id"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="handleDeleteRequest(templateForm.id)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
          <UButton
            color="primary"
            @click="handleCloseModal"
          >
            {{ t('projectTemplates.done') }}
          </UButton>
        </div>
      </template>
    </UiAppModal>

    <!-- Delete Confirmation -->
    <UiConfirmModal
      v-model:open="showDeleteModal"
      :title="t('projectTemplates.deleteTitle')"
      :description="t('projectTemplates.deleteWarning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      @confirm="confirmDelete"
    />
  </div>
</template>
