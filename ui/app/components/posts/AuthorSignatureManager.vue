<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
import { containsBlockMarkdown } from '~/utils/markdown-validation'

const props = defineProps<{
  projectId: string
  channelLanguages?: string[]
}>()

const { t } = useI18n()
const { user } = useAuth()
const {
  fetchByProject,
  create,
  update,
  upsertVariant,
  deleteVariant,
  remove,
  isLoading,
} = useAuthorSignatures()

const toast = useToast()

const signatures = ref<ProjectAuthorSignature[]>([])
const isModalOpen = ref(false)
const editingSignature = ref<ProjectAuthorSignature | null>(null)

// Form: map of language → content for variants
const variantForms = reactive<Record<string, string>>({})
const newVariantLanguage = ref('')

// Languages that should have variant fields shown
const activeLanguages = computed(() => {
  const langs = new Set<string>()

  // Always include user language
  if (user.value?.language) langs.add(user.value.language)

  // Include channel languages from the project
  if (props.channelLanguages) {
    props.channelLanguages.forEach(l => langs.add(l))
  }

  // Include languages from existing variants when editing
  if (editingSignature.value) {
    editingSignature.value.variants.forEach(v => langs.add(v.language))
  }

  return Array.from(langs).sort()
})

// Display content: show variant in user's language
function getDisplayContent(sig: ProjectAuthorSignature): string {
  const userLang = user.value?.language || 'en-US'
  const variant = sig.variants.find(v => v.language === userLang) || sig.variants[0]
  return variant?.content || ''
}

// Warnings for missing channel language variants
const missingLanguageWarnings = computed(() => {
  if (!props.channelLanguages || props.channelLanguages.length <= 1) return []

  const warnings: string[] = []

  for (const sig of signatures.value) {
    const variantLangs = new Set(sig.variants.map(v => v.language))

    for (const lang of props.channelLanguages) {
      if (!variantLangs.has(lang)) {
        warnings.push(lang)
      }
    }
  }

  return [...new Set(warnings)]
})

async function loadSignatures() {
  signatures.value = await fetchByProject(props.projectId)
}

onMounted(loadSignatures)

function openAdd() {
  editingSignature.value = null

  // Reset variant forms
  Object.keys(variantForms).forEach(k => delete variantForms[k])

  // Pre-fill user language field
  const userLang = user.value?.language || 'en-US'
  variantForms[userLang] = ''

  // Pre-fill channel languages
  if (props.channelLanguages) {
    props.channelLanguages.forEach(l => {
      if (!variantForms[l]) variantForms[l] = ''
    })
  }

  newVariantLanguage.value = ''
  isModalOpen.value = true
}

function openEdit(sig: ProjectAuthorSignature) {
  editingSignature.value = sig

  // Reset and populate variant forms
  Object.keys(variantForms).forEach(k => delete variantForms[k])

  for (const v of sig.variants) {
    variantForms[v.language] = v.content
  }

  // Ensure all channel languages have a field
  if (props.channelLanguages) {
    props.channelLanguages.forEach(l => {
      if (variantForms[l] === undefined) variantForms[l] = ''
    })
  }

  // Ensure user language has a field
  const userLang = user.value?.language || 'en-US'
  if (variantForms[userLang] === undefined) variantForms[userLang] = ''

  newVariantLanguage.value = ''
  isModalOpen.value = true
}

function addVariantLanguage() {
  const lang = newVariantLanguage.value.trim()
  if (!lang || variantForms[lang] !== undefined) return
  variantForms[lang] = ''
  newVariantLanguage.value = ''
}

async function handleSave() {
  // At least one variant must have content
  const filledVariants = Object.entries(variantForms).filter(([, content]) => content.trim())

  if (filledVariants.length === 0) return

  // Validate inline markdown
  for (const [lang, content] of filledVariants) {
    if (containsBlockMarkdown(content)) {
      toast.add({
        title: t('common.error'),
        description: `${lang}: ${t('validation.inlineMarkdownOnly')}`,
        color: 'error',
      })
      return
    }
  }

  try {
    if (editingSignature.value) {
      // Update existing: upsert each variant, delete removed ones
      const existingLangs = new Set(editingSignature.value.variants.map(v => v.language))

      for (const [lang, content] of Object.entries(variantForms)) {
        if (content.trim()) {
          await upsertVariant(editingSignature.value.id, lang, { content: content.trim() })
        } else if (existingLangs.has(lang)) {
          await deleteVariant(editingSignature.value.id, lang)
        }
      }
    } else {
      // Create new: first variant uses user language
      const userLang = user.value?.language || 'en-US'
      const primaryContent = variantForms[userLang]?.trim()

      if (!primaryContent) {
        toast.add({
          title: t('common.error'),
          description: t('authorSignature.primaryLanguageRequired', 'Content in your language is required'),
          color: 'error',
        })
        return
      }

      const created = await create(props.projectId, { content: primaryContent })

      if (created) {
        // Create additional variants
        for (const [lang, content] of Object.entries(variantForms)) {
          if (lang !== userLang && content.trim()) {
            await upsertVariant(created.id, lang, { content: content.trim() })
          }
        }
      }
    }

    isModalOpen.value = false
    await loadSignatures()
  } catch (error) {
    console.error('Failed to save signature', error)
  }
}

