<script setup lang="ts">
interface Props {
  /** Description text */
  text?: string | null
  /** Number of lines to clamp to */
  lines?: number
}

const props = withDefaults(defineProps<Props>(), {
  text: undefined,
  lines: 2,
})
</script>

<template>
  <p 
    v-if="text" 
    class="text-sm text-gray-500 dark:text-gray-400 mb-3 grow leading-relaxed"
    :class="`line-clamp-${lines}`"
  >
    {{ text }}
  </p>
</template>
