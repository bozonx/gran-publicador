<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { ChannelWithProject } from '~/composables/useChannels'
import type { SocialMedia } from '~/types/socialMedia'
import { getSocialMediaIcon, getSocialMediaColor, getSocialMediaDisplayName } from '~/utils/socialMedia'
import { usePosts } from '~/composables/usePosts'

interface Props {
  publication: PublicationWithRelations
  channels: ChannelWithProject[]
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['refresh'])

const { t } = useI18n()
const { createPost } = usePosts()
const toast = useToast()

const isCreating = ref<string | null>(null)

// Get unique social media platforms with posts
const socialMediaWithPosts = computed(() => {
  if (!props.publication.posts || props.publication.posts.length === 0) return []
  
  const platforms = new Map<SocialMedia, { channelId: string; channelName: string }>()
  
  props.publication.posts.forEach((post: any) => {
    if (post.channel?.socialMedia) {
      const sm = post.channel.socialMedia as SocialMedia
      if (!platforms.has(sm)) {
        platforms.set(sm, {
          channelId: post.channelId,
          channelName: post.channel.name
        })
      }
    }
  })
  
  return Array.from(platforms.entries()).map(([socialMedia, info]) => ({
    socialMedia,
    ...info
  }))
})

// Get unique social media platforms without posts
const socialMediaWithoutPosts = computed(() => {
  if (!props.channels || props.channels.length === 0) return []
  
  // Get channel IDs that already have posts
  const usedChannelIds = new Set(
    props.publication.posts?.map((p: any) => p.channelId) || []
  )
  
  // Get available channels (not used, same language as publication)
  const availableChannels = props.channels.filter(
    ch => !usedChannelIds.has(ch.id) && ch.language === props.publication.language
  )
  
  // Group by social media
  const platforms = new Map<SocialMedia, { channelId: string; channelName: string }>()
  
  availableChannels.forEach(channel => {
    const sm = channel.socialMedia as SocialMedia
    if (!platforms.has(sm)) {
      platforms.set(sm, {
        channelId: channel.id,
        channelName: channel.name
      })
    }
  })
  
  return Array.from(platforms.entries()).map(([socialMedia, info]) => ({
    socialMedia,
    ...info
  }))
})

/**
 * Scroll to post block for the given channel
 */
function scrollToPost(channelId: string) {
  const element = document.getElementById(`post-${channelId}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Add highlight effect
    element.classList.add('highlight-flash')
    setTimeout(() => {
      element.classList.remove('highlight-flash')
    }, 2000)
  }
}

/**
 * Create a new post for the given channel
 */
async function createPostForChannel(channelId: string, channelName: string) {
  if (isCreating.value) return
  
  isCreating.value = channelId
  
  try {
    const result = await createPost({
      publicationId: props.publication.id,
      channelId: channelId,
      status: 'PENDING'
    }, { silent: true })
    
    if (result) {
      // Refresh publication to show new post
      emit('refresh')
    }
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('post.createError'),
      color: 'error'
    })
  } finally {
    isCreating.value = null
  }
}
</script>

<template>
  <div 
    v-if="socialMediaWithPosts.length > 0 || socialMediaWithoutPosts.length > 0"
    class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm"
  >
    <div class="p-6">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-link" class="w-5 h-5 text-gray-500" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('publication.channels') }}
        </h3>
      </div>

      <!-- Channels with posts -->
      <div v-if="socialMediaWithPosts.length > 0" class="mb-4">
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ t('publication.channelsWithPosts') }}
        </div>
        <div class="flex flex-wrap gap-2">
          <UTooltip 
            v-for="item in socialMediaWithPosts" 
            :key="item.socialMedia"
            :text="t('publication.clickToScroll', { channel: item.channelName })"
          >
            <button
              class="group relative flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-lg"
              :class="[
                getSocialMediaColor(item.socialMedia),
                'hover:brightness-110'
              ]"
              @click="scrollToPost(item.channelId)"
            >
              <UIcon 
                :name="getSocialMediaIcon(item.socialMedia)" 
                class="w-6 h-6 text-white"
              />
            </button>
          </UTooltip>
        </div>
      </div>

      <!-- Channels without posts -->
      <div v-if="socialMediaWithoutPosts.length > 0">
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ t('publication.channelsWithoutPosts') }}
        </div>
        <div class="flex flex-wrap gap-2">
          <UTooltip 
            v-for="item in socialMediaWithoutPosts" 
            :key="item.socialMedia"
            :text="t('publication.clickToCreate', { channel: item.channelName })"
          >
            <button
              class="group relative flex items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              :class="[
                isCreating === item.channelId 
                  ? 'border-gray-400 bg-gray-100 dark:bg-gray-700' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              ]"
              :disabled="!!isCreating || disabled"
              @click="createPostForChannel(item.channelId, item.channelName)"
            >
              <UIcon 
                v-if="isCreating === item.channelId"
                name="i-heroicons-arrow-path" 
                class="w-6 h-6 text-gray-500 animate-spin"
              />
              <UIcon 
                v-else
                :name="getSocialMediaIcon(item.socialMedia)" 
                class="w-6 h-6 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
              />
              <div 
                class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-plus" class="w-3 h-3 text-white" />
              </div>
            </button>
          </UTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes highlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
  }
}

:deep(.highlight-flash) {
  animation: highlight 1s ease-in-out 2;
}
</style>
