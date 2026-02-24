<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'
import type { PostWithRelations } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import type { PostStatus, PostType, PublicationStatus } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'
import { useViewMode } from '~/composables/useViewMode'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getPostTypeOptionsForPlatforms } from '~/utils/socialMediaPlatforms'

definePageMeta({
  middleware: 'auth',
})

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const { canGoBack, goBack: navigateBack } = useNavigation()

const { user } = useAuth()

const projectId = computed(() => channel.value?.projectId || '')
const channelId = computed(() => route.params.id as string)

const quickCreateTypeOptions = computed(() => {
  const platform = channel.value?.socialMedia
  return getPostTypeOptionsForPlatforms({
    t,
    platforms: [platform as any],
  })
})

const {
  fetchChannel,
  currentChannel: channel,
  isLoading: isChannelLoading,
  getSocialMediaIcon,
  getSocialMediaColor,
  getSocialMediaDisplayName,
  toggleChannelActive,
  unarchiveChannel,
  // Problem detection
  getChannelProblems,
  getChannelProblemLevel,
  fetchChannels
} = useChannels()

const {
  posts: postsBatch,
  totalCount: totalPostsCount,
  isLoading: isPostsLoading,
  fetchPostsByProject,
  deletePost,
  setFilter,
  typeOptions
} = usePosts()

// Separate composable instance for failed posts (Problematic)
const {
  posts: problemPosts,
  totalCount: problemPostsTotal,
  isLoading: isProblemsLoading,
  fetchPostsByProject: fetchProblemPosts,
  setFilter: setProblemFilter,
} = usePosts()

// Separate composable instance for scheduled posts (Pending)
const {
  posts: scheduledPosts,
  totalCount: scheduledPostsTotal,
  isLoading: isScheduledLoading,
  fetchPostsByProject: fetchScheduledPosts,
  setFilter: setScheduledFilter,
} = usePosts()

const scheduledPage = ref(1)
const problemsPage = ref(1)

const hasMoreScheduled = computed(() => scheduledPosts.value.length < scheduledPostsTotal.value)
const hasMoreProblems = computed(() => problemPosts.value.length < problemPostsTotal.value)

async function loadMoreScheduled() {
  if (isScheduledLoading.value || !hasMoreScheduled.value) return
  scheduledPage.value++
  setScheduledFilter({ page: scheduledPage.value })
  await fetchScheduledPosts(projectId.value, { append: true })
}

async function loadMoreProblems() {
  if (isProblemsLoading.value || !hasMoreProblems.value) return
  problemsPage.value++
  setProblemFilter({ page: problemsPage.value })
  await fetchProblemPosts(projectId.value, { append: true })
}

const {
  publications: draftPublications,
  fetchPublicationsByProject: fetchDrafts,
  totalCount: draftsCount,
  isLoading: draftsLoading,
  deletePublication,
  createPublication
} = usePublications()

const {
  publications: readyPublications,
  fetchPublicationsByProject: fetchReady,
  totalCount: readyCount,
  isLoading: isReadyLoading,
} = usePublications()

const {
    templates: projectTemplates,
    fetchProjectTemplates
} = useProjectTemplates()

// Import utility function for getting post title
const { getPostTitle, getPostScheduledAt } = await import('~/composables/usePosts')

const { archiveEntity } = useArchive()

// UI States
const showDeletePostModal = ref(false)
const postToDelete = ref<PostWithRelations | null>(null)
const isDeletingPost = ref(false)
const isTogglingActive = ref(false)

// Create publication modal state
const showCreatePublicationModal = ref(false)

function openCreatePublicationModal() {
  showCreatePublicationModal.value = true
}

const isCreatingPublication = computed(() => !!creatingType.value)
const creatingType = ref<PostType | null>(null)

function quickCreatePublication(postType: PostType) {
  creatingType.value = postType
  showCreatePublicationModal.value = true
}

watch(showCreatePublicationModal, (val) => {
  if (!val) creatingType.value = null
})


// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('channel-publications-view', 'list')

function handlePublicationCreated(publicationId: string) {
  // Refresh posts list
  resetAndFetchPosts()
}

const LIMIT = 12

async function resetAndFetchPosts() {
  setFilter({ 
      channelId: channelId.value, 
      status: 'PUBLISHED' as PostStatus,
      limit: LIMIT,
      offset: 0
  })
  await fetchPostsByProject(projectId.value, { append: false })
}

