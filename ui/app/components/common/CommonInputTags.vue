<script setup lang="ts">
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

    return raw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  },
  set(next) {
    const normalized = next.map(t => t.trim()).filter(Boolean)
    emit('update:modelValue', normalized.join(', '))
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
