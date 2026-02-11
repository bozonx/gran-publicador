<script setup lang="ts">
import type { PostType } from '~/types/posts'
import { getPostTypeIcon, getPostTypeColor } from '~/utils/posts'

interface Props {
  modelValue?: PostType | string | null
  loadingType?: PostType | string | null
  disabled?: boolean
  items?: { value: string; label: string }[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: PostType): void
  (e: 'select', value: PostType): void
}>()

const displayItems = computed(() => props.items || [])

function handleSelect(type: string) {
    if (props.disabled) return
    emit('update:modelValue', type as PostType)
    emit('select', type as PostType)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      v-for="item in displayItems"
      :key="item.value"
      :icon="getPostTypeIcon(item.value)"
      :color="getPostTypeColor(item.value)"
      :variant="modelValue === item.value ? 'solid' : 'soft'"
      size="sm"
      :loading="loadingType === item.value"
      :disabled="disabled || (!!loadingType && loadingType !== item.value)"
      @click="handleSelect(item.value)"
    >
      {{ item.label }}
    </UButton>
  </div>
</template>
