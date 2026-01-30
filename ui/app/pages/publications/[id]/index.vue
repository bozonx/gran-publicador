<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useFormatters } from '~/composables/useFormatters'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getStatusColor, getStatusIcon } from '~/utils/publications'
import { getSocialMediaIcon, getSocialMediaDisplayName } from '~/utils/socialMedia'
import { SocialPostingBodyFormatter } from '~/utils/bodyFormatter'
import MediaGallery from '~/components/media/MediaGallery.vue'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const { fetchPublication, currentPublication, isLoading } = usePublications()
const { fetchProject, currentProject } = useProjects()
const { formatDateWithTime, formatDateShort } = useFormatters()

const publicationId = computed(() => route.params.id as string)

onMounted(async () => {
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
        if (currentPublication.value?.projectId) {
            await fetchProject(currentPublication.value.projectId)
        }
    }
})

const tabs = computed(() => [
  { label: t('common.view', 'View'), icon: 'i-heroicons-eye', to: `/publications/${publicationId.value}` },
  { label: t('common.edit', 'Edit'), icon: 'i-heroicons-pencil-square', to: `/publications/${publicationId.value}/edit` }
])

const displayTitle = computed(() => {
  if (currentPublication.value?.title) {
    return stripHtmlAndSpecialChars(currentPublication.value.title)
  }
  return t('post.untitled')
})

const isArchived = computed(() => !!currentPublication.value?.archivedAt)
const isProjectArchived = computed(() => !!currentProject.value?.archivedAt)
const hasArchivedChannels = computed(() => currentPublication.value?.posts?.some(p => !!p.channel?.archivedAt))
const hasInactiveChannels = computed(() => currentPublication.value?.posts?.some(p => p.channel?.isActive === false))

const isPreviewModalOpen = ref(false)
const previewContent = ref('')
const previewTitle = ref('')

const showDescription = computed(() => {
  if (!currentPublication.value?.description) return false
  
  // Show for ARTICLE and for publications with SITE posts
  if (currentPublication.value.postType === 'ARTICLE') return true
  
  return currentPublication.value.posts?.some(post => {
    const socialMedia = post.channel?.socialMedia || post.socialMedia
    return socialMedia === 'SITE'
  })
})

async function showPostPreview(post: any) {
  if (!currentPublication.value) return

  previewTitle.value = getSocialMediaDisplayName(post.channel?.socialMedia || post.socialMedia, t)
  
  // Author signature is already stored as text in the post
  const authorSignatureContent = post.authorSignature || ''

  previewContent.value = SocialPostingBodyFormatter.format(
    {
      title: currentPublication.value.title,
      content: post.content || currentPublication.value.content,
      tags: post.tags || currentPublication.value.tags,
      postType: currentPublication.value.postType as any,
      language: post.language || currentPublication.value.language,
      authorComment: currentPublication.value.authorComment,
      authorSignature: authorSignatureContent,
    },
    post.channel || post,
    post.template
  )
  
  isPreviewModalOpen.value = true
}

