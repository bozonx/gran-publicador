<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'

import type {
  ChannelWithProject,
  ChannelTemplateVariation,
  ProjectTemplate,
  TemplateBlock,
  BlockOverride,
} from '~/types/channels'
import { containsBlockMarkdown } from '~/utils/markdown-validation'

interface Props {
  channel: ChannelWithProject
}

const { channel } = defineProps<Props>()
const { t } = useI18n()
const toast = useToast()
const { updateChannel } = useChannels()

const {
  templates: projectTemplates,
  fetchProjectTemplates,
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

const variations = ref<ChannelTemplateVariation[]>(channel.preferences?.templates || [])

onMounted(() => {
  if (channel.projectId) {
    fetchProjectTemplates(channel.projectId)
  }
})

// Project templates available for creating new variations
const availableProjectTemplates = computed(() => {
  const existingPtIds = new Set(variations.value.map(v => v.projectTemplateId))
  return projectTemplates.value.filter(pt => !existingPtIds.has(pt.id))
})

const projectTemplateSelectOptions = computed(() =>
  availableProjectTemplates.value.map(pt => ({
    value: pt.id,
    label: pt.name + (pt.postType ? ` (${pt.postType})` : ''),
  }))
)

// Find project template by id
function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return projectTemplates.value.find(pt => pt.id === id)
}

// Modal state
const isModalOpen = ref(false)
const editingVariation = ref<ChannelTemplateVariation | null>(null)

const variationForm = reactive({
  id: '',
  name: '',
  isDefault: false,
  projectTemplateId: '',
  overrides: {} as Record<string, BlockOverride>,
})

function openAddVariation() {
  editingVariation.value = null
  variationForm.id = crypto.randomUUID()
  variationForm.name = ''
  variationForm.isDefault = variations.value.length === 0
  variationForm.projectTemplateId = ''
  variationForm.overrides = {}
  isModalOpen.value = true
}

function openEditVariation(variation: ChannelTemplateVariation) {
  editingVariation.value = variation
  variationForm.id = variation.id
  variationForm.name = variation.name
  variationForm.isDefault = !!variation.isDefault
  variationForm.projectTemplateId = variation.projectTemplateId
  variationForm.overrides = JSON.parse(JSON.stringify(variation.overrides || {}))
  isModalOpen.value = true
}

// Get effective block value (project template value merged with override)
function getOverrideValue(blockInsert: string, field: keyof BlockOverride): string {
  return (variationForm.overrides[blockInsert]?.[field] as string) ?? ''
}

function setOverrideValue(blockInsert: string, field: keyof BlockOverride, value: string) {
  if (!variationForm.overrides[blockInsert]) {
    variationForm.overrides[blockInsert] = {}
  }
  if (value === '') {
    delete variationForm.overrides[blockInsert]![field]
    // Clean up empty override objects
    if (Object.keys(variationForm.overrides[blockInsert]!).length === 0) {
      delete variationForm.overrides[blockInsert]
    }
  } else {
    (variationForm.overrides[blockInsert] as any)[field] = value
  }
}

// Blocks from the selected project template (read-only structure)
const selectedProjectTemplateBlocks = computed((): TemplateBlock[] => {
  if (!variationForm.projectTemplateId) return []
  const pt = getProjectTemplate(variationForm.projectTemplateId)
  return pt?.template || []
})

async function saveVariations() {
  const currentPreferences = channel.preferences || {}
  await updateChannel(channel.id, {
    preferences: {
      ...currentPreferences,
      templates: variations.value,
    },
  })
}

