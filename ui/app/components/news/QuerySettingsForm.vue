<script setup lang="ts">
import NewsSourceSelector from '~/components/news/SourceSelector.vue'
import NewsSourceTagSelector from '~/components/news/SourceTagSelector.vue'

export interface NewsQuery {
  id: string
  name: string
  q: string
  mode?: 'text' | 'vector' | 'hybrid'
  savedFrom?: string
  savedTo?: string
  lang?: string
  sourceTags?: string
  sources?: string
  minScore: number
  orderBy?: 'relevance' | 'savedAt'
  note: string
  isNotificationEnabled: boolean
}

const props = defineProps<{
  query: NewsQuery
  isCollapsed: boolean
  indicatorStatus?: string
  isIndicatorVisible?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:query', value: NewsQuery): void
  (e: 'update:isCollapsed', value: boolean): void
  (e: 'rename', id: string, name: string): void
  (e: 'delete', id: string): void
  (e: 'search'): void
}>()

const { t } = useI18n()

// Local mutable copy that syncs changes back to parent
const localQuery = computed({
  get: () => props.query,
  set: (val) => emit('update:query', val),
})

const selectedSources = computed({
  get: () => localQuery.value.sources?.split(',').filter(Boolean) || [],
  set: (val: string[]) => {
    emit('update:query', { ...localQuery.value, sources: val.join(',') })
  },
})

const sourcesTooltipText = computed(() => {
  return `${t('news.sourcesDescription')}\n\n${t('news.search_not_required_with_sources')}`
})

function toggleCollapse() {
  emit('update:isCollapsed', !props.isCollapsed)
}

function expandIfCollapsed() {
  if (props.isCollapsed) {
    emit('update:isCollapsed', false)
  }
}

function updateField<K extends keyof NewsQuery>(key: K, value: NewsQuery[K]) {
  emit('update:query', { ...localQuery.value, [key]: value })
}
</script>

