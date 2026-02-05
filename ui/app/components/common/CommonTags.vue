<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  tags: string | string[] | null | undefined
  color?: BadgeProps['color']
  variant?: BadgeProps['variant']
  size?: BadgeProps['size']
  prefix?: string
  containerClass?: string
  badgeClass?: string
}>(), {
  prefix: '#',
  containerClass: '',
  badgeClass: '',
})

const normalizedTags = computed(() => {
  if (!props.tags) return []

  if (Array.isArray(props.tags)) {
    return props.tags.map(t => t.trim()).filter(Boolean)
  }

  return props.tags
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
})
</script>

<template>
  <div v-if="normalizedTags.length" class="flex flex-wrap gap-1" :class="containerClass">
    <UBadge
      v-for="tag in normalizedTags"
      :key="tag"
      :color="color"
      :variant="variant"
      :size="size"
      :class="badgeClass"
    >
      {{ prefix }}{{ tag }}
    </UBadge>
  </div>
</template>
