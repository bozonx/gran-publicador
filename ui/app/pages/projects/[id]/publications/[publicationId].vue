<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { usePublications } from '~/composables/usePublications'
import { useChannels } from '~/composables/useChannels'
import { usePosts } from '~/composables/usePosts'
import type { PublicationStatus, PostType } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'

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

const projectId = computed(() => route.params.id as string)
const publicationId = computed(() => route.params.publicationId as string)

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

// Determine available channels (in project but not yet in publication)
const availableChannels = computed(() => {
    if (!channels.value || !currentPublication.value) return []
    const usedChannelIds = currentPublication.value.posts?.map((p: any) => p.channelId) || []
    return channels.value.filter(ch => !usedChannelIds.includes(ch.id))
})

const allPostsPublished = computed(() => {
    if (!currentPublication.value?.posts?.length) return false
    return currentPublication.value.posts.every((p: any) => !!p.publishedAt)
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
    
    // Fetch project if needed
    if (projectId.value && (!currentProject.value || currentProject.value.id !== projectId.value)) {
        await fetchProject(projectId.value)
    }
    
    if (projectId.value) {
        await fetchChannels({ projectId: projectId.value })
    }
    
    // Fetch publication
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
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
    isDeleting.value = true
    const success = await deletePublication(currentPublication.value.id)
    isDeleting.value = false
    if (success) {
        isDeleteModalOpen.value = false
        // Navigate to project page as the parent context
        router.push(`/projects/${projectId.value}`)
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
            scheduledAt: new Date(newScheduledDate.value).toISOString(),
            status: 'SCHEDULED'
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
    } finally {
        isBulkScheduling.value = false
    }
}

// Language and Type Editing
const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()

const isLanguageModalOpen = ref(false)
const isTypeModalOpen = ref(false)
const isStatusModalOpen = ref(false)
const newLanguage = ref('')
const newPostType = ref<PostType>('POST')
const newStatus = ref<PublicationStatus>('DRAFT')
const isUpdatingLanguage = ref(false)
const isUpdatingType = ref(false)
const isUpdatingStatus = ref(false)

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

function openStatusModal() {
    if (!currentPublication.value) return
    isStatusModalOpen.value = true
}

async function handleUpdateStatusOption(status: PublicationStatus) {
    if (!currentPublication.value) return
    if (currentPublication.value.status === status) {
        isStatusModalOpen.value = false
        return
    }
    newStatus.value = status
    isUpdatingStatus.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            status: status
        })
        toast.add({ title: t('common.success'), color: 'success' })
        isStatusModalOpen.value = false
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
            {{ t('publication.changeScheduleInfo', 'This will update the scheduled time for the publication. Posts without their own scheduled time will inherit this value.') }}
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

    <!-- Status Change Modal -->
    <UModal v-model:open="isStatusModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3 text-gray-900 dark:text-white">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-primary-500"></UIcon>
              <h3 class="text-lg font-medium">
                {{ t('publication.changeStatus') }}
              </h3>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="isStatusModalOpen = false"
            />
          </div>

          <div class="space-y-2">
            <UButton
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :variant="currentPublication?.status === option.value ? 'soft' : 'ghost'"
              :color="currentPublication?.status === option.value ? 'primary' : 'neutral'"
              class="w-full justify-start"
              :loading="isUpdatingStatus && newStatus === option.value"
              @click="handleUpdateStatusOption(option.value as PublicationStatus)"
            />
          </div>
        </div>
      </template>
    </UModal>

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
            :title="t('publication.archived_notice', 'Publication is archived')"
            :description="t('publication.archived_info_banner', 'Archived publications are hidden from the main list.')"
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
                        <UButton
                            :label="t('publication.changeSchedule')"
                            icon="i-heroicons-clock"
                            variant="soft"
                            size="sm"
                            color="primary"
                            :disabled="allPostsPublished"
                            @click="openScheduleModal"
                        ></UButton>

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
                        
                        <div v-if="currentPublication.scheduledAt" class="mt-2 border-t border-gray-100 dark:border-gray-700/50 pt-2">
                             <div class="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                                {{ t('post.scheduledAt') }}
                             </div>
                             <div class="flex items-center gap-2">
                                 <span class="text-gray-900 dark:text-white font-medium">
                                      {{ formatDate(currentPublication.scheduledAt) }}
                                 </span>
                             </div>
                        </div>
                    </div>

                    <!-- Zone 2: Status, Language and Type Column -->
                    <div class="space-y-4">
                        <!-- Status -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('post.status') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base">
                                    {{ statusOptions.find(s => s.value === currentPublication?.status)?.label || currentPublication?.status }}
                                </span>
                                <UButton
                                    icon="i-heroicons-pencil-square"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    @click="openStatusModal"
                                />
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
                             <h3 v-if="currentPublication.title" class="font-semibold text-gray-900 dark:text-white">
                                {{ currentPublication.title }}
                             </h3>
                             <span v-else class="font-medium text-gray-500 italic">
                                {{ t('post.untitled') }}
                             </span>
                        </div>
                        
                        <!-- Content Preview -->
                        <p v-if="currentPublication.content" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {{ currentPublication.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }}
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
                                    :to="`/projects/${projectId}/publications/${trans.id}`"
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
