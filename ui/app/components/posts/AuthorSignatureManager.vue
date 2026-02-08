<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
import { containsBlockMarkdown } from '~/utils/markdown-validation'
import { useLanguages } from '~/composables/useLanguages'

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

const { getLanguageLabel } = useLanguages()

const toast = useToast()

const signatures = ref<ProjectAuthorSignature[]>([])
const isModalOpen = ref(false)
const editingSignature = ref<ProjectAuthorSignature | null>(null)

// Form: list of language variants
interface LocalVariant {
  language: string
  content: string
}
const localVariants = ref<LocalVariant[]>([])

// Display content: show variant in user's language
function getDisplayContent(sig: ProjectAuthorSignature): string {
  const userLang = user.value?.language || 'en-US'
  const variant = sig.variants.find(v => v.language === userLang) || sig.variants[0]
  return variant?.content || ''
}

const availableLanguages = computed(() => {
  if (!props.channelLanguages) return []
  const currentLangs = new Set(localVariants.value.map(v => v.language))
  return props.channelLanguages.filter(lang => !currentLangs.has(lang))
})

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

function getMissingLanguages(sig: ProjectAuthorSignature): string[] {
  if (!props.channelLanguages) return []
  const variantLangs = new Set(sig.variants.map(v => v.language))
  return props.channelLanguages.filter(lang => !variantLangs.has(lang))
}

async function loadSignatures() {
  signatures.value = await fetchByProject(props.projectId)
}

onMounted(loadSignatures)

function openAdd() {
  editingSignature.value = null
  
  const userLang = user.value?.language || 'en-US'
  localVariants.value = [{ language: userLang, content: '' }]

  isModalOpen.value = true
}

function openEdit(sig: ProjectAuthorSignature) {
  editingSignature.value = sig
  localVariants.value = sig.variants.map(v => ({ language: v.language, content: v.content }))

  isModalOpen.value = true
}

function addVariant(language?: string) {
  localVariants.value.push({ language: language || 'en-US', content: '' })
}

function removeVariant(index: number) {
  localVariants.value.splice(index, 1)
}

async function handleSave() {
  const filledVariants = localVariants.value.filter(v => v.content.trim())

  if (filledVariants.length === 0) return

  // Validate unique languages
  const langs = filledVariants.map(v => v.language)
  if (new Set(langs).size !== langs.length) {
    toast.add({
      title: t('common.error'),
      description: t('authorSignature.duplicateLanguages', 'Duplicate languages are not allowed'),
      color: 'error',
    })
    return
  }

  // Validate inline markdown
  for (const variant of filledVariants) {
    if (containsBlockMarkdown(variant.content)) {
      toast.add({
        title: t('common.error'),
        description: `${variant.language}: ${t('validation.inlineMarkdownOnly')}`,
        color: 'error',
      })
      return
    }
  }

  try {
    if (editingSignature.value) {
      // Update existing
      const existingLangs = new Set(editingSignature.value.variants.map(v => v.language))
      const newLangs = new Set(filledVariants.map(v => v.language))

      // Upsert current ones
      for (const variant of filledVariants) {
        await upsertVariant(editingSignature.value.id, variant.language, { content: variant.content.trim() })
      }

      // Delete removed ones
      for (const lang of existingLangs) {
        if (!newLangs.has(lang)) {
          await deleteVariant(editingSignature.value.id, lang)
        }
      }
    } else {
      // Create new
      const userLang = user.value?.language || 'en-US'
      
      // Try to find a variant with user's language as primary
      let primaryIndex = filledVariants.findIndex(v => v.language === userLang)
      if (primaryIndex === -1) primaryIndex = 0
      
      const primary = filledVariants[primaryIndex]!
      const created = await create(props.projectId, { 
        content: primary.content.trim(),
        language: primary.language
      })

      if (created) {
        // Create additional variants
        for (let i = 0; i < filledVariants.length; i++) {
          if (i === primaryIndex) continue
          const v = filledVariants[i]!
          await upsertVariant(created.id, v.language, { content: v.content.trim() })
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
                <span
                  v-for="lang in getMissingLanguages(sig)"
                  :key="lang"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-dashed border-yellow-400 dark:border-yellow-600"
                >
                  {{ lang }}
                </span>
                <span v-if="sig.user && sig.userId !== user?.id" class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 ml-1">
                  <UIcon name="i-heroicons-user" class="w-3 h-3" />
                  {{ sig.user.fullName || sig.user.telegramUsername || sig.userId }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </VueDraggable>
    </template>

    <!-- Edit/Create Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingSignature ? t('common.edit') : t('common.add')"
    >
      <div class="space-y-6">
        <div
          v-for="(v, index) in localVariants"
          :key="index"
          class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-4 relative group/variant"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 max-w-[220px]">
              <CommonLanguageSelect
                v-model="v.language"
                size="sm"
                searchable
                variant="outline"
              />
            </div>
            <UButton
              v-if="localVariants.length > 1"
              icon="i-heroicons-trash"
              size="xs"
              variant="ghost"
              color="error"
              class="opacity-0 group-hover/variant:opacity-100 transition-opacity"
              @click="removeVariant(index)"
            />
          </div>
          <UTextarea
            v-model="v.content"
            :placeholder="t('post.authorSignaturePlaceholder')"
            :rows="3"
            variant="outline"
            class="w-full bg-white dark:bg-gray-900"
            autoresize
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="lang in availableLanguages"
            :key="lang"
            icon="i-heroicons-plus"
            size="xs"
            color="primary"
            variant="soft"
            @click="addVariant(lang)"
          >
            {{ getLanguageLabel(lang) }}
          </UButton>

          <UButton
            icon="i-heroicons-plus"
            size="xs"
            variant="ghost"
            color="neutral"
            :title="t('authorSignature.addVariant', 'Add another language')"
            @click="addVariant()"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <UButton
              v-if="editingSignature"
              icon="i-heroicons-trash"
              size="xs"
              variant="ghost"
              color="error"
              @click="handleDelete(editingSignature.id); isModalOpen = false"
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
              :loading="isLoading"
              :disabled="!localVariants.some(v => v.content.trim())"
              @click="handleSave"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UiAppModal>
  </div>
</template>
