<script setup lang="ts">
import { normalizeTags, parseTags } from '~/utils/tags'

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

const api = useApi()
const loading = ref(false)
const searchTerm = ref('')
const items = ref<string[]>([])

function coerceModelValueToArray(value: string[] | string | null | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return parseTags(value)
  return []
}

function onCreateTag(rawTag: string) {
  const createdTags = normalizeTags([rawTag])
  if (createdTags.length === 0) return

  const next = normalizeTags([...value.value, ...createdTags])
  value.value = next

  if (!items.value.includes(createdTags[0])) {
    items.value = [createdTags[0], ...items.value]
  }

  searchTerm.value = ''
}

function resolveSearchScope(): { projectId?: string; userId?: string } | null {
  if (props.projectId) {
    return { projectId: props.projectId }
  }

  if (props.userId) {
    return { userId: props.userId }
  }

  return null
}

const value = computed<string[]>({
  get() {
    return normalizeTags(coerceModelValueToArray(props.modelValue))
  },
  set(next) {
    emit('update:modelValue', normalizeTags(next))
  },
})

async function searchTags(q: string) {
  if (!q || q.length < 1) return []

  const scope = resolveSearchScope()
  if (!scope) return []
  
  loading.value = true
  try {
    const res = await api.get<{ name: string }[]>('/tags/search', {
      params: {
        q,
        ...scope,
        limit: 10
      }
    })
    return res.map(t => t.name)
  } catch (err) {
    console.error('Failed to search tags:', err)
    return []
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(async () => {
  items.value = await searchTags(searchTerm.value)
}, 200)

watch(searchTerm, () => {
  if (!searchTerm.value) {
    items.value = []
    return
  }
  debouncedSearch()
})
</script>

<template>
  <UInputMenu
    v-model="value"
    v-model:search-term="searchTerm"
    @create="onCreateTag"
    multiple
    create-item
    :items="items"
    ignore-filter
    :placeholder="placeholder"
    :color="color"
    :variant="variant"
    :size="size"
    :class="$props.class"
    :disabled="disabled"
    :loading="loading"
    icon="i-heroicons-tag"
  />
</template>
