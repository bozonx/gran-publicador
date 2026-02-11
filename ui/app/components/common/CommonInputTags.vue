<script setup lang="ts">
import { formatTagsCsv, normalizeTags, parseTags } from '~/utils/tags'

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
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
  (e: 'update:modelValue', value: string): void
}>()

const api = useApi()
const loading = ref(false)

const value = computed<string[]>({
  get() {
    const raw = props.modelValue ?? ''
    return normalizeTags(parseTags(raw))
  },
  set(next) {
    const normalized = normalizeTags(next)
    emit('update:modelValue', formatTagsCsv(normalized))
  },
})

async function searchTags(q: string) {
  if (!q || q.length < 1) return []
  
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
</script>

<template>
  <UInputMenu
    v-model="value"
    multiple
    create-item
    :items="searchTags"
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
