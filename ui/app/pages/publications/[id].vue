<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { usePublications } from '~/composables/usePublications'
import { useChannels } from '~/composables/useChannels'
import { usePosts } from '~/composables/usePosts'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { useSocialPosting } from '~/composables/useSocialPosting'
import type { PublicationStatus, PostType } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'
import MediaGallery from '~/components/media/MediaGallery.vue'
import { getUserSelectableStatuses, getStatusColor, getStatusClass } from '~/utils/publications'


definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { fetchProject, currentProject } = useProjects()
const { 
  fetchPublication, 
  currentPublication, 
  isLoading: isPublicationLoading, 
  deletePublication, 
  updatePublication,
  statusOptions 
} = usePublications()
const { fetchChannels, channels } = useChannels()
const { canGoBack, goBack } = useNavigation()

const projectId = computed(() => currentPublication.value?.projectId || '')
const publicationId = computed(() => route.params.id as string)

// Publication problems detection
const { 
  getPublicationProblems, 
  getPublicationProblemLevel 
} = usePublications()

const publicationProblems = computed(() => {
  if (!currentPublication.value) return []
  return getPublicationProblems(currentPublication.value)
})

const isCreatingPost = ref(false)
const isFormCollapsed = ref(true)
const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)

const { updatePost } = usePosts()
const toast = useToast()
const isScheduleModalOpen = ref(false)
const newScheduledDate = ref('')
const isBulkScheduling = ref(false)

// Social posting
const { 
  publishPublication, 
  isPublishing, 
  canPublishPublication 
} = useSocialPosting()

// Determine available channels (in project but not yet in publication)
const availableChannels = computed(() => {
    if (!channels.value || !currentPublication.value) return []
    const usedChannelIds = currentPublication.value.posts?.map((p: any) => p.channelId) || []
    return channels.value.filter(ch => !usedChannelIds.includes(ch.id))
})

const allPostsPublished = computed(() => {
    if (!currentPublication.value?.posts) return false
    return currentPublication.value.posts.every((p: any) => !!p.publishedAt)
})

const isContentEmpty = computed(() => {
    return !currentPublication.value?.content || currentPublication.value.content.trim() === ''
})

const hasMedia = computed(() => {
    return currentPublication.value?.media && currentPublication.value.media.length > 0
})

const isContentOrMediaMissing = computed(() => {
    return isContentEmpty.value && !hasMedia.value
})

const displayTitle = computed(() => {
  if (currentPublication.value?.title) {
    return stripHtmlAndSpecialChars(currentPublication.value.title)
  }
  if (currentPublication.value?.content) {
    const cleaned = stripHtmlAndSpecialChars(currentPublication.value.content)
    if (cleaned) return cleaned
  }
  return t('post.untitled')
})

const majoritySchedule = computed(() => {
    if (!currentPublication.value?.posts?.length) return { date: null, conflict: false }
    
    // Collect dates: prefer scheduledAt, then publishedAt
    const dates = currentPublication.value.posts
        .map((p: any) => p.scheduledAt || p.publishedAt)
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

onMounted(async () => {
    // Check if this is a newly created publication (from modal)
    const isNewlyCreated = route.query.new === 'true'
    if (isNewlyCreated) {
        isFormCollapsed.value = false
        // Clean up query param
        router.replace({ query: {} })
    }
    
    // Fetch publication first to get projectId
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }

    // Fetch project if needed
    if (projectId.value && (!currentProject.value || currentProject.value.id !== projectId.value)) {
        await fetchProject(projectId.value)
    }
    
    if (projectId.value) {
        await fetchChannels({ projectId: projectId.value })
    }
})

/**
 * Handle successful publication update
 */
function handleSuccess(id: string) {
  // Refresh the data instead of navigating back
  if (publicationId.value) {
      fetchPublication(publicationId.value)
  }
}

/**
 * Handle post creation success
 */
async function handlePostCreated() {
    isCreatingPost.value = false
    // Refresh publication to show new post
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }
}

