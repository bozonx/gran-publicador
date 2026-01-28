<script setup lang="ts">
import type { NewsItem } from '~/composables/useNews'

const props = defineProps<{
  item: NewsItem
}>()

defineEmits<{
  (e: 'create-publication', item: NewsItem): void
}>()

const { t, d } = useI18n()

// Format date
function formatDate(dateString: string) {
  try {
    return d(new Date(dateString), 'short')
  } catch {
    return dateString
  }
}

// Format score as percentage
function formatScore(score: number) {
  return `${Math.round(score * 100)}%`
}
</script>

<template>
  <div class="news-item-card p-6 group">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            {{ item.title }}
          </a>
        </h3>
        
        <p v-if="item.description" class="text-base text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
          {{ item.description }}
        </p>

        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
            <span>{{ formatDate(item.date) }}</span>
          </div>
          
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-newspaper" class="w-4 h-4" />
            <span>{{ item._source }}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
            <span>{{ formatScore(item._score) }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 shrink-0">
        <UButton
          :to="item.url"
          target="_blank"
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-top-right-on-square"
          trailing
        >
          {{ t('common.view') }}
        </UButton>

        <UButton
          variant="soft"
          color="primary"
          size="sm"
          icon="i-heroicons-document-plus"
          @click="$emit('create-publication', item)"
        >
          {{ t('publication.create') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.news-item-card {
  @apply bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300;
}
</style>
