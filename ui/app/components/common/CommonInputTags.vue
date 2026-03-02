<script setup lang="ts">
import { formatTagsCsv, normalizeTags, coerceTagsToArray } from '~/utils/tags'
import {
  prependCaseInsensitiveUniqueTags,
} from '~/utils/common-input-tags'
import { copyTextToClipboard } from '~/utils/clipboard'
import { useTagSearch } from '~/composables/useTagSearch'

const props = withDefaults(defineProps<{
  modelValue: string[] | string | null | undefined
  placeholder?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: string | string[] | Record<string, boolean>
  projectId?: string
  userId?: string
  scope?: 'personal' | 'project'
  groupId?: string
  disabled?: boolean
  searchEndpoint?: string
  maxTags?: number
  recommendedTags?: number
}>(), {
  placeholder: '',
  searchEndpoint: '/tags/search',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const { t } = useI18n()
const toast = useToast()
const isCopying = ref(false)

const {
  searchTerm,
  items,
  loading
} = useTagSearch({
  searchEndpoint: props.searchEndpoint,
  scope: props.scope,
  projectId: props.projectId,
  userId: props.userId,
  groupId: props.groupId
})

const uniqueId = useId()
const uniqueTagsClass = `tags-wrapper-${uniqueId.replace(/[^a-zA-Z0-9]/g, '')}`

const TAG_LIMIT = 50

function onCreateTag(rawTag: string) {
  const createdTags = normalizeTags([rawTag], { limit: TAG_LIMIT })
  if (createdTags.length === 0) return
  const createdTag = createdTags[0]
  if (!createdTag) return

  const next = normalizeTags([...value.value, ...createdTags], { limit: TAG_LIMIT })
  value.value = next

  items.value = prependCaseInsensitiveUniqueTags({
    currentItems: items.value,
    candidateTags: [createdTag],
  })

  searchTerm.value = ''
}

function addTags(rawTags: string[]) {
  const next = normalizeTags([...value.value, ...rawTags], { limit: TAG_LIMIT })
  if (next.length === value.value.length) return

  value.value = next

  items.value = prependCaseInsensitiveUniqueTags({
    currentItems: items.value,
    candidateTags: rawTags,
  })
}

function onPasteTags(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData('text') ?? ''
  const parsed = normalizeTags(coerceTagsToArray(pastedText))
  if (parsed.length === 0) return

  event.preventDefault()
  addTags(parsed)
  searchTerm.value = ''
}

function onKeydownCreateTag(event: KeyboardEvent) {
  if (event.isComposing) return

  const isComma = event.key === ',' || event.code === 'Comma'
  const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter'
  if (!isComma && !isEnter) return

  const nextTag = searchTerm.value.trim()
  if (!nextTag) return

  event.preventDefault()
  onCreateTag(nextTag)
}

async function copyTags() {
  if (value.value.length === 0 || isCopying.value) return

  const csv = formatTagsCsv(value.value)
  if (!csv) return

  isCopying.value = true
  try {
    const copied = await copyTextToClipboard(csv)
    if (!copied) {
      toast.add({
        title: t('common.error'),
        description: t('post.tagsCopyFailed'),
        color: 'error',
      })
      return
    }

    toast.add({
      title: t('common.success'),
      description: t('post.tagsCopied'),
      color: 'success',
    })
  } catch (err) {
    console.error('Failed to copy tags:', err)
    toast.add({
      title: t('common.error'),
      description: t('post.tagsCopyFailed'),
      color: 'error',
    })
  } finally {
    isCopying.value = false
  }
}

// Logic for clipboard is now in utils/clipboard.ts

// Logic for scope resolution is now managed by useTagSearch

const value = computed<string[]>({
  get() {
    return normalizeTags(coerceTagsToArray(props.modelValue), { limit: TAG_LIMIT })
  },
  set(next) {
    emit('update:modelValue', normalizeTags(next, { limit: TAG_LIMIT }))
  },
})

// Logic for search is now in useTagSearch

const tagStyles = computed(() => {
  if (!props.maxTags && !props.recommendedTags) return ''

  const rec = props.recommendedTags || props.maxTags || 0
  const max = props.maxTags || 0

  const tagItemSelector = '[data-slot="tags-item"], [data-slot="tagsItem"]'

  return `
    .${uniqueTagsClass} ${tagItemSelector}:nth-child(n+${rec + 1}) {
      background-color: var(--color-warn) !important;
      border-color: var(--color-warn) !important;
    }
    .${uniqueTagsClass} ${tagItemSelector}:nth-child(n+${rec + 1}) * {
      color: var(--color-white) !important;
    }
    .${uniqueTagsClass} ${tagItemSelector}:nth-child(n+${max + 1}) {
      background-color: var(--color-error) !important;
      border-color: var(--color-error) !important;
    }
    .${uniqueTagsClass} ${tagItemSelector}:nth-child(n+${max + 1}) * {
      color: var(--color-white) !important;
    }
  `
})

useHead({
  style: [
    {
      id: `tags-styles-${uniqueId}`,
      innerHTML: tagStyles
    }
  ]
})
</script>

<template>
  <div class="flex items-start gap-2 tags-container-root" :class="uniqueTagsClass">
    <UInputMenu
      v-model="value"
      v-model:search-term="searchTerm"
      multiple
      create-item
      :items="items"
      ignore-filter
      :placeholder="placeholder"
      :color="color"
      :variant="variant"
      :size="size"
      :class="['flex-1', $props.class]"
      :disabled="disabled"
      :loading="loading"
      icon="i-heroicons-tag"
      @create="onCreateTag"
      @paste.capture="onPasteTags"
      @keydown.capture="onKeydownCreateTag"
    />

    <UButton
      icon="i-heroicons-clipboard-document"
      color="neutral"
      variant="outline"
      :size="size ?? 'md'"
      :disabled="disabled || value.length === 0"
      :loading="isCopying"
      @click="copyTags"
    >
      {{ t('common.copy') }}
    </UButton>


  </div>
</template>

<style scoped>
.tags-container-root {
  --color-warn: var(--ui-color-warning-500);
  --color-error: var(--ui-color-error-500);
  --color-white: #ffffff;
}

.dark .tags-container-root {
  --color-warn: var(--ui-color-warning-600);
  --color-error: var(--ui-color-error-600);
}
</style>
