<script setup lang="ts">
import type { NewsItem } from '~/composables/useNews'
import { dump } from 'js-yaml'

const props = defineProps<{
  item: NewsItem
  publicationId?: string
}>()

defineEmits<{
  (e: 'create-publication', item: NewsItem): void
}>()

const { t, d } = useI18n()

const showDebug = ref(false)
const yamlData = computed(() => {
  if (!showDebug.value) return ''
  return dump(props.item)
})

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




const displayDate = computed(() => {
  const dateStr = props.item._savedAt || props.item.savedAt || props.item.date || props.item.publishedAt
  if (!dateStr) return ''
  return formatDate(dateStr)
})

const displaySource = computed(() => {
  const source = props.item.publisher || props.item._source
  if (!source) return ''
  return source.length > 30 ? source.slice(0, 30) + '…' : source
})

const displayText = computed(() => {
  const text = props.item.description || props.item.content || ''
  if (!text) return ''
  return text.length > 500 ? text.slice(0, 500) + '...' : text
})
</script>

<template>
  <div class="news-item-card p-6 group">

    <div>
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
      
      <p v-if="displayText" class="text-base text-gray-600 dark:text-gray-400 mb-4 break-words">
        {{ displayText }}
      </p>

      <div class="flex items-center justify-between gap-4 mt-4">
        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <!-- Date -->
          <div v-if="displayDate" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
            <span>{{ displayDate }}</span>
          </div>
          
          <!-- Source -->
          <div v-if="displaySource" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-newspaper" class="w-4 h-4" />
            <a 
              :href="item.url" 
              target="_blank" 
              class="hover:text-primary-500 hover:underline transition-colors"
              @click.stop
            >
              {{ displaySource }}
            </a>
          </div>

          <!-- Type -->
          <div v-if="item.type" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-rss" class="w-4 h-4" />
            <span class="uppercase">{{ item.type }}</span>
          </div>

          <!-- Locale -->
          <div v-if="item.locale" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-language" class="w-4 h-4" />
            <span>{{ item.locale }}</span>
          </div>

          <!-- Score -->
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
            <span>{{ formatScore(item._score) }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <UButton
            v-if="publicationId"
            variant="soft"
            color="success"
            size="xs"
            icon="i-heroicons-check-badge"
            :label="t('publication.processed') || 'Processed'"
            :to="`/publications/${publicationId}/edit`"
          />

          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-heroicons-code-bracket"
            :label="showDebug ? t('common.close') : t('common.meta')"
            @click="showDebug = !showDebug"
          />

          <UButton
            variant="soft"
            color="primary"
            size="xs"
            icon="i-heroicons-document-plus"
            :label="t('publication.create')"
            @click="$emit('create-publication', item)"
          />
        </div>
      </div>
    </div>

    <!-- Debug Data View -->
    <div v-if="showDebug" class="mt-4">
      <div class="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-700">
        <pre>{{ yamlData }}</pre>
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