function handleSaveVariation() {
  if (!variationForm.name || !variationForm.projectTemplateId) return

  // Validate override text fields
  for (const [, override] of Object.entries(variationForm.overrides)) {
    if (containsBlockMarkdown(override.before || '') ||
        containsBlockMarkdown(override.after || '') ||
        containsBlockMarkdown(override.content || '')) {
      toast.add({
        title: t('common.error'),
        description: t('validation.inlineMarkdownOnly'),
        color: 'error',
      })
      return
    }
  }

  if (editingVariation.value) {
    const index = variations.value.findIndex(v => v.id === variationForm.id)
    if (index !== -1) {
      variations.value[index] = {
        id: variationForm.id,
        name: variationForm.name,
        order: variations.value[index]!.order,
        isDefault: variationForm.isDefault,
        projectTemplateId: variationForm.projectTemplateId,
        overrides: JSON.parse(JSON.stringify(variationForm.overrides)),
      }
    }
  } else {
    variations.value.push({
      id: variationForm.id,
      name: variationForm.name,
      order: variations.value.length,
      isDefault: variationForm.isDefault,
      projectTemplateId: variationForm.projectTemplateId,
      overrides: JSON.parse(JSON.stringify(variationForm.overrides)),
    })
  }

  // If this variation is set as default, reset others
  if (variationForm.isDefault) {
    variations.value.forEach(v => {
      if (v.id !== variationForm.id) v.isDefault = false
    })
  }

  saveVariations()
  isModalOpen.value = false
}

const isDeleteModalOpen = ref(false)
const variationToDeleteId = ref<string | null>(null)

function handleDeleteRequest(id: string) {
  variationToDeleteId.value = id
  isDeleteModalOpen.value = true
}

function confirmDelete() {
  if (!variationToDeleteId.value) return
  variations.value = variations.value.filter(v => v.id !== variationToDeleteId.value)
  saveVariations()
  isDeleteModalOpen.value = false
  variationToDeleteId.value = null
}

