<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'
import type { PostWithRelations, PostStatus } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { PublicationStatus } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'
import { useViewMode } from '~/composables/useViewMode'
import PublicationListItem from '~/components/publications/PublicationListItem.vue'
import PublicationCard from '~/components/publications/PublicationCard.vue'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { canGoBack, goBack: navigateBack } = useNavigation()

const projectId = computed(() => route.params.id as string)
const channelId = computed(() => route.params.channelId as string)

const {
  fetchChannel,
  currentChannel: channel,
  isLoading: isChannelLoading,
  getSocialMediaIcon,
  getSocialMediaColor,
  getSocialMediaDisplayName,
  toggleChannelActive,
  unarchiveChannel,
} = useChannels()

const {
  posts: postsBatch,
  isLoading: isPostsLoading,
  fetchPostsByProject,
  deletePost,
  setFilter,
} = usePosts()

// Separate composable instance for failed posts
const {
  posts: failedPosts,
  isLoading: isFailedPostsLoading,
  fetchPostsByProject: fetchFailedPostsByProject,
  setFilter: setFailedFilter,
} = usePosts()

// Import utility function for getting post title
const { getPostTitle } = await import('~/composables/usePosts')

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

// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('channel-publications-view', 'list')

function handlePublicationCreated(publicationId: string) {
  // Refresh posts list
  resetAndFetchPosts()
}

// Local posts state for pagination
const posts = ref<PostWithRelations[]>([])
const page = ref(1)
const hasMore = ref(true)
const LIMIT = 12

async function resetAndFetchPosts() {
  page.value = 1
  hasMore.value = true
  setFilter({ 
      channelId: channelId.value, 
      status: 'PUBLISHED' as PostStatus,
      limit: LIMIT,
      page: 1
  })
  const newPosts = await fetchPostsByProject(projectId.value)
  posts.value = newPosts
  if (newPosts.length < LIMIT) hasMore.value = false
}

async function loadMore() {
  if (!hasMore.value || isPostsLoading.value) return
  
  page.value++
  setFilter({ page: page.value })
  
  const newPosts = await fetchPostsByProject(projectId.value)
  if (newPosts.length < LIMIT) hasMore.value = false
  posts.value.push(...newPosts)
}

// Initialization
onMounted(async () => {
    if (channelId.value) {
        await fetchChannel(channelId.value)
        // Fetch only published posts, latest first, limited to 12
        await resetAndFetchPosts()
        
        // Fetch failed posts (up to 5) for banner
        setFailedFilter({ 
            channelId: channelId.value, 
            status: 'FAILED' as PostStatus,
            limit: 5
        })
        await fetchFailedPostsByProject(projectId.value)
    }
})