/**
 * Handle post deletion
 */
async function handlePostDeleted() {
    // Refresh publication to remove deleted post
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }
}

/**
 * Handle cancel
 */
function handleCancel() {
  goBack()
}

async function handleArchiveToggle() {
    if (!currentPublication.value) return
    await fetchPublication(currentPublication.value.id)
}

async function handleDelete() {
    if (!currentPublication.value) return
    
    const pid = projectId.value // Capture project ID
    
    isDeleting.value = true
    const success = await deletePublication(currentPublication.value.id)
    isDeleting.value = false
    if (success) {
        isDeleteModalOpen.value = false
        // Navigate to project page as the parent context
        router.push(`/projects/${pid}`)
    }
}

function openScheduleModal() {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) // Adjust for local input
    newScheduledDate.value = now.toISOString().slice(0, 16)
    isScheduleModalOpen.value = true
}

async function handleBulkSchedule() {
    if (!currentPublication.value) return
    if (!newScheduledDate.value) return

    isBulkScheduling.value = true
    try {
        // Update only the publication's scheduledAt
        await updatePublication(currentPublication.value.id, {
            scheduledAt: new Date(newScheduledDate.value).toISOString()
        })
        
        toast.add({
            title: t('common.success'),
            description: t('publication.scheduleUpdated'),
            color: 'success'
        })

        isScheduleModalOpen.value = false
        // Refresh publication
        if (currentPublication.value) {
            await fetchPublication(currentPublication.value.id)
        }
    } catch (err: any) {
        console.error('Failed to schedule publication:', err)
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isBulkScheduling.value = false
    }
}

// Language and Type Editing
const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()

const isLanguageModalOpen = ref(false)
const isTypeModalOpen = ref(false)
const newLanguage = ref('')
const newPostType = ref<PostType>('POST')
const isUpdatingLanguage = ref(false)
const isUpdatingType = ref(false)

const userSelectableStatuses = computed(() => getUserSelectableStatuses(t))

const displayStatusOptions = computed(() => {
    const options = [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') }
    ]
    
    if (currentPublication.value && !['DRAFT', 'READY'].includes(currentPublication.value.status)) {
        options.push({
            value: currentPublication.value.status,
            label: statusOptions.value.find(s => s.value === currentPublication.value?.status)?.label || currentPublication.value.status,
            isSystem: true
        } as any)
    }
    
    return options
})

function openLanguageModal() {
    if (!currentPublication.value) return
    newLanguage.value = currentPublication.value.language
    isLanguageModalOpen.value = true
}

function openTypeModal() {
    if (!currentPublication.value) return
    isTypeModalOpen.value = true
}

async function handleUpdateLanguage() {
    if (!currentPublication.value) return
    isUpdatingLanguage.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            language: newLanguage.value
        })
        toast.add({ title: t('common.success'), color: 'success' })
        isLanguageModalOpen.value = false
        await fetchPublication(currentPublication.value.id)
    } finally {
        isUpdatingLanguage.value = false
    }
}

async function handleUpdateTypeOption(type: PostType) {
    if (!currentPublication.value) return
    if (currentPublication.value.postType === type) {
        isTypeModalOpen.value = false
        return
    }
    newPostType.value = type
    isUpdatingType.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            postType: type
        })
        toast.add({ title: t('common.success'), color: 'success' })
        isTypeModalOpen.value = false
        await fetchPublication(currentPublication.value.id)
    } finally {
        isUpdatingType.value = false
    }
}

const newStatus = ref<PublicationStatus>('DRAFT')
const isUpdatingStatus = ref(false)

