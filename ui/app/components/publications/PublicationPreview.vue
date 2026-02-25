<script setup lang="ts">
import { getStatusUiColor as getStatusColor, getStatusIcon } from '~/utils/publications'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import MediaGallery from '~/components/media/MediaGallery.vue'

const props = defineProps<{
  publicationId: string
}>()

const { t } = useI18n()
const api = useApi()
const { formatDateWithTime, formatDateShort } = useFormatters()

const isLoading = ref(false)
const error = ref<string | null>(null)

const publication = ref<any | null>(null)
const project = ref<any | null>(null)

const displayTitle = computed(() => {
  if (publication.value?.title) {
    return stripHtmlAndSpecialChars(publication.value.title)
  }
  return t('post.untitled')
})

const isArchived = computed(() => !!publication.value?.archivedAt)
const isProjectArchived = computed(() => !!project.value?.archivedAt)
const hasArchivedChannels = computed(() => publication.value?.posts?.some((p: any) => !!p.channel?.archivedAt))
const hasInactiveChannels = computed(() => publication.value?.posts?.some((p: any) => p.channel?.isActive === false))

const isAnyPostPublished = computed(() => {
  return publication.value?.posts?.some((p: any) => !!p.publishedAt) ?? false
})

const majoritySchedule = computed(() => {
  if (!publication.value?.posts?.length) return { date: null, conflict: false }

  const dates = publication.value.posts
    .map((p: any) => p.publishedAt || p.scheduledAt)
    .filter((d: string | null) => !!d) as string[]

  if (dates.length === 0) return { date: null, conflict: false }

  const counts: Record<string, number> = {}
  dates.forEach(d => {
    counts[d] = (counts[d] || 0) + 1
  })

  let maxCount = 0
  let majorityDate: string | null = null
  for (const [date, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      majorityDate = date
    }
  }

  const uniqueDates = Object.keys(counts)
  const conflict = uniqueDates.length > 1

  return { date: majorityDate, conflict }
})

const showDescription = computed(() => {
  if (!publication.value?.description) return false

  if (publication.value.postType === 'ARTICLE') return true

  return publication.value.posts?.some((post: any) => {
    const socialMedia = post.channel?.socialMedia || post.socialMedia
    return socialMedia === 'site'
  })
})

const fetchPublication = async () => {
  isLoading.value = true
  error.value = null
  try {
    const res = await api.get<any>(`/publications/${props.publicationId}`)
    publication.value = res

    const projectId = res?.projectId
    if (projectId) {
      project.value = await api.get<any>(`/projects/${projectId}`)
    } else {
      project.value = null
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to load publication'
    publication.value = null
    project.value = null
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.publicationId,
  () => {
    if (props.publicationId) {
      fetchPublication()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-2">
    <div v-if="isLoading && !publication" class="flex items-center justify-center py-12">
      <UiLoadingSpinner size="md" />
    </div>

    <div v-else-if="error" class="text-red-600 dark:text-red-400 px-2">
      {{ error }}
    </div>

    <div v-else-if="publication" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="p-6">
          <div class="mb-4">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ displayTitle }}
            </h1>
          </div>

          <div class="flex flex-wrap gap-2 mb-6">
            <UBadge :color="isAnyPostPublished ? 'success' : 'primary'" variant="soft" class="font-normal">
              <span class="text-gray-400 mr-1">
                {{ isAnyPostPublished ? t('post.publishedAt') : t('post.scheduledAt') }}:
              </span>
              <span
                :class="
                  majoritySchedule.date
                    ? isAnyPostPublished
                      ? 'text-success-600 dark:text-success-400 font-medium'
                      : 'text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-success-600 dark:text-success-400'
                "
              >
                {{ majoritySchedule.date ? formatDateWithTime(majoritySchedule.date) : t('common.none') }}
                <span v-if="majoritySchedule.conflict" class="ml-1 text-orange-500">*</span>
              </span>
            </UBadge>

            <UBadge v-if="isArchived" color="error" variant="solid" class="flex items-center gap-1 font-bold">
              <UIcon name="i-heroicons-archive-box" class="w-4 h-4" />
              {{ t('common.archived') }}
            </UBadge>

            <UBadge
              v-if="isProjectArchived"
              color="warning"
              variant="subtle"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
              {{ t('publication.projectArchived') }}
            </UBadge>

            <UBadge
              v-if="hasArchivedChannels"
              color="warning"
              variant="subtle"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon name="i-heroicons-archive-box" class="w-4 h-4" />
              {{ t('publication.hasArchivedChannels') }}
            </UBadge>

            <UBadge
              v-if="hasInactiveChannels"
              color="warning"
              variant="subtle"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon name="i-heroicons-no-symbol" class="w-4 h-4" />
              {{ t('publication.hasInactiveChannels') }}
            </UBadge>

            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.language') }}:</span>
              {{ publication.language }}
            </UBadge>

            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.type') }}:</span>
              {{ t(`postType.${publication.postType.toLowerCase()}`) }}
            </UBadge>

            <UBadge
              :color="getStatusColor(publication.status) as any"
              variant="soft"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon :name="getStatusIcon(publication.status)" class="w-4 h-4" />
              {{ t(`publicationStatus.${publication.status.toLowerCase()}`) }}
            </UBadge>

            <NuxtLink v-if="project" :to="`/projects/${project.id}`">
              <UBadge
                variant="soft"
                color="primary"
                class="hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer font-normal"
              >
                <UIcon name="i-heroicons-folder" class="w-4 h-4 mr-1 text-primary-500" />
                {{ project.name }}
              </UBadge>
            </NuxtLink>

            <UBadge v-else variant="soft" color="neutral" class="font-normal">
              <UIcon name="i-heroicons-user" class="w-4 h-4 mr-1 text-gray-500" />
              {{ t('publication.personal_draft') }}
            </UBadge>
          </div>

          <div v-if="publication.note" class="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
            <h3 class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              {{ t('post.note') }}
            </h3>
            <p class="text-sm text-amber-800 dark:text-amber-300 italic">
              {{ publication.note }}
            </p>
          </div>

          <div v-if="publication.postDate" class="mb-6 flex items-center gap-2" :title="t('post.postDate')">
            <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-900 dark:text-white">{{ formatDateShort(publication.postDate) }}</span>
          </div>

          <div>
            <div v-if="publication.content" class="max-w-none mb-4">
              <div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50 font-mono text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {{ publication.content }}
              </div>
            </div>

            <div v-if="publication.authorComment" class="mt-3">
              <h3 class="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-3.5 h-3.5" />
                {{ t('post.authorComment') }}
              </h3>
              <div class="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                {{ publication.authorComment }}
              </div>
            </div>

            <div v-if="showDescription" class="mt-3">
              <h3 class="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
                {{ t('post.description') }}
              </h3>
              <div class="text-sm text-gray-700 dark:text-gray-300">
                {{ publication.description }}
              </div>
            </div>

            <div v-if="publication.tags" class="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-sm">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-tag" class="w-5 h-5 text-gray-400" />
                <CommonTags
                  :tags="publication.tags"
                  clickable
                  color="primary"
                  variant="soft"
                  size="sm"
                  badge-class="font-medium"
                />
              </div>
            </div>
          </div>

          <div v-if="publication.media && publication.media.length > 0" class="mt-10 mb-8">
            <MediaGallery :media="publication.media" :publication-id="publication.id" :editable="false" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
