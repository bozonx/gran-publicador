<script setup lang="ts">
interface Props {
  /** Entity title */
  title: string
  /** Optional badge text */
  badge?: string
  /** Optional badge color */
  badgeColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
}

const props = withDefaults(defineProps<Props>(), {
  badge: undefined,
  badgeColor: 'primary',
})
</script>

<template>
  <div class="flex items-start justify-between gap-3 mb-3">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
        {{ title }}
      </h3>
      <UBadge 
        v-if="badge" 
        :color="badgeColor" 
        variant="subtle" 
        size="xs"
        class="capitalize"
      >
        {{ badge }}
      </UBadge>
    </div>
    
    <div class="shrink-0 flex items-center gap-1.5">
      <slot name="actions" />
    </div>
  </div>
</template>
