<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import { parseTags } from '~/utils/tags'

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
  return parseTags(props.tags)
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