<template>
  <div
    class="news-config-card overflow-hidden transition-all duration-300"
    :class="{
      'cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800': isCollapsed
    }"
    @click="expandIfCollapsed"
  >
    <!-- Card Header with Caret Button -->
    <div class="flex items-start justify-between p-6 pb-4">
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {{ query.name }}
          <UIcon
            v-if="query.isNotificationEnabled"
            name="i-heroicons-bell-alert"
            class="w-4 h-4 text-primary-500"
          />
        </h2>
      </div>
      <UButton
        :icon="isCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
        color="neutral"
        variant="ghost"
        size="sm"
        :title="isCollapsed ? t('common.expand') : t('common.collapse')"
        @click.stop="toggleCollapse"
      />
    </div>

    <!-- Collapsed Summary View -->
    <div v-if="isCollapsed" class="px-6 pb-6 space-y-3">
      <div v-if="query.q" class="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
        <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 mt-0.5 shrink-0" />
        <span class="truncate">{{ query.q.length > 200 ? query.q.slice(0, 200) + '...' : query.q }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-3 text-sm">
        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 rounded-md border border-primary-100 dark:border-primary-800">
          <UIcon name="i-heroicons-magnifying-glass" class="w-3.5 h-3.5" />
          <span class="font-medium">
            {{ query.mode === 'text' ? t('news.modeText') : query.mode === 'vector' ? t('news.modeVector') : t('news.modeHybrid') }}
          </span>
        </div>

        <div v-if="query.lang" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-language" class="w-3.5 h-3.5" />
          <span>{{ query.lang }}</span>
        </div>

        <div v-if="query.savedFrom || query.savedTo" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
          <span>{{ query.savedFrom || '...' }} — {{ query.savedTo || '...' }}</span>
        </div>

        <div v-if="query.sources" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-globe-alt" class="w-3.5 h-3.5" />
          <span class="truncate max-w-[200px]">{{ query.sources }}</span>
        </div>

        <div v-if="query.sourceTags" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5" />
          <span class="truncate max-w-[200px]">{{ query.sourceTags }}</span>
        </div>

        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" />
          <span>{{ query.minScore }}</span>
        </div>
      </div>
    </div>

    <!-- Expanded Full Form -->
    <div v-else class="px-6 pb-6 space-y-6">
      <!-- Search Query -->
      <div class="w-full">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('news.searchPlaceholder') }}
        </label>
        <UTextarea
          :value="query.q"
          :placeholder="t('news.searchPlaceholder')"
          size="lg"
          class="w-full"
          :rows="3"
          autoresize
          @update:model-value="updateField('q', $event as string)"
          @keydown.enter.ctrl.prevent="$emit('search')"
          @keydown.enter.meta.prevent="$emit('search')"
        />
      </div>

      <!-- Search Mode -->
      <div class="w-full">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('news.mode') }}
        </label>
        <UiAppButtonGroup
          :model-value="query.mode"
          :options="[
            { value: 'text', label: t('news.modeText') },
            { value: 'vector', label: t('news.modeVector') },
            { value: 'hybrid', label: t('news.modeHybrid') }
          ]"
          variant="outline"
          active-variant="solid"
          fluid
          size="lg"
          @update:model-value="updateField('mode', $event as NewsQuery['mode'])"
        />
      </div>

      <!-- Language & Score -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.language') }}
          </label>
          <CommonLanguageSelect
            :model-value="query.lang"
            mode="all"
            searchable
            @update:model-value="updateField('lang', $event)"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Min Score
          </label>
          <div class="flex flex-col gap-2 pt-2">
            <input
              :value="query.minScore"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500 mt-2"
              @input="updateField('minScore', Number(($event.target as HTMLInputElement).value))"
            />
            <div class="flex justify-between text-xs text-gray-500 font-medium">
              <span>0.0</span>
              <span class="text-primary-500 font-bold text-sm bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded border border-primary-100 dark:border-primary-800">{{ query.minScore }}</span>
              <span>1.0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sources & Source Tags -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="w-full">
          <label class="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.sources') }}
            <CommonInfoTooltip :text="sourcesTooltipText" />
          </label>
          <NewsSourceSelector v-model="selectedSources" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.sourceTags') }}
          </label>
          <NewsSourceTagSelector
            :model-value="query.sourceTags"
            :placeholder="t('news.sourceTagsPlaceholder')"
            @update:model-value="updateField('sourceTags', $event)"
          />
        </div>
      </div>

      <!-- Date Range -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.savedFrom') }}
          </label>
          <UInput
            :value="query.savedFrom"
            type="date"
            size="lg"
            icon="i-heroicons-calendar"
            @update:model-value="updateField('savedFrom', $event as string)"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.savedTo') }}
          </label>
          <UInput
            :value="query.savedTo"
            type="date"
            size="lg"
            icon="i-heroicons-calendar"
            @update:model-value="updateField('savedTo', $event as string)"
          />
        </div>
      </div>

      <!-- Order By -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('news.orderBy') }}
          </label>
          <UiAppButtonGroup
            :model-value="query.orderBy"
            :options="[
              { value: 'relevance', label: t('news.orderByRelevance') },
              { value: 'savedAt', label: t('news.orderBySavedAt') }
            ]"
            variant="outline"
            active-variant="solid"
            fluid
            size="lg"
            @update:model-value="updateField('orderBy', $event as NewsQuery['orderBy'])"
          />
        </div>
      </div>

      <!-- Note -->
      <div class="pt-4 border-t border-gray-100 dark:border-gray-800 w-full">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('news.note') }}
        </label>
        <UTextarea
          :value="query.note"
          :placeholder="t('news.notePlaceholder')"
          :rows="6"
          size="lg"
          autoresize
          class="w-full"
          @update:model-value="updateField('note', $event as string)"
        />
      </div>

      <!-- Toolbar: Notifications & Actions -->
      <div class="flex justify-between items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div class="flex items-center gap-1.5 px-1">
          <UCheckbox
            :model-value="query.isNotificationEnabled"
            size="md"
            color="primary"
            @update:model-value="updateField('isNotificationEnabled', $event as boolean)"
          >
            <template #label>
              <div class="flex items-center gap-2 cursor-pointer select-none">
                <UIcon
                  :name="query.isNotificationEnabled ? 'i-heroicons-bell-alert' : 'i-heroicons-bell'"
                  class="w-5 h-5 transition-colors"
                  :class="query.isNotificationEnabled ? 'text-primary-500' : 'text-gray-400'"
                />
                <span class="text-sm font-medium" :class="query.isNotificationEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'">
                  {{ t('news.notifications') }}
                </span>
              </div>
            </template>
          </UCheckbox>
        </div>

        <div class="flex items-center gap-3">
          <UiSaveStatusIndicator
            :status="indicatorStatus"
            :visible="isIndicatorVisible"
            :error="saveError"
          />

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-pencil-square"
            @click="$emit('rename', query.id, query.name)"
          >
            {{ t('common.rename') }}
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            @click="$emit('delete', query.id)"
          >
            {{ t('common.delete') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.news-config-card {
  @apply bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-200;
}
</style>