// Watch for external changes to channel
watch(() => channel.preferences?.templates, (newTemplates) => {
  if (newTemplates) {
    variations.value = newTemplates
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
          {{ t('channel.variationSectionDesc', 'Channel-specific variations of project templates. Override text fields for localization.') }}
        </p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        :disabled="availableProjectTemplates.length === 0 && !editingVariation"
        @click="openAddVariation"
      >
        {{ t('channel.addVariation', 'Add Variation') }}
      </UButton>
    </div>

    <!-- No project templates warning -->
    <div v-if="projectTemplates.length === 0" class="text-center py-8 border-2 border-dashed border-amber-200 dark:border-amber-700 rounded-xl bg-amber-50/50 dark:bg-amber-900/10">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 mx-auto text-amber-500 mb-2" />
      <p class="text-sm text-amber-700 dark:text-amber-400 max-w-xs mx-auto">
        {{ t('channel.noProjectTemplates', 'No project templates found. Create templates in project settings first.') }}
      </p>
    </div>

    <div v-else-if="variations.length === 0" class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-document-text" class="w-10 h-10 mx-auto text-gray-400 mb-3" />
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        {{ t('channel.noVariations', 'No template variations yet. Create one to customize how project templates appear in this channel.') }}
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="variation in variations"
        :key="variation.id"
        class="group flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer"
        @click="openEditVariation(variation)"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div class="min-w-0">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {{ variation.name }}
            </h4>
            <div class="flex items-center gap-2 mt-0.5">
              <UBadge size="xs" color="neutral" variant="subtle">
                {{ getProjectTemplate(variation.projectTemplateId)?.name || t('common.unknown') }}
              </UBadge>
              <span v-if="variation.overrides && Object.keys(variation.overrides).length > 0" class="text-xs text-gray-400">
                {{ Object.keys(variation.overrides).length }} {{ t('channel.overrides', 'overrides') }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <UIcon
            v-if="variation.isDefault"
            name="i-heroicons-star-20-solid"
            class="w-4 h-4 text-primary-500 mr-2"
          />
          <div v-else class="w-4 h-4 mr-2" />

          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click.stop="handleDeleteRequest(variation.id)"
          />
        </div>
      </div>
    </div>

    <!-- Variation Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingVariation ? t('channel.editVariation', 'Edit Variation') : t('channel.addVariation', 'Add Variation')"
    >
      <div class="space-y-6 max-h-[70vh] overflow-y-auto">
        <!-- Basic info -->
        <UFormField :label="t('channel.templateName')" required>
          <UInput
            v-model="variationForm.name"
            :placeholder="t('channel.variationNamePlaceholder', 'e.g. English version, Short format...')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('channel.projectTemplate', 'Project Template')" required>
          <USelectMenu
            v-model="variationForm.projectTemplateId"
            :items="editingVariation
              ? projectTemplates.map(pt => ({ value: pt.id, label: pt.name + (pt.postType ? ` (${pt.postType})` : '') }))
              : projectTemplateSelectOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            :disabled="!!editingVariation"
          />
        </UFormField>

        <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
          <USwitch v-model="variationForm.isDefault" size="md" />
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('channel.templateIsDefault') }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t('channel.templateIsDefaultHelp') }}
            </div>
          </div>
        </div>

        <!-- Overrides Editor -->
        <div v-if="selectedProjectTemplateBlocks.length > 0" class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            {{ t('channel.textOverrides', 'Text Overrides') }}
          </h4>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('channel.textOverridesHelp', 'Override text fields from the project template for this channel. Leave empty to use the project template value.') }}
          </p>

          <div
            v-for="block in selectedProjectTemplateBlocks"
            :key="block.insert"
            class="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
            :class="{ 'opacity-50': !block.enabled }"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ insertOptions.find(o => o.value === block.insert)?.label }}
              </span>
              <UBadge v-if="!block.enabled" size="xs" color="neutral" variant="subtle">
                {{ t('common.disabled') }}
              </UBadge>
            </div>

            <div v-if="block.enabled" class="space-y-2">
              <!-- Before/After overrides for non-custom blocks -->
              <template v-if="block.insert !== 'custom'">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <UFormField :label="t('channel.templateBefore')" class="w-full">
                    <UTextarea
                      :model-value="getOverrideValue(block.insert, 'before')"
                      :rows="1"
                      class="font-mono text-xs w-full"
                      :placeholder="block.before || t('channel.noOverride', '(no override)')"
                      autoresize
                      @update:model-value="(v: string) => setOverrideValue(block.insert, 'before', v)"
                    />
                  </UFormField>
                  <UFormField :label="t('channel.templateAfter')" class="w-full">
                    <UTextarea
                      :model-value="getOverrideValue(block.insert, 'after')"
                      :rows="1"
                      class="font-mono text-xs w-full"
                      :placeholder="block.after || t('channel.noOverride', '(no override)')"
                      autoresize
                      @update:model-value="(v: string) => setOverrideValue(block.insert, 'after', v)"
                    />
                  </UFormField>
                </div>
              </template>

              <!-- Tag case override -->
              <template v-if="block.insert === 'tags'">
                <UFormField :label="t('channel.templateTagCase')" class="w-full">
                  <USelectMenu
                    :model-value="getOverrideValue(block.insert, 'tagCase') || block.tagCase || 'none'"
                    :items="tagCaseOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                    @update:model-value="(v: string) => setOverrideValue(block.insert, 'tagCase', v === (block.tagCase || 'none') ? '' : v)"
                  />
                </UFormField>
              </template>

              <!-- Content override for custom/footer blocks -->
              <template v-if="block.insert === 'custom' || block.insert === 'footer'">
                <UFormField :label="block.insert === 'footer' ? t('projectTemplates.footerContent', 'Footer text') : t('channel.templateInsertCustom')" class="w-full">
                  <UTextarea
                    :model-value="getOverrideValue(block.insert, 'content')"
                    :rows="2"
                    class="font-mono text-xs w-full"
                    :placeholder="block.content || t('channel.noOverride', '(no override)')"
                    autoresize
                    @update:model-value="(v: string) => setOverrideValue(block.insert, 'content', v)"
                  />
                </UFormField>
              </template>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="isModalOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :disabled="!variationForm.name || !variationForm.projectTemplateId"
            @click="handleSaveVariation"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UiAppModal>

    <!-- Delete Confirmation -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('channel.templateDeleteConfirm', 'Delete Variation')"
      :description="t('channel.variationDeleteDesc', 'Are you sure you want to delete this channel variation?')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
