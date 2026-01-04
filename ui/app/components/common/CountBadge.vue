<script setup lang="ts">
interface Props {
  count?: number | string | null
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  title: undefined
})

const displayCount = computed(() => props.count || 0)
const isSingleDigit = computed(() => String(displayCount.value).length === 1)
</script>

<template>
  <UBadge
    variant="subtle" 
    color="primary"
    :title="title"
    class="font-bold border border-primary-200 dark:border-primary-800 transition-all duration-200"
    :class="[
      'rounded-full', 
      isSingleDigit 
        ? 'w-6 h-6 flex items-center justify-center p-0' 
        : 'px-2'
    ]"
 
  >
    {{ displayCount }}
  </UBadge>
</template>
