<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { usePosts } from '~/composables/usePosts'
import { useFormatters } from '~/composables/useFormatters'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getStatusIcon } from '~/utils/publications'
import { getSocialMediaIcon, getSocialMediaDisplayName } from '~/utils/socialMedia'
import { SocialPostingBodyFormatter } from '~/utils/bodyFormatter'
import { ArchiveEntityType } from '~/types/archive.types'
import type { MediaItem } from '~/composables/useMedia'
import MediaGallery from '~/components/media/MediaGallery.vue'
import { getPostUrl } from '~/utils/posts'
import { usePublicationActions } from '~/composables/usePublicationActions'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { 
  fetchPublication, 
  currentPublication, 
  isLoading,
  updatePublication,
  deletePublication,
  copyPublication,
  getStatusColor
} = usePublications()
const { fetchProject, currentProject, fetchProjects, projects } = useProjects()
const { updatePost } = usePosts()
const { formatDateWithTime, formatDateShort } = useFormatters()
const {
  majoritySchedule,
  normalizedPublicationMeta,
  applyLlmResult: applyLlm
} = usePublicationActions(currentPublication)

const publicationId = computed(() => route.params.id as string)

onMounted(async () => {
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
        if (currentPublication.value?.projectId) {
            await fetchProject(currentPublication.value.projectId)
        }
    }
})