function goToPost(postId: string) {
  // Find the post to get its publicationId
  const post = posts.value.find(p => p.id === postId)
  if (post?.publicationId) {
    router.push(`/projects/${projectId.value}/publications/${post.publicationId}`)
  }
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
function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function formatDateTime(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

function truncateContent(content: string | null | undefined, maxLength = 150): string {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

function mapPostToPublication(post: PostWithRelations): PublicationWithRelations {
  const basePublication = post.publication || {
     id: post.publicationId,
     projectId: post.channel?.projectId || '',
     title: t('post.untitled'),
     content: '',
     status: 'DRAFT',
     language: 'ru-RU',
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
     translationGroupId: null
  }

  // Create a minimal creator object if ID exists, to avoid errors if component checks it
  const creator = basePublication.createdBy ? { id: basePublication.createdBy } as any : undefined

  return {
      ...basePublication,
      // Visualize the Post's status as the Publication's status in this view
      status: (post.status as unknown) as PublicationStatus, 
      createdAt: post.createdAt,
      posts: [post],
      _count: { posts: 1 },
      creator
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

</script>

<template>
    <div>
        <!-- Back Button -->
        <div class="mb-6">
            <UButton 
              variant="ghost" 
              color="neutral" 
              icon="i-heroicons-arrow-left" 
              :disabled="!canGoBack"
              @click="goBack"
            >
                {{ t('common.back') }}
            </UButton>
        </div>

        <!-- Loading State -->
        <div v-if="isChannelLoading && !channel" class="flex items-center justify-center py-12">
            <div class="text-center">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
            </div>
        </div>

        <!-- Channel Not Found -->
        <div v-else-if="!channel" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
             <UIcon name="i-heroicons-signal-slash" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
             <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {{ t('channel.notFound', 'Channel not found') }}
             </h3>
             <UButton @click="goBack">{{ t('common.back') }}</UButton>
        </div>

        <!-- Channel Content -->
        <div v-else class="space-y-6">
            <!-- Channel Header -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <!-- Color bar -->
                <div class="h-2" :style="{ backgroundColor: getSocialMediaColor(channel.socialMedia) }" />
                
                <div class="p-6">
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



                                <span 
                                    v-if="!hasCredentials" 
                                    class="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-medium"
                                    :title="t('channel.noCredentials')"
                                >
                                    <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                                    {{ t('channel.noCredentials') }}
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
                                :to="`/projects/${projectId}/channels/${channelId}/settings`"
                            />
                        </div>
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

            <!-- Deactivated Status Banner -->
            <div 
                v-if="!channel.isActive" 
                class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
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
                            <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                {{ t('channel.deactivate_warning', 'Deactivating the channel will stop all scheduled posts.') }}
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

            <!-- Failed Posts Banner -->
            <div 
                v-if="channel.failedPostsCount && channel.failedPostsCount > 0"
                class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
                <div class="flex items-start gap-3">
                    <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-full shrink-0">
                        <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                            {{ t('channel.failedPostsWarning') }}
                        </p>
                        
                        <!-- List of failed posts -->
                        <ul class="text-sm text-red-800 dark:text-red-200 space-y-1 mb-3">
                            <li 
                                v-for="post in failedPosts" 
                                :key="post.id"
                                class="flex items-start gap-2"
                            >
                                <span class="mt-1.5 w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full shrink-0" />
                                <NuxtLink
                                    :to="`/projects/${projectId}/publications/${post.publicationId}`"
                                    class="hover:underline flex-1"
                                >
                                    {{ getPostTitle(post) || t('post.untitled') }}
                                    <span class="text-xs text-red-600 dark:text-red-400 ml-1">
                                        ({{ formatDateTime(post.updatedAt) }})
                                    </span>
                                </NuxtLink>
                            </li>
                        </ul>
                        
                        <!-- View all link if more than 5 failed posts -->
                        <NuxtLink
                            v-if="channel.failedPostsCount > 5"
                            :to="`/publications?channelId=${channelId}&status=FAILED`"
                            class="text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 hover:underline inline-flex items-center gap-1"
                        >
                            {{ t('channel.viewAllFailedPosts', { count: channel.failedPostsCount }) }}
                            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
                        </NuxtLink>
                    </div>
                </div>
            </div>

            <!-- Stale Channel Warning Banner -->
            <div 
                v-if="channel.isStale"
                class="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
            >
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full shrink-0">
                        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-orange-900 dark:text-orange-100">
                             {{ t('settings.staleChannelsWarning') }}
                        </p>
                        <p class="text-sm text-orange-800 dark:text-orange-200 mt-1">
                             {{ t('channel.staleWarning', { days: daysSinceActivity }) }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Posts Panel -->
             <div>
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {{ t('publication.titlePlural', 'Publications') }}
                        <CommonCountBadge :count="channel.postsCount" :title="t('channel.postsCount')" />
                    </h2>
                     <div class="flex items-center gap-2">
                        <CommonViewToggle v-model="viewMode" />
                        
                        <UButton 
                            variant="ghost" 
                            color="neutral"
                            icon="i-heroicons-eye"
                            :to="`/publications?channelId=${channelId}`"
                        >
                            {{ t('common.viewAll') }}
                        </UButton>
                        <UButton icon="i-heroicons-plus" color="primary" @click="openCreatePublicationModal">
                            {{ t('post.createPost') }}
                        </UButton>
                    </div>
                </div>

                <!-- Posts List -->
                <div v-if="isPostsLoading && page === 1" class="flex items-center justify-center py-12">
                     <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
                </div>

                <div v-else-if="posts.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                    <UIcon name="i-heroicons-document-text" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                    <p class="text-gray-500 dark:text-gray-400">
                        {{ t('channel.noPostsDescription') }}
                    </p>
                </div>

                <!-- Posts List View -->
                <div v-if="isListView" class="space-y-4">
                    <PublicationListItem
                        v-for="post in posts"
                        :key="post.id"
                        :publication="mapPostToPublication(post)"
                        @click="goToPost(post.id)"
                    />
                </div>

                <!-- Posts Cards View -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <PublicationCard
                        v-for="post in posts"
                        :key="post.id"
                        :publication="mapPostToPublication(post)"
                        @click="goToPost(post.id)"
                    />
                </div>

                <!-- Load More Button -->
                <div v-if="hasMore" class="mt-8 flex justify-center">
                    <UButton 
                        :loading="isPostsLoading"
                        @click="loadMore"
                        color="primary"
                        variant="soft"
                    >
                        {{ t('common.loadMore', 'Load More') }}
                    </UButton>
                </div>
             </div>
        </div>


        <!-- Create Publication Modal -->
        <ModalsCreatePublicationModal
          v-model:open="showCreatePublicationModal"
          :project-id="projectId"
          :preselected-channel-id="channelId"
          :preselected-language="channel?.language"
          @success="handlePublicationCreated"
        />

        <!-- Delete Post Modal -->
         <UModal v-model:open="showDeletePostModal">
            <template #content>
                <div class="p-6">
                <div class="flex items-center gap-4 mb-4">
                    <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <UIcon
                        name="i-heroicons-exclamation-triangle"
                        class="w-6 h-6 text-red-600 dark:text-red-400"
                    />
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ t('post.deletePost') }}
                    </h3>
                </div>

                <p class="text-gray-600 dark:text-gray-400 mb-6">
                    {{ t('post.deleteConfirm') }}
                </p>

                <div class="flex justify-end gap-3">
                    <UButton
                    color="neutral"
                    variant="ghost"
                    :disabled="isDeletingPost"
                    @click="showDeletePostModal = false"
                    >
                    {{ t('common.cancel') }}
                    </UButton>
                    <UButton color="error" :loading="isDeletingPost" @click="handleDeletePost">
                    {{ t('common.delete') }}
                    </UButton>
                </div>
                </div>
            </template>
        </UModal>
    </div>
</template>