async function handleUpdateStatusOption(status: PublicationStatus) {
    if (!currentPublication.value) return
    if (currentPublication.value.status === status) {
        return
    }
    
    // Check content or media requirement for READY status
    if (status === 'READY' && isContentOrMediaMissing.value) {
        toast.add({
            title: t('common.error'),
            description: t('publication.validation.contentOrMediaRequired'),
            color: 'error'
        })
        return
    }

    newStatus.value = status
    isUpdatingStatus.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            status: status
        })
        toast.add({ title: t('common.success'), color: 'success' })
        await fetchPublication(currentPublication.value.id)
    } finally {
        isUpdatingStatus.value = false
    }
}

function toggleFormCollapse() {
  isFormCollapsed.value = !isFormCollapsed.value
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

async function handlePublishNow() {
  if (!currentPublication.value) return
  
  try {
    const result = await publishPublication(currentPublication.value.id)
    
    if (result.success) {
      const totalPosts = (result.data?.publishedCount || 0) + (result.data?.failedCount || 0)
      const isPartial = result.data?.failedCount && result.data.failedCount > 0
      
      toast.add({
        title: t('common.success'),
        description: isPartial 
          ? t('publication.publishSuccessPartial')
          : t('publication.publishSuccess'),
        color: isPartial ? 'warning' : 'success'
      })
      
      // Refresh publication
      await fetchPublication(currentPublication.value.id)
    }
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('publication.publishError'),
      color: 'error'
    })
  }
}
</script>