const hasMoreData = computed(() => {
  return postsBatch.value.length < totalPostsCount.value
})

async function loadMore() {
  if (isPostsLoading.value || !hasMoreData.value) return
  
  setFilter({ offset: postsBatch.value.length })
  
  await fetchPostsByProject(projectId.value, { append: true })
}

// Initialization
onMounted(async () => {
    if (channelId.value) {
        await fetchChannel(channelId.value)
        // Fetch only published posts, latest first, limited to 12
        await resetAndFetchPosts()
        
        // Fetch failed posts (Problematic)
        problemsPage.value = 1
        setProblemFilter({
            channelId: channelId.value,
            status: 'FAILED' as PostStatus,
            limit: 5,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        })
        await fetchProblemPosts(projectId.value)

        // Fetch scheduled posts (Pending) - only those from ready/scheduled/processing publications
        scheduledPage.value = 1
        setScheduledFilter({
            channelId: channelId.value,
            status: 'PENDING' as PostStatus,
            publicationStatus: ['READY' as PublicationStatus, 'SCHEDULED' as PublicationStatus, 'PROCESSING' as PublicationStatus],
            limit: 5,
            offset: 0,
            sortBy: 'scheduledAt',
            sortOrder: 'asc'
        })
        await fetchScheduledPosts(projectId.value)

        // Fetch drafts
        await fetchDrafts(projectId.value, { 
            channelId: channelId.value, 
            status: 'DRAFT', 
            limit: 5 
        })
        await fetchReady(projectId.value, { 
            channelId: channelId.value, 
            status: 'READY', 
            limit: 5 
        })

        // Fetch project templates
        await fetchProjectTemplates(projectId.value)
    }
})

const activeDraftsCollection = ref('DRAFT')
const currentDraftsPublications = computed(() => activeDraftsCollection.value === 'DRAFT' ? draftPublications.value : readyPublications.value)
const currentDraftsTotal = computed(() => activeDraftsCollection.value === 'DRAFT' ? draftsCount.value : readyCount.value)
const currentDraftsLoading = computed(() => activeDraftsCollection.value === 'DRAFT' ? draftsLoading.value : isReadyLoading.value)
const currentDraftsViewAllLink = computed(() => `/publications?channelId=${channelId.value}&status=${activeDraftsCollection.value}`)

function goToPost(postId: string) {
  // Find the post to get its publicationId
  const post = postsBatch.value.find(p => p.id === postId)
  if (post?.publicationId) {
    router.push(`/publications/${post.publicationId}`)
  }
}

function goToPublication(pub: PublicationWithRelations) {
    router.push(`/publications/${pub.id}`)
}

function goBack() {
  navigateBack()
}

/**
 * Handle Post Deletion
 */
function confirmDeletePost(post: PostWithRelations) {
  postToDelete.value = post
  showDeletePostModal.value = true
}

async function handleDeletePost() {
  if (!postToDelete.value) return

  isDeletingPost.value = true
  const success = await deletePost(postToDelete.value.id)
  isDeletingPost.value = false

  if (success) {
    showDeletePostModal.value = false
    postToDelete.value = null
    resetAndFetchPosts()
  }
}

function handleDeletePostFromPublication(pub: PublicationWithRelations) {
  if (pub.posts && pub.posts.length > 0) {
    confirmDeletePost(pub.posts[0])
  }
}

// Handle Publication Deletion (Drafts)
const showDeletePublicationModal = ref(false)
const publicationToDelete = ref<PublicationWithRelations | null>(null)
const isDeletingPublication = ref(false)

function confirmDeletePublication(pub: PublicationWithRelations) {
  publicationToDelete.value = pub
  showDeletePublicationModal.value = true
}

async function handleDeletePublication() {
  if (!publicationToDelete.value) return
  
  isDeletingPublication.value = true
  const success = await deletePublication(publicationToDelete.value.id)
  isDeletingPublication.value = false
  
  if (success) {
    showDeletePublicationModal.value = false
    publicationToDelete.value = null
    if (activeDraftsCollection.value === 'DRAFT') {
        fetchDrafts(projectId.value, { 
            channelId: channelId.value, 
            status: 'DRAFT', 
            limit: 5 
        })
    } else {
        fetchReady(projectId.value, { 
            channelId: channelId.value, 
            status: 'READY', 
            limit: 5 
        })
    }
  }
}


