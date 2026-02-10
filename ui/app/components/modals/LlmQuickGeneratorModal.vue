<script setup lang="ts">
import { FORM_SPACING } from '~/utils/design-tokens'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'
import LlmPromptTemplatePickerModal from '~/components/modals/LlmPromptTemplatePickerModal.vue'
import type { MediaItem } from '~/composables/useMedia'
import { DialogTitle } from 'reka-ui'

interface LlmContextTag {
  id: string
  label: string
  promptText: string
  kind: 'content' | 'media' | 'selection'
  enabled: boolean
}

interface Emits {
  (e: 'apply', text: string): void
  (e: 'close'): void
}

interface Props {
  content?: string
  media?: MediaItem[]
  projectId?: string
  selectionText?: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generateContent, isGenerating, estimateTokens } = useLlm()

const isOpen = defineModel<boolean>('open', { required: true })
const prompt = ref('')
const contextTags = ref<LlmContextTag[]>([])
const isTemplatePickerOpen = ref(false)

const modalRootRef = ref<HTMLElement | null>(null)
const promptInputRef = ref()

useModalAutoFocus({
  open: isOpen,
  root: modalRootRef,
  candidates: [{ target: promptInputRef }],
})

const runtimeConfig = useRuntimeConfig()

const contextLimit = computed(() => {
  const raw = runtimeConfig.public.llmContextLimitDefault
  const parsed = Number.parseInt(String(raw), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000
})

function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}

function getCleanedContextText(ctx: LlmContextTag): string {
  if (!ctx.promptText) return ctx.label
  return ctx.promptText
    .replace(/<[^>]*>/g, '')
    .trim()
}

function getContextPreviewText(tags: LlmContextTag[]): string {
  const rawParts = tags
    .filter(t => t.enabled)
    .map((t) => t.promptText?.trim())
    .filter((x): x is string => Boolean(x))

  if (rawParts.length === 0) return ''

  const limit = contextLimit.value
  let remaining = limit

  const parts: string[] = []
  for (const part of rawParts) {
    if (remaining <= 0) break

    const trimmed = part.trim()
    if (!trimmed) continue

    const next = truncateText(trimmed, remaining)
    if (!next.trim()) continue

    parts.push(next)
    remaining -= next.length
  }

  if (parts.length === 0) return ''
  return `\n\n${parts.join('\n')}`
}

function toggleContextTag(id: string) {
  const tag = contextTags.value.find(t => t.id === id)
  if (tag && tag.kind !== 'selection') {
    tag.enabled = !tag.enabled
  }
}

// Token counter
const estimatedTokensCount = computed(() => {
  return estimateTokens(prompt.value + getContextPreviewText(contextTags.value))
})

// Initialize tags
watch(isOpen, (open) => {
  if (open) {
    const nextTags: LlmContextTag[] = []

    if (props.selectionText?.trim()) {
      nextTags.push({
        id: 'selection:1',
        label: t('llm.selectionContext'),
        promptText: `<selection>\n${props.selectionText.trim()}\n</selection>`,
        kind: 'selection',
        enabled: true,
      })
    } else if (props.content?.trim()) {
      nextTags.push({
        id: 'content:1',
        label: t('llm.publicationBlock'),
        promptText: `<source_content>\n${props.content.trim()}\n</source_content>`,
        kind: 'content',
        enabled: true,
      })
    }

    const mediaItems = (props.media || []).filter(m => m?.type === 'IMAGE')
    for (const item of mediaItems) {
      const text = (item.description || item.alt || '').trim()
      if (!text) continue
      nextTags.push({
        id: `media:${item.id}`,
        label: text,
        promptText: `<image_description>${text}</image_description>`,
        kind: 'media',
        enabled: true,
      })
    }

    contextTags.value = nextTags
    prompt.value = ''
  }
})

function handleTemplateSelected(template: LlmPromptTemplate) {
  if (!template?.prompt?.trim()) return
  if (prompt.value.trim()) {
    prompt.value = prompt.value.trimEnd() + '\n\n'
  }
  prompt.value += template.prompt
}

async function handleGenerate() {
  if (!prompt.value.trim()) {
    toast.add({
      title: t('llm.promptRequired'),
      color: 'error',
    })
    return
  }

  const mediaDescriptions = contextTags.value
    .filter(t => t.kind === 'media')
    .map(t => (t.label || '').trim())
    .filter(Boolean)

  const response = await generateContent(prompt.value.trim(), {
    onlyRawResult: true,
    selectionText: props.selectionText,
    content: props.content,
    useContent: !props.selectionText?.trim() && Boolean(props.content?.trim()),
    mediaDescriptions,
    contextLimitChars: contextLimit.value,
  })

  if (response?.content) {
    emit('apply', response.content)
    isOpen.value = false
  } else {
    toast.add({
      title: t('llm.error'),
      description: t('llm.errorMessage'),
      color: 'error',
    })
  }
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('llm.quickGenerate')" size="xl">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {{ t('llm.quickGenerate') }}
        </DialogTitle>
      </div>
    </template>

    <template #default>
      <div ref="modalRootRef" :class="FORM_SPACING.section">
        <!-- Context Tags -->
        <div v-if="contextTags.length > 0" class="mb-4">
          <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
            <div class="flex flex-wrap gap-2">
              <UPopover
                v-for="ctx in contextTags"
                :key="ctx.id"
                mode="hover"
                :popper="{ placement: 'top' }"
              >
                <div class="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                  <UCheckbox
                    v-if="ctx.kind !== 'selection'"
                    :model-value="ctx.enabled"
                    @update:model-value="toggleContextTag(ctx.id)"
                  />
                  <UIcon v-else name="i-heroicons-lock-closed" class="w-3 h-3 text-gray-400" />
                  <span class="text-xs truncate max-w-105">{{ ctx.label }}</span>
                </div>
                <template #content>
                  <div class="p-3 max-w-sm text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {{ getCleanedContextText(ctx) }}
                  </div>
                </template>
              </UPopover>
            </div>
          </div>
        </div>

        <!-- Template Picker Button -->
        <div class="mb-4">
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-heroicons-squares-2x2"
            :disabled="isGenerating"
            @click="isTemplatePickerOpen = true"
          >
            {{ t('llm.selectTemplate') }}
          </UButton>

          <LlmPromptTemplatePickerModal
            v-model:open="isTemplatePickerOpen"
            :project-id="props.projectId"
            @select="handleTemplateSelected"
          />
        </div>

        <!-- Prompt Input -->
        <UTextarea
          ref="promptInputRef"
          v-model="prompt"
          :placeholder="t('llm.queryPlaceholder')"
          :rows="4"
          autoresize
          :disabled="isGenerating"
          class="w-full"
          @keydown.ctrl.enter="handleGenerate"
        />

        <div class="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1">
           <span v-if="estimatedTokensCount">{{ t('llm.estimatedTokens', { count: estimatedTokensCount }) }}</span>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 mt-6">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            icon="i-heroicons-sparkles"
            :loading="isGenerating"
            :disabled="!prompt.trim()"
            @click="handleGenerate"
          >
            {{ selectionText ? t('llm.applyToSelection') : t('llm.replaceContent') }}
          </UButton>
        </div>
      </div>
    </template>
  </UiAppModal>
</template>
