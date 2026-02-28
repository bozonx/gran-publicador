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
  maxTags?: number
  recommendedTags?: number
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

function getBadgeColor(index: number) {
  if (props.maxTags && index >= props.maxTags) return 'error'
  if (props.recommendedTags && index >= props.recommendedTags) return 'warning'
  return props.color || 'neutral'
}

function onTagClick(tag: string) {
  if (props.clickable) {
    emit('tag-click', tag)
  }
}
</script>

<template>
  <div v-if="normalizedTags.length" class="flex flex-wrap gap-1" :class="containerClass">
    <UBadge
      v-for="(tag, index) in normalizedTags"
      :key="tag"
      :color="getBadgeColor(index)"
      :variant="getBadgeColor(index) === 'warning' ? 'solid' : variant"
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
