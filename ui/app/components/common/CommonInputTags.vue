<script setup lang="ts">
import { formatTagsCsv, normalizeTags, parseTags } from '~/utils/tags'
import {
  createSearchRequestTracker,
  prependCaseInsensitiveUniqueTags,
  resolveTagSearchScope,
} from '~/utils/common-input-tags'

const props = withDefaults(defineProps<{
  modelValue: string[] | string | null | undefined
  placeholder?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: any
  projectId?: string
  userId?: string
  disabled?: boolean
}>(), {
  placeholder: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const loading = ref(false)
const searchTerm = ref('')
const items = ref<string[]>([])
const isCopying = ref(false)
const searchRequestTracker = createSearchRequestTracker()
const activeSearchController = ref<AbortController | null>(null)
const hasShownScopeConflictWarning = ref(false)

const TAG_LIMIT = 50

function coerceModelValueToArray(value: string[] | string | null | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return parseTags(value)
  return []
}

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
  const parsed = normalizeTags(parseTags(pastedText))
  if (parsed.length === 0) return

  event.preventDefault()
  addTags(parsed)
  searchTerm.value = ''
}

function onKeydownCreateByComma(event: KeyboardEvent) {
  if (event.key !== ',') return

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

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!import.meta.client) return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback to execCommand below.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let success = false
  try {
    success = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return success
}

function resolveSearchScope() {
  return resolveTagSearchScope({
    projectId: props.projectId,
    userId: props.userId,
  })
}

const value = computed<string[]>({
  get() {
    return normalizeTags(coerceModelValueToArray(props.modelValue), { limit: TAG_LIMIT })
  },
  set(next) {
    emit('update:modelValue', normalizeTags(next, { limit: TAG_LIMIT }))
  },
})

async function searchTags(q: string, signal?: AbortSignal) {
  if (!q || q.length < 1) return []

  const resolvedScope = resolveSearchScope()
  if (resolvedScope.reason !== 'ok') {
    if (resolvedScope.reason === 'conflict' && !hasShownScopeConflictWarning.value) {
      if (import.meta.dev) {
        console.warn('CommonInputTags: both projectId and userId were provided, expected exactly one')
      }

      toast.add({
        title: t('common.warning'),
        description: t('post.tagsScopeInvalid'),
        color: 'warning',
      })
      hasShownScopeConflictWarning.value = true
    }
    return []
  }

  hasShownScopeConflictWarning.value = false

  try {
    const res = await api.get<{ name: string }[]>('/tags/search', {
      signal,
      params: {
        q,
        ...resolvedScope.scope,
        limit: 10
      }
    })
    return res.map(t => t.name)
  } catch (err) {
    if ((err as { message?: string }).message === 'Request aborted') {
      return []
    }

    console.error('Failed to search tags:', err)
    toast.add({
      title: t('common.error'),
      description: t('common.unexpectedError'),
      color: 'error',
    })
    return []
  }
}

const debouncedSearch = useDebounceFn(async () => {
  const q = searchTerm.value.trim()
  if (!q) return

  activeSearchController.value?.abort()
  const nextController = api.createAbortController()
  activeSearchController.value = nextController

  const requestId = searchRequestTracker.next()
  loading.value = true

  try {
    const result = await searchTags(q, nextController.signal)
    if (!searchRequestTracker.isLatest(requestId)) return
    items.value = result
  } finally {
    if (searchRequestTracker.isLatest(requestId)) {
      loading.value = false
    }
  }
}, 200)

watch(searchTerm, () => {
  if (!searchTerm.value.trim()) {
    searchRequestTracker.invalidate()
    activeSearchController.value?.abort()
    activeSearchController.value = null
    loading.value = false
    items.value = []
    return
  }
  debouncedSearch()
})

onBeforeUnmount(() => {
  activeSearchController.value?.abort()
})
</script>

<template>
  <div class="flex items-start gap-2">
    <UInputMenu
      v-model="value"
      v-model:search-term="searchTerm"
      @create="onCreateTag"
      @paste.capture="onPasteTags"
      @keydown.capture="onKeydownCreateByComma"
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
