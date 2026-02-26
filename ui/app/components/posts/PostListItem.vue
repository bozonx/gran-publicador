<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getMediaLinksThumbDataLoose } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  post: PostWithRelations
  activeChannelId?: string
}>()

const emit = defineEmits<{
  (e: 'click', post: PostWithRelations): void
  (e: 'delete', post: PostWithRelations): void
}>()

const { t } = useI18n()
const { formatDateShort, truncateContent } = useFormatters()
const { getStatusColor, getStatusDisplayName, getStatusIcon } = usePosts()
const { getPostProblemLevel } = usePublications()
const authStore = useAuthStore()

const publication = computed(() => props.post.publication)

const thumbData = computed(() => {
  if (!publication.value?.mediaFiles) return { first: null, totalCount: 0 }
  
  try {
    const media = JSON.parse(publication.value.mediaFiles)
    if (!Array.isArray(media)) return { first: null, totalCount: 0 }
    return getMediaLinksThumbDataLoose(media as any)
  } catch (e) {
    return { first: null, totalCount: 0 }
  }
})

const displayTitle = computed(() => {
  if (publication.value?.title) {
    return stripHtmlAndSpecialChars(publication.value.title)
  }
  if (publication.value?.content) {
    const cleaned = stripHtmlAndSpecialChars(publication.value.content)
    if (cleaned) return cleaned
  }
  return t('post.untitled')
})

function handleClick() {
  emit('click', props.post)
}

function handleDelete(e: Event) {
  e.stopPropagation()
  emit('delete', props.post)
}

const problemLevel = computed(() => getPostProblemLevel(props.post))

</script>

<template>
  <div
    class="app-card app-card-hover cursor-pointer group"
    @click="handleClick"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-start gap-4">
        <div class="flex-1 min-w-0">
          <!-- Title and Actions -->
          <div class="flex items-start justify-between gap-4 mb-2">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate text-lg leading-snug" :class="{ 'italic text-gray-500 font-medium': !publication?.title && !publication?.content }">
                {{ displayTitle }}
              </h3>
              
              <UBadge :color="getStatusColor(post.status) as any" size="xs" variant="subtle" class="capitalize gap-1">
                <UIcon :name="getStatusIcon(post.status)" class="w-3.5 h-3.5" :class="{ 'animate-spin': post.status === 'PROCESSING' }" />
                {{ getStatusDisplayName(post.status) }}
              </UBadge>
              
              <UTooltip v-if="problemLevel" :text="t(`problems.post.${post.status === 'FAILED' ? 'failed' : 'issue'}`)">
                <UIcon 
                  :name="problemLevel === 'critical' ? 'i-heroicons-x-circle' : 'i-heroicons-exclamation-triangle'" 
                  :class="problemLevel === 'critical' ? 'text-red-500' : 'text-orange-500'"
                  class="w-4 h-4"
                />
              </UTooltip>
            </div>
            
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
              <UButton
                v-if="publication"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-pencil-square"
                size="xs"
                :to="`/publications/${publication.id}/edit`"
                @click.stop
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-trash"
                size="xs"
                @click="handleDelete"
              />
            </div>
          </div>

          <!-- Media preview -->
          <div v-if="thumbData.totalCount > 0" class="mb-3 flex justify-center">
            <CommonThumb
              v-if="thumbData.first"
              :src="thumbData.first.src"
              :srcset="thumbData.first.srcset"
              :alt="thumbData.first.placeholderText"
              size="sm"
              :clickable="false"
              :is-video="thumbData.first.isVideo"
              :placeholder-icon="thumbData.first.placeholderIcon"
              :placeholder-text="''"
              :show-stack="thumbData.totalCount > 1"
              :total-count="thumbData.totalCount"
            />
          </div>

          <!-- Content Snippet -->
          <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 grow leading-relaxed">
            {{ truncateContent(publication?.content || '') }}
          </p>

          <!-- Footer Info -->
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-gray-500 dark:text-gray-400">
            <!-- Date -->
            <div class="flex items-center gap-1.5 shrink-0">
              <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
              <span>{{ formatDateShort(post.publishedAt || post.scheduledAt || post.createdAt) }}</span>
            </div>

            <!-- Tags -->
            <div v-if="post.tags && post.tags.length > 0" class="flex items-center gap-1.5 min-w-0">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 shrink-0" />
              <span class="truncate text-gray-400 italic">{{ post.tags.join(', ') }}</span>
            </div>
            
            <!-- Type badge -->
            <div v-if="publication?.postType" class="flex items-center gap-1.5 ml-auto">
               <UBadge size="xs" color="neutral" variant="soft">{{ publication.postType }}</UBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