/**
 * Handle channel activation/deactivation from banner
 */
async function handleToggleActive() {
    if (!channel.value) return
    isTogglingActive.value = true
    try {
        await toggleChannelActive(channel.value.id)
    } finally {
        isTogglingActive.value = false
    }
}



// Formatters
const { getPublicationDisplayTitle, formatDateWithTime } = useFormatters()

function truncateContent(content: string | null | undefined, maxLength = 150): string {
  if (!content) return ''
  const text = stripHtmlAndSpecialChars(content)
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

function getDisplayPostTitle(post: PostWithRelations): string {
  return getPublicationDisplayTitle(mapPostToPublication(post))
}

function mapPostToPublication(post: PostWithRelations): PublicationWithRelations {
  const basePublication = post.publication || {
     id: post.publicationId,
     projectId: post.channel?.projectId || '',
     title: t('post.untitled'),
     content: '',
     status: 'DRAFT',
     language: user.value?.language || channel.value?.language || 'en-US',
     postType: 'POST',
     mediaFiles: '[]',
     meta: '{}',
     createdAt: post.createdAt, 
     updatedAt: post.updatedAt,
     createdBy: null,
     archivedAt: null,
     archivedBy: null,
     tags: post.tags,
     description: null,
     authorComment: null,
     postDate: null,
     note: null
  }

  // Create a minimal creator object if ID exists, to avoid errors if component checks it
  const creator = basePublication.createdBy ? { id: basePublication.createdBy } as any : undefined

  return {
      ...basePublication,
      // Visualize the Post's status as the Publication's status in this view
      status: (post.status as unknown) as PublicationStatus, 
      createdAt: post.createdAt,
      postScheduledAt: post.scheduledAt,
      posts: [post],
      _count: { posts: 1 },
      creator,
      note: (basePublication as any).note || null
  } as PublicationWithRelations
}


const hasCredentials = computed(() => {
    if (!channel.value?.credentials) return false
    return Object.keys(channel.value.credentials).length > 0
})

const daysSinceActivity = computed(() => {
    if (!channel.value) return 0
    const lastDate = channel.value.lastPostAt || channel.value.createdAt
    if (!lastDate) return 0
    const diffTime = Math.abs(new Date().getTime() - new Date(lastDate).getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
})

// Channel problems detection
const channelProblems = computed(() => {
  if (!channel.value) return []
  return getChannelProblems(channel.value)
})

</script>

<template>
    <div>
        <!-- Loading State -->
        <div v-if="isChannelLoading && !channel" class="flex items-center justify-center py-12">
            <div class="text-center">
                <UiLoadingSpinner size="md" :label="t('common.loading')" centered />
            </div>
        </div>

        <!-- Channel Not Found -->
        <div v-else-if="!channel" class="app-card p-12 text-center">
             <UIcon name="i-heroicons-signal-slash" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
             <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {{ t('channel.notFound', 'Channel not found') }}
             </h3>
             <UButton to="/">{{ t('common.toHome') }}</UButton>
        </div>

        <!-- Channel Content -->
        <div v-else class="page-spacing">
            <!-- Channel Header -->
            <div class="app-card p-0! overflow-hidden">
                <!-- Color bar -->
                <div class="h-2" :style="{ backgroundColor: getSocialMediaColor(channel.socialMedia) }" />
                
                <div class="p-4 sm:p-6">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-3 mb-2">
                                <div 
                                    class="p-2 rounded-lg mt-1"
                                    :style="{ backgroundColor: getSocialMediaColor(channel.socialMedia) + '20' }"
                                >
                                    <UIcon 
                                        :name="getSocialMediaIcon(channel.socialMedia)" 
                                        class="w-6 h-6"
                                        :style="{ color: getSocialMediaColor(channel.socialMedia) }"
                                    />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-3">
                                        <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
                                            {{ channel.name }}
                                        </h1>
                                        <div class="flex items-center gap-1 text-gray-500 dark:text-gray-400" :title="t('channel.language')">
                                            <UIcon name="i-heroicons-language" class="w-5 h-5" />
                                            <span class="text-sm font-medium">{{ channel.language }}</span>
                                        </div>
                                    </div>
                                    <NuxtLink 
                                        v-if="channel.project"
                                        :to="`/projects/${channel.project.id}`"
                                        class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors mt-0.5"
                                    >
                                        <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5" />
                                        {{ channel.project.name }}
                                    </NuxtLink>
                                </div>
                            </div>

                            <div
                                class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                <span class="flex items-center gap-1">
                                    <UIcon name="i-heroicons-signal" class="w-4 h-4" />
                                    {{ getSocialMediaDisplayName(channel.socialMedia) }}
                                </span>
                                <span class="flex items-center gap-1 font-mono">
                                    <UIcon name="i-heroicons-hashtag" class="w-4 h-4" />
                                    {{ channel.channelIdentifier }}
                                </span>




                            </div>

                            <p 
                                v-if="channel.description" 
                                class="mt-4 text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed"
                            >
                                {{ channel.description }}
                            </p>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 ml-4">
                            <UButton
                                color="neutral"
                                variant="ghost"
                                icon="i-heroicons-cog-6-tooth"
                                :to="`/channels/${channelId}/settings`"
                            />
                        </div>
                    </div>
                </div>

                <!-- Actions Footer -->
                <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div class="flex flex-wrap items-center gap-2">
                        <PublicationsPublicationTypeSelect
                            :loading-type="creatingType"
                            :disabled="isCreatingPublication"
                            :items="quickCreateTypeOptions"
                            @select="quickCreatePublication"
                        />
                    </div>

                    <div class="flex items-center gap-2">
                        <UButton 
                            variant="ghost" 
                            color="neutral" 
                            size="sm"
                            :to="`/publications?channelId=${channelId}`"
                        >
                            {{ t('publication.filter.all') }}
                        </UButton>
                        <UButton 
                            variant="ghost" 
                            color="warning" 
                            size="sm"
                            :to="`/publications?channelId=${channelId}&status=READY`"
                        >
                            {{ t('publication.filter.ready') }}
                        </UButton>
                        <UButton 
                            variant="ghost" 
                            color="success" 
                            size="sm"
                            :to="`/publications?channelId=${channelId}&status=PUBLISHED`"
                        >
                            {{ t('publication.filter.published') }}
                        </UButton>
                    </div>
                </div>
            </div>

            <!-- Project Archived Status Banner -->
            <CommonArchivedBanner
                v-if="channel.project?.archivedAt"
                :title="t('project.archived_notice', 'Project is archived')"
                :description="t('channel.project_archived_notice', 'This channel belongs to an archived project.')"
            />

            <!-- Archived Status Banner -->
            <CommonArchivedBanner
                v-if="channel.archivedAt"
                :title="t('channel.archived_notice', 'Channel is archived')"
                :description="t('channel.archived_info_banner', 'Archived channels are hidden from the project but their history is preserved.')"
                :entity-type="ArchiveEntityType.CHANNEL"
                :entity-id="channel.id"
                @restore="() => fetchChannel(channelId)"
            />

            <!-- Problems Banner -->
            <CommonProblemBanner
              v-if="channelProblems.length > 0"
              :problems="channelProblems"
              entity-type="channel"
              class="mb-6"
            />

            <!-- Deactivated Manual Action Banner (keeping because it has a button) -->
            <div 
                v-if="!channel.isActive" 
                class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6"
            >
                <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            <UIcon name="i-heroicons-pause-circle" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                {{ t('channel.deactivated_notice', 'Channel is deactivated') }}
                            </p>
                        </div>
                    </div>
                    <UButton 
                        size="sm" 
                        color="warning" 
                        variant="solid" 
                        :loading="isTogglingActive"
                        @click="handleToggleActive"
                    >
                        {{ t('channel.activate') }}
                    </UButton>
                </div>
            </div>

            <PublicationsDraftsSection
                v-model:active-collection="activeDraftsCollection"
                :publications="currentDraftsPublications"
                :total-count="currentDraftsTotal"
                :loading="currentDraftsLoading"
                :view-all-to="currentDraftsViewAllLink"
                class="mb-8"
                @delete="confirmDeletePublication"
            />

            <!-- Scheduled and Problems Columns -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Scheduled Column -->
                <PublicationsInfiniteBlock
                  :title="t('publicationStatus.scheduled')"
                  icon="i-heroicons-clock"
                  icon-color="text-sky-500"
                  :publications="scheduledPosts.map(mapPostToPublication)"
                  :total-count="scheduledPostsTotal"
                  :loading="isScheduledLoading"
                  :has-more="hasMoreScheduled"
                  :view-all-to="`/publications?channelId=${channelId}&status=READY,SCHEDULED,PROCESSING&sortBy=scheduledAt&sortOrder=asc`"
                  show-date
                  date-type="scheduled"
                  @load-more="loadMoreScheduled"
                />

                <!-- Problem Column -->
                <PublicationsInfiniteBlock
                  :title="t('publication.filter.showIssuesOnly')"
                  icon="i-heroicons-exclamation-triangle"
                  icon-color="text-red-500"
                  :publications="problemPosts.map(mapPostToPublication)"
                  :total-count="problemPostsTotal"
                  :loading="isProblemsLoading"
                  :has-more="hasMoreProblems"
                  :view-all-to="`/publications?channelId=${channelId}&status=FAILED&sortBy=createdAt&sortOrder=desc`"
                  show-status
                  show-date
                  date-type="scheduled"
                  is-problematic
                  @load-more="loadMoreProblems"
                />
            </div>

            <!-- Posts Panel -->
             <div>
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {{ t('post.status.published_posts', 'Published Posts') }}
                         <!-- Assuming channel.postsCount is total posts, we might want manual count of displayed posts or check if we have a specific count. 
                              For now let's use loaded posts length if loading finished, or rely on channel stats if available. 
                              Since we are filtering, channel.postsCount might include others. 
                              Let's just show count of *this* list roughly or omit if unreliable. 
                              Or better, use a computed property if backend sent total count. 
                              usePosts has totalCount ref. -->
                        <CommonCountBadge :count="totalPostsCount" :title="t('post.status.published_posts')" />
                    </h2>
                     <div class="flex items-center gap-2">
                        <CommonViewToggle v-model="viewMode" />
                        
                        <UButton 
                            variant="ghost" 
                            color="neutral"
                            icon="i-heroicons-eye"
                            :to="`/publications?channelId=${channelId}&status=PUBLISHED&sortBy=byPublished`"
                        >
                            {{ t('common.viewAll') }}
                        </UButton>

                    </div>
                </div>

                <!-- Posts List -->
                <!-- Posts Lists -->
                <CommonInfiniteList
                    :is-loading="isPostsLoading"
                    :has-more="hasMoreData"
                    :item-count="postsBatch.length"
                    @load-more="loadMore"
                >
                    <!-- Posts List View -->
                    <div v-if="isListView" class="space-y-4">
                        <PublicationsPublicationListItem
                            v-for="post in postsBatch"
                            :key="post.id"
                            :publication="mapPostToPublication(post)"
                            @click="goToPost(post.id)"
                            @delete="handleDeletePostFromPublication"
                        />
                    </div>

                    <!-- Posts Cards View -->
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <PublicationsPublicationCard
                            v-for="post in postsBatch"
                            :key="post.id"
                            :publication="mapPostToPublication(post)"
                            @click="goToPost(post.id)"
                            @delete="handleDeletePostFromPublication"
                        />
                    </div>
                </CommonInfiniteList>
             </div>
        </div>


        <!-- Create Publication Modal -->
        <ModalsCreatePublicationModal
          v-if="showCreatePublicationModal"
          v-model:open="showCreatePublicationModal"
          :project-id="projectId"
          :preselected-channel-id="channelId"
          :preselected-language="channel?.language"
          :preselected-post-type="creatingType || undefined"
          :is-project-locked="true"
          :is-channel-locked="true"
          :is-language-locked="true"
          :is-post-type-locked="!!creatingType"
          @success="handlePublicationCreated"
        />

        <!-- Delete Post Modal -->
         <UiConfirmModal
           v-if="showDeletePostModal"
           v-model:open="showDeletePostModal"
           :title="t('post.deletePost')"
           :description="t('post.deleteConfirm')"
           :confirm-text="t('common.delete')"
           color="error"
           icon="i-heroicons-exclamation-triangle"
           :loading="isDeletingPost"
           @confirm="handleDeletePost"
         />

        <!-- Delete Publication Modal (Drafts) -->
         <UiConfirmModal
           v-if="showDeletePublicationModal"
           v-model:open="showDeletePublicationModal"
           :title="t('publication.deleteConfirm')"
           :description="t('publication.deleteCascadeWarning')"
           :confirm-text="t('common.delete')"
           color="error"
           icon="i-heroicons-exclamation-triangle"
           :loading="isDeletingPublication"
           @confirm="handleDeletePublication"
         />
    </div>
</template>
