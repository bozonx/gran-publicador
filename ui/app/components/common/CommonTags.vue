<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import { parseTags, type TagsInput } from '~/utils/tags'

const props = withDefaults(defineProps<{
  tags: TagsInput
  color?: BadgeProps['color']
  variant?: BadgeProps['variant']
  size?: BadgeProps['size']
  prefix?: string
  containerClass?: string
  badgeClass?: string
  clickable?: boolean
}>(), {
  prefix: '#',
  containerClass: '',
  badgeClass: '',
  clickable: false,
})

const emit = defineEmits<{
  (e: 'tag-click', tag: string): void
}>()

const normalizedTags = computed(() => {
  return parseTags(props.tags)
})

function onTagClick(tag: string) {
  if (props.clickable) {
    emit('tag-click', tag)
  }
}
</script>

<template>
  <div v-if="normalizedTags.length" class="flex flex-wrap gap-1" :class="containerClass">
    <UBadge
      v-for="tag in normalizedTags"
      :key="tag"
      :color="color"
      :variant="variant"
      :size="size"
      :class="[
        badgeClass,
        clickable && 'cursor-pointer hover:brightness-95 transition-all'
      ]"
      @click="onTagClick(tag)"
    >
      {{ prefix }}{{ tag }}
    </UBadge>
  </div>
</template>
