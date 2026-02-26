<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getMediaLinksThumbDataLoose } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  post: PostWithRelations
}>()

const emit = defineEmits<{
  (e: 'click', post: PostWithRelations): void
  (e: 'delete', post: PostWithRelations): void
}>()

const { t } = useI18n()
const { formatDateShort, truncateContent } = useFormatters()
const { getStatusColor, getStatusDisplayName, getStatusIcon } = usePosts()
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
</script>

<template>
  <div
    class="app-card app-card-hover cursor-pointer group flex flex-col h-full"
    @click="handleClick"
  >
    <!-- Media preview -->
    <div class="relative h-48 -mx-4 -mt-4 mb-4 overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-800">
      <CommonThumb
        v-if="thumbData.first"
        :src="thumbData.first.src"
        :srcset="thumbData.first.srcset"
        :alt="thumbData.first.placeholderText"
        size="full"
        class="h-full w-full object-cover"
        :clickable="false"
        :is-video="thumbData.first.isVideo"
        :placeholder-icon="thumbData.first.placeholderIcon"
        :placeholder-text="''"
      />
      <div v-else class="h-full w-full flex items-center justify-center">
        <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 dark:text-gray-700" />
      </div>

      <!-- Action buttons on hover -->
      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <UButton
          v-if="publication"
          color="neutral"
          variant="solid"
          icon="i-heroicons-pencil-square"
          size="xs"
          class="bg-white/90 dark:bg-gray-800/90"
          :to="`/publications/${publication.id}/edit`"
          @click.stop
        />
        <UButton
          color="error"
          variant="solid"
          icon="i-heroicons-trash"
          size="xs"
          class="bg-white/90 dark:bg-gray-800/90"
          @click="handleDelete"
        />
      </div>

      <!-- Status Badge -->
      <div class="absolute bottom-2 left-2">
        <UBadge :color="getStatusColor(post.status) as any" size="xs" variant="solid" class="capitalize gap-1">
          <UIcon :name="getStatusIcon(post.status)" class="w-3 h-3" :class="{ 'animate-spin': post.status === 'PROCESSING' }" />
          {{ getStatusDisplayName(post.status) }}
        </UBadge>
      </div>
    </div>

    <div class="flex-1 flex flex-col px-1">
      <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-1 mb-1" :class="{ 'italic text-gray-400': !publication?.title }">
        {{ displayTitle }}
      </h3>
      
      <p class="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-3 grow leading-relaxed">
        {{ truncateContent(publication?.content || '') }}
      </p>

      <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[12px] text-gray-400">
        <div class="flex items-center gap-1">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
          <span>{{ formatDateShort(post.publishedAt || post.scheduledAt || post.createdAt) }}</span>
        </div>
        <div v-if="publication?.postType" class="bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
          {{ publication.postType }}
        </div>
      </div>
    </div>
  </div>
</template>
