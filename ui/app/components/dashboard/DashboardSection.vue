<script setup lang="ts">
import { useI18n } from '#imports'
const props = defineProps<{
  title: string
  icon?: string
  iconClass?: string
  badgeCount?: number
  badgeColor?: 'primary' | 'error' | 'success' | 'neutral' | 'warn' | 'info'
  viewAllLink?: string
  isLoading?: boolean
  isEmpty?: boolean
  emptyText?: string
  ui?: {
    card?: string
    header?: string
    title?: string
    content?: string
  }
}>()

const { t } = useI18n()
</script>

<template>
  <div :class="['app-card p-4 sm:p-6', props.ui?.card]">
    <!-- Header -->
    <div :class="['flex items-center justify-between mb-6', props.ui?.header]">
      <h3 :class="['text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2', props.ui?.title]">
        <UIcon v-if="props.icon" :name="props.icon" :class="['w-5 h-5', props.iconClass]" />
        {{ props.title }}
        <CommonCountBadge 
          v-if="props.badgeCount !== undefined" 
          :count="props.badgeCount" 
          :color="props.badgeColor" 
        />
      </h3>
      <UButton
        v-if="props.viewAllLink && !props.isLoading && !props.isEmpty"
        :to="props.viewAllLink"
        variant="ghost"
        size="xs"
        color="primary"
        icon="i-heroicons-arrow-right"
        trailing
      >
        {{ t('common.viewAll') }}
      </UButton>
      <slot name="header-actions" />
    </div>

    <!-- Loading State -->
    <div v-if="props.isLoading" class="flex justify-center py-4">
      <UiLoadingSpinner size="sm" />
    </div>

    <!-- Empty State -->
    <div 
      v-else-if="props.isEmpty" 
      class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
    >
      {{ props.emptyText || t('common.noData') }}
    </div>

    <!-- Content Slot -->
    <div v-else :class="props.ui?.content">
      <slot />
    </div>
  </div>
</template>