<template>
  <div class="max-w-4xl mx-auto">
    <!-- Delete Confirmation Modal (Moved to top level for better portal handling) -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('publication.deleteConfirm') }}
            </h3>
          </div>

          <p class="text-gray-500 dark:text-gray-400 mb-6">
            {{ t('publication.deleteCascadeWarning') }}
          </p>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isDeleteModalOpen = false"
            ></UButton>
            <UButton
              color="error"
              :label="t('common.delete')"
              :loading="isDeleting"
              @click="handleDelete"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Schedule Modal -->
    <UModal v-model:open="isScheduleModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-gray-900 dark:text-white mb-4">
            <UIcon name="i-heroicons-clock" class="w-6 h-6 text-primary-500"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('publication.changeScheduleTitle') }}
            </h3>
          </div>

          <p class="text-gray-500 dark:text-gray-400 mb-4">
            {{ t('publication.changeScheduleInfo') }}
          </p>

          <UFormField :label="t('publication.newScheduleTime')" required class="mb-6">
            <UInput v-model="newScheduledDate" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
          </UFormField>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isScheduleModalOpen = false"
            ></UButton>
            <UButton
              color="primary"
              :label="t('common.save')"
              :loading="isBulkScheduling"
              @click="handleBulkSchedule"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Language Change Modal -->
    <UModal v-model:open="isLanguageModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-gray-900 dark:text-white mb-4">
            <UIcon name="i-heroicons-language" class="w-6 h-6 text-primary-500"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('publication.changeLanguage') }}
            </h3>
          </div>

          <UFormField :label="t('common.language')" required class="mb-6">
             <USelectMenu
                v-model="newLanguage"
                :items="languageOptions"
                value-key="value"
                label-key="label"
                class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isLanguageModalOpen = false"
            ></UButton>
            <UButton
              color="primary"
              :label="t('common.save')"
              :loading="isUpdatingLanguage"
              @click="handleUpdateLanguage"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Post Type Change Modal -->
    <UModal v-model:open="isTypeModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3 text-gray-900 dark:text-white">
              <UIcon name="i-heroicons-document-duplicate" class="w-6 h-6 text-primary-500"></UIcon>
              <h3 class="text-lg font-medium">
                {{ t('publication.changeType') }}
              </h3>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="isTypeModalOpen = false"
            />
          </div>

          <div class="space-y-2">
            <UButton
              v-for="option in typeOptions"
              :key="option.value"
              :label="option.label"
              :variant="currentPublication?.postType === option.value ? 'soft' : 'ghost'"
              :color="currentPublication?.postType === option.value ? 'primary' : 'neutral'"
              class="w-full justify-start"
              :loading="isUpdatingType && newPostType === option.value"
              @click="handleUpdateTypeOption(option.value as PostType)"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Status Change Modal removed in favor of button group -->

    <!-- Back button -->
    <div class="mb-6">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        class="-ml-2.5"
        :disabled="!canGoBack"
        @click="handleCancel"
      >
        <span class="flex items-center gap-1">
          {{ t('common.back') }}
          <span v-if="currentProject" class="text-gray-500 font-normal">
            to {{ currentProject.name }}
          </span>
        </span>
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="isPublicationLoading && !currentPublication" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin"></UIcon>
    </div>

    <div v-else-if="currentPublication" class="space-y-6 pb-12">
        <!-- Archived Status Banner -->
        <CommonArchivedBanner
            v-if="currentPublication.archivedAt"
            :title="t('publication.archived_notice')"
            :description="t('publication.archived_info_banner')"
            :entity-type="ArchiveEntityType.PUBLICATION"
            :entity-id="currentPublication.id"
            @restore="() => fetchPublication(publicationId)"
        />

        <!-- Problems Banner -->
        <CommonProblemBanner
          v-if="publicationProblems.length > 0"
          :problems="publicationProblems"
          entity-type="publication"
          class="mb-6"
        />

        <!-- Content Empty Banner -->
        <UAlert
          v-if="isContentOrMediaMissing"
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          :title="t('publication.validation.contentOrMediaRequired')"
          class="mb-6"
        />

        <!-- Block 1: Publication Info & Actions (Non-collapsible) -->
        <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
            <div class="p-6">
                <!-- Header with title and actions -->
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-gray-500"></UIcon>
                        {{ t('publication.edit') }}
                    </h2>
                    
                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2">
                        <UiArchiveButton
                            :key="currentPublication.archivedAt ? 'archived' : 'active'"
                            :entity-type="ArchiveEntityType.PUBLICATION"
                            :entity-id="currentPublication.id"
                            :is-archived="!!currentPublication.archivedAt"
                            @toggle="handleArchiveToggle"
                        />

                        <UButton
                            :label="t('common.delete')"
                            icon="i-heroicons-trash"
                            variant="soft"
                            size="sm"
                            color="error"
                            @click="isDeleteModalOpen = true"
                        ></UButton>
                    </div>
                </div>

                <!-- Metadata Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <!-- Zone 1: Created, Project/Channel Info, Scheduled -->
                    <div>
                        <!-- Project and Channel Info -->
                        <div v-if="currentPublication.project" class="mb-3">
                            <!-- Project -->
                            <div v-if="currentPublication.project" class="flex items-center gap-1 text-xs mb-1">
                                <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5 text-gray-400" />
                                <NuxtLink 
                                    :to="`/projects/${currentPublication.project.id}`"
                                    class="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                                >
                                    {{ currentPublication.project.name }}
                                </NuxtLink>
                            </div>
                            

                        </div>

                        <!-- Created -->
                        <div class="text-gray-500 dark:text-gray-400 mb-1">{{ t('post.createdAt') }}</div>
                        <div class="text-gray-900 dark:text-white font-medium">
                            {{ formatDate(currentPublication.createdAt) }}
                        </div>
                        <div v-if="currentPublication.creator" class="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                            {{ currentPublication.creator.fullName || currentPublication.creator.telegramUsername || t('common.unknown') }}
                        </div>
                        
                        <div v-if="!allPostsPublished || currentPublication.scheduledAt" class="mt-2 border-t border-gray-100 dark:border-gray-700/50 pt-2">
                             <div class="text-gray-500 dark:text-gray-400 text-xs mb-1">
                                {{ t('post.scheduledAt') }}
                             </div>
                             <div class="flex flex-col gap-2 items-start">
                                 <div v-if="currentPublication.scheduledAt" class="text-gray-900 dark:text-white font-medium">
                                      {{ formatDate(currentPublication.scheduledAt) }}
                                 </div>
                                 <div v-else class="text-gray-400 italic text-xs">
                                      {{ t('common.noData') }}
                                 </div>

                                 <UTooltip :text="isContentOrMediaMissing ? t('publication.validation.contentOrMediaRequired') : ''">
                                    <UButton
                                        :label="t('publication.changeSchedule')"
                                        icon="i-heroicons-clock"
                                        variant="soft"
                                        size="xs"
                                        color="primary"
                                        :disabled="allPostsPublished || isContentOrMediaMissing"
                                        @click="openScheduleModal"
                                    ></UButton>
                                </UTooltip>
                                
                                <UTooltip :text="!canPublishPublication(currentPublication) ? t('publication.cannotPublish') : ''">
                                    <UButton
                                        :label="t('publication.publishNow')"
                                        icon="i-heroicons-paper-airplane"
                                        variant="soft"
                                        size="xs"
                                        color="success"
                                        :disabled="!canPublishPublication(currentPublication)"
                                        :loading="isPublishing"
                                        @click="handlePublishNow"
                                    ></UButton>
                                </UTooltip>
                             </div>
                        </div>
                    </div>

                    <!-- Zone 2: Status, Language and Type Column -->
                    <div class="space-y-4">
                        <!-- Status -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs flex items-center gap-1.5">
                                {{ t('post.statusLabel') }}
                                <UPopover :popper="{ placement: 'top' }">
                                    <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                                    <template #content>
                                        <div class="p-3 max-w-xs text-xs whitespace-pre-line">
                                            {{ t('publication.changeStatusWarningReset') }}
                                        </div>
                                    </template>
                                </UPopover>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="inline-flex gap-px shadow-sm">
                                    <UButton
                                        v-for="option in displayStatusOptions"
                                        :key="option.value"
                                        :label="option.label"
                                        color="neutral"
                                        :disabled="((option as any).isSystem && currentPublication?.status === option.value) || (option.value === 'READY' && isContentOrMediaMissing && currentPublication?.status === 'DRAFT')"
                                        class="rounded-none first:rounded-l-md last:rounded-r-md transition-opacity"
                                        :class="[
                                            getStatusClass(option.value as PublicationStatus),
                                            currentPublication?.status !== option.value ? 'opacity-40 hover:opacity-100' : ''
                                        ]"
                                        @click="handleUpdateStatusOption(option.value as PublicationStatus)"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Language -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('common.language') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-language" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base">
                                    {{ languageOptions.find(l => l.value === currentPublication?.language)?.label || currentPublication?.language }}
                                </span>
                                <UButton
                                    icon="i-heroicons-pencil-square"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    @click="openLanguageModal"
                                />
                            </div>
                        </div>

                         <!-- Type -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('post.postType') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base">
                                    {{ typeOptions.find(t => t.value === currentPublication?.postType)?.label || currentPublication?.postType }}
                                </span>
                                <UButton
                                    icon="i-heroicons-pencil-square"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    @click="openTypeModal"
                                />
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </div>

        <!-- Media Gallery (always expanded, horizontal scroll) -->
        <MediaGallery
          v-if="currentPublication"
          :media="currentPublication.media || []"
          :publication-id="currentPublication.id"
          :editable="true"
          @refresh="() => fetchPublication(publicationId)"
        />

        <!-- Block 2: Collapsible Publication Form (styled like PostEditBlock) -->
        <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
            <!-- Header -->
            <div 
                class="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors select-none group"
                @click="toggleFormCollapse"
            >
                <div class="flex items-start justify-between">
                    <div class="flex-1 space-y-2">
                        <div class="flex items-center gap-2">
                             <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors"></UIcon>
                             <h3 class="font-semibold text-gray-900 dark:text-white" :class="{ 'italic text-gray-500 font-medium': !currentPublication.title && !stripHtmlAndSpecialChars(currentPublication.content) }">
                                {{ displayTitle }}
                             </h3>
                        </div>
                        
                        <!-- Content Preview -->
                        <p v-if="currentPublication.content" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {{ stripHtmlAndSpecialChars(currentPublication.content) }}
                        </p>

                        <!-- Tags -->
                        <div v-if="currentPublication.tags" class="flex flex-wrap gap-1 mt-2">
                            <span 
                                v-for="tag in currentPublication.tags.split(',')" 
                                :key="tag"
                                class="text-xxs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded font-mono"
                            >
                                #{{ tag.trim() }}
                            </span>
                        </div>

                        <!-- Translation Info -->
                         <div v-if="currentPublication.translations && currentPublication.translations.length > 0" class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                             <UIcon name="i-heroicons-language" class="w-3.5 h-3.5 text-gray-400" />
                             <span class="text-xs text-gray-500">{{ t('publication.linked') }}:</span>
                             <div class="flex gap-1.5">
                                 <NuxtLink 
                                    v-for="trans in currentPublication.translations" 
                                    :key="trans.id"
                                    :to="`/publications/${trans.id}`"
                                    class="hover:opacity-80 transition-opacity"
                                 >
                                     <UBadge 
                                        color="neutral"
                                        variant="soft"
                                        size="sm"
                                        class="uppercase font-mono text-[10px] cursor-pointer"
                                     >
                                        {{ trans.language }}
                                     </UBadge>
                                 </NuxtLink>
                             </div>
                        </div>
                    </div>

                    <!-- Expand/Collapse Button -->
                    <UButton
                        variant="ghost"
                        color="neutral"
                        size="sm"
                        :icon="isFormCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
                        class="ml-4 shrink-0"
                    ></UButton>
                </div>
            </div>

            <!-- Collapsible Content -->
            <div 
                v-show="!isFormCollapsed" 
                class="border-t border-gray-200 dark:border-gray-700/50 p-6 bg-gray-50/50 dark:bg-gray-900/20"
            >
                <FormsPublicationForm
                  :project-id="projectId"
                  :publication="currentPublication"
                  @success="handleSuccess"
                  @cancel="handleCancel"
                ></FormsPublicationForm>
            </div>
        </div>

        <!-- Linked Posts Section -->
        <div>
          <div v-if="currentPublication.posts && currentPublication.posts.length > 0">
              <div class="flex items-center gap-2 mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('publication.postsInChannels') }}
                </h3>
              </div>
              
              <div class="space-y-4">
                <PostsPostEditBlock
                  v-for="post in currentPublication.posts"
                  :key="post.id"
                  :post="post"
                  :publication="currentPublication"
                  @deleted="handlePostDeleted"
                  @success="() => fetchPublication(publicationId)"
                ></PostsPostEditBlock>

                <PostsPostEditBlock 
                    v-if="isCreatingPost"
                    is-creating
                    :publication="currentPublication"
                    :available-channels="availableChannels"
                    @success="handlePostCreated"
                    @cancel="isCreatingPost = false"
                ></PostsPostEditBlock>
              </div>
          </div>
          <div v-else class="text-center py-6 text-gray-500">
              <p>{{ t('publication.noPosts') }}</p>
               <PostsPostEditBlock 
                    v-if="isCreatingPost"
                    is-creating
                    :publication="currentPublication"
                    :available-channels="availableChannels"
                    class="mt-4"
                    @success="handlePostCreated"
                    @cancel="isCreatingPost = false"
                ></PostsPostEditBlock>
          </div>

          <div v-if="!isCreatingPost && availableChannels.length > 0" class="mt-4 flex justify-center">
            <UButton
                variant="soft"
                color="primary"
                icon="i-heroicons-plus"
                @click="isCreatingPost = true"
            >
                {{ t('publication.addChannelToPublication') }}
            </UButton>
          </div>
        </div>
    </div>
    
    <!-- Error/Not Found -->
    <div v-else class="text-center py-12">
        <p class="text-gray-500">{{ t('errors.notFound') }}</p>
    </div>
  </div>
</template>