const majoritySchedule = computed(() => {
    if (!currentPublication.value?.posts?.length) return { date: null, conflict: false }
    
    // Collect dates: prefer publishedAt, then scheduledAt
    const dates = currentPublication.value.posts
        .map((p: any) => p.publishedAt || p.scheduledAt)
        .filter((d: string | null) => !!d) as string[]

    if (dates.length === 0) return { date: null, conflict: false }

    const counts: Record<string, number> = {}
    dates.forEach(d => {
        counts[d] = (counts[d] || 0) + 1
    })

    let maxCount = 0
    let majorityDate = null
    
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

const isAnyPostPublished = computed(() => {
    return currentPublication.value?.posts?.some(p => !!p.publishedAt) ?? false
})

</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-6 px-4">
    <!-- Tab Switcher -->
    <div class="mb-8 border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="[
            route.path === tab.to
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon :name="tab.icon" class="mr-2 h-5 w-5" :class="[route.path === tab.to ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500']" />
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !currentPublication" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin"></UIcon>
    </div>

    <!-- Content -->
    <div v-else-if="currentPublication" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="p-6">
          <!-- Title Section -->
          <div class="mb-4">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ displayTitle }}
            </h1>
          </div>

          <!-- Badge Row -->
          <div class="flex flex-wrap gap-2 mb-6">
            <!-- Scheduling info -->
            <UBadge 
              :color="isAnyPostPublished ? 'success' : 'primary'" 
              variant="soft" 
              class="font-normal"
            >
              <span class="text-gray-400 mr-1">
                {{ isAnyPostPublished ? t('post.publishedAt') : t('post.scheduledAt') }}:
              </span>
              <span :class="majoritySchedule.date ? (isAnyPostPublished ? 'text-success-600 dark:text-success-400 font-medium' : 'text-primary-600 dark:text-primary-400 font-medium') : 'text-success-600 dark:text-success-400'">
                {{ majoritySchedule.date ? formatDateWithTime(majoritySchedule.date) : t('common.none') }}
                <span v-if="majoritySchedule.conflict" class="ml-1 text-orange-500">*</span>
              </span>
            </UBadge>

            <!-- Archivied status for publication -->
            <UBadge v-if="isArchived" color="error" variant="solid" class="flex items-center gap-1 font-bold">
              <UIcon name="i-heroicons-archive-box" class="w-4 h-4" />
              {{ t('common.archived') }}
            </UBadge>

            <!-- Problem: Project Archived -->
            <UBadge v-if="isProjectArchived" color="warning" variant="subtle" class="flex items-center gap-1 font-medium">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
              {{ t('publication.projectArchived') }}
            </UBadge>

            <!-- Problem: Archived Channels -->
            <UBadge v-if="hasArchivedChannels" color="warning" variant="subtle" class="flex items-center gap-1 font-medium">
              <UIcon name="i-heroicons-archive-box" class="w-4 h-4" />
              {{ t('publication.hasArchivedChannels') }}
            </UBadge>

            <!-- Problem: Inactive Channels -->
            <UBadge v-if="hasInactiveChannels" color="warning" variant="subtle" class="flex items-center gap-1 font-medium">
              <UIcon name="i-heroicons-no-symbol" class="w-4 h-4" />
              {{ t('publication.hasInactiveChannels') }}
            </UBadge>

            <!-- Language -->
            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.language') }}:</span>
              {{ currentPublication.language }}
            </UBadge>
            
            <!-- Post Type -->
            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.type') }}:</span>
              {{ t(`postType.${currentPublication.postType.toLowerCase()}`) }}
            </UBadge>

            <!-- Status -->
            <UBadge 
              :color="getStatusColor(currentPublication.status) as any" 
              variant="soft"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon :name="getStatusIcon(currentPublication.status)" class="w-4 h-4" />
              {{ t(`publicationStatus.${currentPublication.status.toLowerCase()}`) }}
            </UBadge>

            <!-- Project Link -->
            <NuxtLink v-if="currentProject" :to="`/projects/${currentProject.id}`">
              <UBadge variant="soft" color="primary" class="hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer font-normal">
                <UIcon name="i-heroicons-folder" class="w-4 h-4 mr-1 text-primary-500" />
                {{ currentProject.name }}
              </UBadge>
            </NuxtLink>
            <UBadge v-else variant="soft" color="neutral" class="font-normal">
              <UIcon name="i-heroicons-user" class="w-4 h-4 mr-1 text-gray-500" />
              {{ t('publication.personal_draft') }}
            </UBadge>
          </div>

          <!-- Social Media & Dates Row -->
          <div v-if="currentPublication.posts?.length" class="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div v-for="post in currentPublication.posts" :key="post.id" class="flex items-center gap-2">
              <UTooltip :text="t('post.clickToPreview', 'Click to preview post content')">
                <div 
                  class="h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:scale-110 hover:shadow-md transition-all active:scale-95"
                  @click="showPostPreview(post)"
                >
                  <UIcon :name="getSocialMediaIcon(post.channel?.socialMedia || post.socialMedia)" class="w-5 h-5" />
                </div>
              </UTooltip>
            </div>
          </div>

          <!-- Note Section -->
          <div v-if="currentPublication.note" class="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
            <h3 class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              {{ t('post.note') }}
            </h3>
            <p class="text-sm text-amber-800 dark:text-amber-300 italic">
              {{ currentPublication.note }}
            </p>
          </div>

          <!-- Post Date -->
          <div v-if="currentPublication.postDate" class="mb-6 flex items-center gap-2" :title="t('post.postDate')">
             <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-gray-400" />
             <span class="font-medium text-gray-900 dark:text-white">{{ formatDateShort(currentPublication.postDate) }}</span>
          </div>

            <!-- Content Section -->
            <div>
              <div v-if="currentPublication.content" class="max-w-none mb-4">
                <div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50 font-mono text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {{ currentPublication.content }}
                </div>
              </div>

              <!-- Author Comment -->
              <div v-if="currentPublication.authorComment" class="mt-3">
                <h3 class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-3.5 h-3.5" />
                  {{ t('post.authorComment') }}
                </h3>
                <div class="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  {{ currentPublication.authorComment }}
                </div>
              </div>

              <!-- Description -->
              <div v-if="showDescription" class="mt-3">
                <h3 class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
                  {{ t('post.description') }}
                </h3>
                <div class="text-sm text-gray-700 dark:text-gray-300">
                  {{ currentPublication.description }}
                </div>
              </div>

              <!-- Meta Footer (Tags) -->
              <div v-if="currentPublication.tags" class="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-sm">
                 <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-tag" class="w-5 h-5 text-gray-400" />
                    <div class="flex flex-wrap gap-1">
                      <span v-for="tag in currentPublication.tags.split(',')" :key="tag" class="text-primary-600 dark:text-primary-400 font-medium">
                        #{{ tag.trim() }}
                      </span>
                    </div>
                  </div>
              </div>
            </div>


            <!-- Media Gallery -->
            <div class="mt-10 mb-8" v-if="currentPublication.media && currentPublication.media.length > 0">
              <MediaGallery 
                :media="currentPublication.media" 
                :publication-id="currentPublication.id"
                :editable="false"
                @refresh="() => fetchPublication(publicationId)"
              />
            </div>
            
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <UiAppModal 
      v-model:open="isPreviewModalOpen"
      :title="t('post.previewTitle', 'Post Preview')"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-paper-airplane" class="w-5 h-5 text-primary-500" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ t('post.previewTitle', 'Post Preview') }}: {{ previewTitle }}
          </h3>
        </div>
      </template>

      <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
        <pre class="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200">{{ previewContent }}</pre>
      </div>

      <template #footer>
        <UButton color="neutral" variant="soft" @click="isPreviewModalOpen = false">
          {{ t('common.close') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
