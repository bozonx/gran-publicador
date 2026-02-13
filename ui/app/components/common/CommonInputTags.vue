<script setup lang="ts">
import { normalizeTags } from '~/utils/tags'

const props = withDefaults(defineProps<{
  modelValue: string[] | null | undefined
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

const value = computed<string[]>({
  get() {
    return normalizeTags(props.modelValue ?? [])
  },
  set(next) {
    emit('update:modelValue', normalizeTags(next))
  },
})

async function searchTags(q: string) {
  if (!q || q.length < 1) return []

  if (!props.projectId && !props.userId) return []
  
  loading.value = true
  try {
    const res = await api.get<{ name: string }[]>('/tags/search', {
      params: {
        q,
        projectId: props.projectId,
        userId: props.userId,
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