async function handleDelete(id: string) {
  const index = signatures.value.findIndex(sig => sig.id === id)
  if (index !== -1) {
    signatures.value.splice(index, 1)

    try {
      await remove(id)
    } catch (error) {
      console.error('Failed to delete signature', error)
      await loadSignatures()
    }
  }
}

async function handleDragEnd() {
  try {
    let order = 0
    for (const sig of signatures.value) {
      await update(sig.id, { order: order++ })
    }
  } catch (error) {
    console.error('Failed to update order', error)
    await loadSignatures()
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Missing language warnings -->
    <UAlert
      v-if="missingLanguageWarnings.length > 0"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :title="t('authorSignature.missingVariantsWarning', 'Some signatures are missing language variants')"
      :description="t('authorSignature.missingVariantsLanguages', { languages: missingLanguageWarnings.join(', ') })"
    />

    <div v-if="isLoading && signatures.length === 0" class="flex justify-center py-8">
      <UiLoadingSpinner size="md" />
    </div>

    <div v-else-if="signatures.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
      <UIcon name="i-heroicons-pencil-square" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ t('authorSignature.none') }}
      </p>
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        @click="openAdd"
      >
        {{ t('common.add') }}
      </UButton>
    </div>

    <template v-else>
      <div class="flex justify-end mb-2">
        <UButton
          icon="i-heroicons-plus"
          size="xs"
          color="primary"
          variant="soft"
          @click="openAdd"
        >
          {{ t('common.add') }}
        </UButton>
      </div>

      <VueDraggable
        v-model="signatures"
        :animation="150"
        handle=".drag-handle"
        class="space-y-3"
        @end="handleDragEnd"
      >
        <div
          v-for="sig in signatures"
          :key="sig.id"
          class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer group"
          @click="openEdit(sig)"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <div
              class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              @click.stop
            >
              <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                {{ getDisplayContent(sig) }}
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  v-for="v in sig.variants"
                  :key="v.language"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  {{ v.language }}
                </span>
                <span v-if="sig.user && sig.userId !== user?.id" class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 ml-1">
                  <UIcon name="i-heroicons-user" class="w-3 h-3" />
                  {{ sig.user.fullName || sig.user.telegramUsername || sig.userId }}
                </span>
              </div>
            </div>
          </div>
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click.stop="handleDelete(sig.id)"
          />
        </div>
      </VueDraggable>
    </template>

    <!-- Edit/Create Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingSignature ? t('common.edit') : t('common.add')"
    >
      <div class="space-y-4">
        <UFormField
          v-for="lang in activeLanguages"
          :key="lang"
        >
          <template #label>
            <span class="inline-flex items-center">
              {{ lang }}
              <CommonInfoTooltip :text="t('common.inlineMarkdownHelp')" class="ml-1.5" />
            </span>
          </template>
          <UTextarea
            v-model="variantForms[lang]"
            placeholder="[Click here](https://example.com)"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- Add another language -->
        <div class="flex items-center gap-2">
          <UInput
            v-model="newVariantLanguage"
            :placeholder="t('authorSignature.addLanguagePlaceholder', 'e.g. de-DE')"
            size="sm"
            class="flex-1"
            @keyup.enter="addVariantLanguage"
          />
          <UButton
            icon="i-heroicons-plus"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="!newVariantLanguage.trim()"
            @click="addVariantLanguage"
          >
            {{ t('authorSignature.addLanguage', 'Add language') }}
          </UButton>
        </div>
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isLoading"
          :disabled="!Object.values(variantForms).some(v => v.trim())"
          @click="handleSave"
        >
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
