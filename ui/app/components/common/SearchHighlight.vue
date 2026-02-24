<script setup lang="ts">
const props = defineProps<{
  text: string
  query: string
  highlightClass?: string
}>()

const segments = computed(() => {
  if (!props.query.trim()) return [{ text: props.text, highlight: false }]

  const escapedQuery = props.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = props.text.split(regex)

  return parts.filter(Boolean).map(part => ({
    text: part,
    highlight: regex.test(part)
  }))
})
</script>

<template>
  <span>
    <template v-for="(segment, index) in segments" :key="index">
      <mark 
        v-if="segment.highlight" 
        :class="highlightClass || 'bg-primary-500/20 text-primary-900 dark:text-primary-100 rounded-px px-0.5 font-medium'"
      >
        {{ segment.text }}
      </mark>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
