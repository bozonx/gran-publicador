<script setup lang="ts">
import { formatTagsCsv, normalizeTags, parseTags } from '~/utils/tags'

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
  placeholder?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: any
}>(), {
  placeholder: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

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
</script>

<template>
  <UInputTags
    v-model="value"
    :placeholder="placeholder"
    :color="color"
    :variant="variant"
    :size="size"
    :class="$props.class"
  />
</template>