const collections = computed(() => [
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

const showDescription = computed(() => {
  if (!currentPublication.value?.description) return false
  
  // Show for ARTICLE, NEWS and for publications with SITE posts
  if (['ARTICLE', 'NEWS'].includes(currentPublication.value.postType)) return true
  
  return currentPublication.value.posts?.some(post => {
    const socialMedia = post.channel?.socialMedia || post.socialMedia
    return socialMedia === 'site'
  })
})

const isPreviewModalOpen = ref(false)
const selectedPost = ref<any>(null)

function showPostPreview(post: any) {
  selectedPost.value = post
  isPreviewModalOpen.value = true
}

const isAnyPostPublished = computed(() => {
    return currentPublication.value?.posts?.some(p => !!p.publishedAt) ?? false
})

// Action buttons logic
const showLlmModal = ref(false)
const llmModalRef = ref<any>(null)
const isDeleting = ref(false)
const isDeleteModalOpen = ref(false)
const isDuplicateModalOpen = ref(false)
const isContentActionModalOpen = ref(false)
const contentActionMode = ref<'copy' | 'move'>('copy')

const isLocked = computed(() => !!currentPublication.value?.archivedAt || !!currentProject.value?.archivedAt)


const moreActions = computed(() => [
  [
    {
      label: t('publication.copyToContentLibrary'),
      icon: 'i-heroicons-arrow-down-on-square-stack',
      click: () => {
        contentActionMode.value = 'copy'
        isContentActionModalOpen.value = true
      },
      disabled: false,
      class: ''
    },
    {
      label: t('publication.moveToContentLibrary'),
      icon: 'i-heroicons-arrow-right-start-on-rectangle',
      click: () => {
        contentActionMode.value = 'move'
        isContentActionModalOpen.value = true
      },
      disabled: false,
      class: ''
    },
    {
      label: t('common.duplicate', 'Duplicate'),
      icon: 'i-heroicons-document-duplicate',
      click: openDuplicateModal,
      disabled: false,
      class: ''
    }
  ],
  [
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      class: 'text-error-500 hover:text-error-600',
      click: () => { isDeleteModalOpen.value = true },
      disabled: false
    }
  ]
])

async function handleArchiveToggle() {
    if (!currentPublication.value) return
    await fetchPublication(currentPublication.value.id)
}

async function handleDelete() {
    if (!currentPublication.value) return
    isDeleting.value = true
    try {
        await deletePublication(currentPublication.value.id)
        toast.add({
            title: t('common.success'),
            color: 'success'
        })
        router.push('/publications')
    } catch (err: any) {
        toast.add({
            title: t('common.error'),
            description: t('common.deleteError'),
            color: 'error'
        })
    } finally {
        isDeleting.value = false
        isDeleteModalOpen.value = false
    }
}

function openDuplicateModal() {
    if (!currentPublication.value) return
    isDuplicateModalOpen.value = true
}

function handleDuplicateSuccess(id: string) {
    isDuplicateModalOpen.value = false
    router.push(`/publications/${id}/edit`)
}


function onTagClick(tag: string) {
  router.push({
    path: '/publications',
    query: {
      projectId: currentPublication.value?.projectId,
      tags: tag
    }
  })
}

async function handleApplyLlm(data: any) {
  await applyLlm(data, {
    onSuccess: () => llmModalRef.value?.onApplySuccess(),
    onError: () => llmModalRef.value?.onApplyError()
  })
}

</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-6 px-4">
    <!-- Collection Switcher -->
    <div class="mb-8 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <nav class="-mb-px flex space-x-8" aria-label="Collections">
        <NuxtLink
          v-for="collection in collections"
          :key="collection.to"
          :to="collection.to"
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="[
            route.path === collection.to
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon :name="collection.icon" class="mr-2 h-5 w-5" :class="[route.path === collection.to ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500']" />
          {{ collection.label }}
        </NuxtLink>
      </nav>

      <!-- Action Buttons -->
      <div v-if="currentPublication" class="flex items-center gap-2 pb-2">
        <UTooltip :text="t('llm.tooltip')">
          <UButton
            icon="i-heroicons-sparkles"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="isLocked"
            @click="showLlmModal = true"
          />
        </UTooltip>

        <UiArchiveButton
          :key="currentPublication.archivedAt ? 'archived' : 'active'"
          :entity-type="ArchiveEntityType.PUBLICATION"
          :entity-id="currentPublication.id"
          :is-archived="!!currentPublication.archivedAt"
          @toggle="handleArchiveToggle"
        />

        <UDropdownMenu :items="moreActions" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
            size="sm"
          />
          <template #item="{ item }">
            <div class="flex items-center gap-2 w-full truncate" :class="[(item as any).class || '', { 'opacity-50 cursor-not-allowed': item.disabled }]" @click="!item.disabled && item.click && item.click()">
              <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </div>
          </template>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !currentPublication" class="flex items-center justify-center py-12">
      <UiLoadingSpinner size="md" />
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
                <UTooltip v-if="majoritySchedule.conflict" :text="t('publication.scheduleConflict', 'Individual channels have different scheduled dates')">
                  <span class="ml-1 text-orange-500 cursor-help">*</span>
                </UTooltip>
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

            <!-- News Source Link -->
            <a 
              v-if="currentPublication.meta?.newsData?.url" 
              :href="currentPublication.meta.newsData.url" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <UBadge variant="soft" color="info" class="hover:bg-info-100 dark:hover:bg-info-900/30 transition-colors cursor-pointer font-normal">
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4 mr-1 text-info-500" />
                {{ currentPublication.meta.newsData.source || t('news.source', 'News Source') }}
              </UBadge>
            </a>
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
              <UTooltip v-if="getPostUrl(post)" :text="t('post.openPublishedPost', 'Open published post')">
                <a 
                  :href="getPostUrl(post)!" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                </a>
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
                <h3 class="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-3.5 h-3.5" />
                  {{ t('post.authorComment') }}
                </h3>
                <div class="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  {{ currentPublication.authorComment }}
                </div>
              </div>

              <!-- Description -->
              <div v-if="showDescription" class="mt-3">
                <h3 class="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
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
                    <CommonTags
                      :tags="currentPublication.tags"
                      clickable
                      color="primary"
                      variant="soft"
                      size="sm"
                      badge-class="font-medium"
                      @tag-click="onTagClick"
                    />
                  </div>
              </div>
            </div>


            <!-- Media Gallery -->
            <div v-if="currentPublication.media && currentPublication.media.length > 0" class="mt-10 mb-8">
              <MediaGallery 
                :media="(currentPublication.media as any)" 
                :publication-id="currentPublication.id"
                :editable="false"
                @refresh="() => fetchPublication(publicationId)"
              />
            </div>
            
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <ModalsPostPreviewModal
      v-model="isPreviewModalOpen"
      :post="selectedPost"
      :publication="currentPublication"
    />

    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-if="isDeleteModalOpen"
      v-model:open="isDeleteModalOpen"
      :title="t('publication.deleteConfirm')"
      :description="t('publication.deleteCascadeWarning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="handleDelete"
    />

    <!-- Duplicate Publication Modal -->
    <ModalsCreatePublicationModal
      v-if="currentPublication"
      v-model:open="isDuplicateModalOpen"
      :project-id="currentPublication.projectId || undefined"
      :preselected-language="currentPublication.language"
      :preselected-post-type="currentPublication.postType as any"
      :preselected-channel-ids="currentPublication.posts?.map((p: any) => p.channelId)"
      allow-project-selection
      :prefilled-title="currentPublication.title || ''"
      :prefilled-description="currentPublication.description || ''"
      :prefilled-author-comment="currentPublication.authorComment || ''"
      :prefilled-content="currentPublication.content || ''"
      :prefilled-tags="currentPublication.tags"
      :prefilled-meta="normalizedPublicationMeta"
      :prefilled-note="currentPublication.note || ''"
      :prefilled-media-ids="currentPublication.media?.map((m: any) => ({ id: m.media?.id, hasSpoiler: m.hasSpoiler }))"
      :prefilled-content-item-ids="currentPublication.contentItems?.map((ci: any) => ci.contentItemId)"
      :prefilled-author-signature-id="currentPublication.authorSignatureId || undefined"
      :prefilled-project-template-id="currentPublication.projectTemplateId || undefined"
      @success="handleDuplicateSuccess"
    />

    <!-- Content Action Modal (Copy/Move to Content Library) -->
    <ContentCreateItemFromPublicationModal
      v-if="currentPublication"
      v-model:open="isContentActionModalOpen"
      :publication-id="currentPublication.id"
      :scope="currentPublication.projectId ? 'project' : 'personal'"
      :project-id="currentPublication.projectId || undefined"
      :mode="contentActionMode"
    />

    <!-- LLM Generator Modal -->
    <ModalsLlmGeneratorModal
      v-if="currentPublication"
      ref="llmModalRef"
      v-model:open="showLlmModal"
      :publication-id="currentPublication.id"
      :content="currentPublication.content || undefined"
      :title="currentPublication.title || undefined"
      :media="(currentPublication.media || []).map(m => m.media).filter(Boolean) as unknown as MediaItem[]"
      :project-id="currentPublication.projectId || undefined"
      :publication-meta="normalizedPublicationMeta"
      :post-type="currentPublication.postType || undefined"
      :publication-language="currentPublication.language || undefined"
      :post-channels="(currentPublication.posts || []).map((p: any) => ({
        channelId: p.channelId,
        channelName: p.channel?.name || '',
        language: p.channel?.language || currentPublication!.language,
        tags: p.channel?.tags ? p.channel.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        socialMedia: p.channel?.socialMedia,
      }))"
      @apply="handleApplyLlm"
    />
  </div>
</template>
