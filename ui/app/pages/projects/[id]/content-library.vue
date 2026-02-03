<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { stripHtmlAndSpecialChars } from '~/utils/text'

definePageMeta({
  middleware: 'auth',
})

interface ContentText {
  id: string
  content: string
  type: string
  order: number
}

interface ContentItemMedia {
  id: string
  order: number
  hasSpoiler: boolean
  media: {
    id: string
    mimeType?: string | null
    url?: string | null
    fileName?: string | null
  }
}

interface ContentItem {
  id: string
  title: string | null
  note: string | null
  tags: string | null
  createdAt: string
  archivedAt: string | null
  texts: ContentText[]
  media: ContentItemMedia[]
}

interface FindContentItemsResponse {
  items: ContentItem[]
  total: number
  limit: number
  offset: number
}

const { t, d } = useI18n()
const route = useRoute()
const api = useApi()

const projectId = computed(() => route.params.id as string)

const isLoading = ref(false)
const error = ref<string | null>(null)

const q = ref('')
const limit = 20
const offset = ref(0)
const total = ref(0)
const items = ref<ContentItem[]>([])

const hasMore = computed(() => items.value.length < total.value)

const fetchItems = async (opts?: { reset?: boolean }) => {
  if (!projectId.value) return

  if (opts?.reset) {
    offset.value = 0
    items.value = []
  }

  isLoading.value = true
  error.value = null

  try {
    const res = await api.get<FindContentItemsResponse>('/content-library/items', {
      params: {
        scope: 'project',
        projectId: projectId.value,
        search: q.value || undefined,
        limit,
        offset: offset.value,
        includeArchived: false,
      },
    })

    total.value = res.total

    if (offset.value === 0) {
      items.value = res.items
    } else {
      items.value = [...items.value, ...res.items]
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load content library'
  } finally {
    isLoading.value = false
  }
}

const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return
  offset.value += limit
  await fetchItems()
}

const debouncedFetch = useDebounceFn(() => fetchItems({ reset: true }), 350)

watch(
  () => q.value,
  () => {
    debouncedFetch()
  },
)

onMounted(() => {
  fetchItems({ reset: true })
})

const getItemPreview = (item: ContentItem) => {
  const firstText = item.texts?.[0]?.content
  if (firstText) {
    return stripHtmlAndSpecialChars(firstText).slice(0, 220)
  }

  if (item.note) {
    return stripHtmlAndSpecialChars(item.note).slice(0, 220)
  }

  if ((item.media?.length ?? 0) > 0) {
    return t('contentLibrary.preview.mediaOnly', 'Media only')
  }

  return ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
          {{ t('contentLibrary.title', 'Content library') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400">
          {{ t('contentLibrary.subtitleProject', 'Project scope') }}
        </p>
      </div>

      <UButton
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        :to="`/projects/${projectId}`"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <div class="app-card p-6">
      <div class="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <UInput
          v-model="q"
          :placeholder="t('contentLibrary.searchPlaceholder', 'Search by title, note, tags, text...')"
          icon="i-heroicons-magnifying-glass"
          class="w-full md:max-w-xl"
        />

        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('common.total', { count: total }, `Total: ${total}`) }}
        </div>
      </div>

      <div v-if="error" class="mt-4 text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-if="isLoading && items.length === 0" class="mt-6 flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400 animate-spin" />
      </div>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ item.title || t('contentLibrary.untitled', 'Untitled') }}
                </h3>

                <UBadge v-if="item.archivedAt" color="warning" variant="subtle">
                  {{ t('common.archived', 'Archived') }}
                </UBadge>
              </div>

              <p v-if="getItemPreview(item)" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {{ getItemPreview(item) }}
              </p>

              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  {{ d(new Date(item.createdAt), 'short') }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                  {{ t('contentLibrary.textsCount', { count: item.texts?.length || 0 }, `${item.texts?.length || 0} texts`) }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-photo" class="w-4 h-4" />
                  {{ t('contentLibrary.mediaCount', { count: item.media?.length || 0 }, `${item.media?.length || 0} media`) }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-eye"
                disabled
              >
                {{ t('common.open', 'Open') }}
              </UButton>
            </div>
          </div>
        </div>

        <div v-if="items.length === 0" class="py-10 text-center text-gray-500 dark:text-gray-400">
          {{ t('contentLibrary.empty', 'No items yet') }}
        </div>

        <div v-if="hasMore" class="pt-2 flex justify-center">
          <UButton
            :loading="isLoading"
            variant="outline"
            color="neutral"
            icon="i-heroicons-arrow-down"
            @click="loadMore"
          >
            {{ t('common.loadMore', 'Load more') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
