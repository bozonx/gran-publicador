<script setup lang="ts">
import type { PostWithRelations } from '~/types/posts'
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  posts: PostWithRelations[]
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
}>()

const { getPostProblemLevel } = usePublications()

const maxVisibleCount = computed(() => props.maxVisible || 5)
const iconClass = computed(() => {
  if (props.size === 'sm') return 'h-5 w-5 text-xxs'
  if (props.size === 'lg') return 'h-8 w-8 text-xs'
  return 'h-6 w-6 text-xxs'
})
</script>

<template>
  <div v-if="posts && posts.length > 0" class="flex -space-x-1.5 overflow-hidden">
    <div
      v-for="post in posts.slice(0, maxVisibleCount)"
      :key="post.id"
      class="rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden"
      :class="iconClass"
    >
      <CommonSocialIcon 
        v-if="post.channel"
        :platform="post.channel.socialMedia" 
        :problem-level="getPostProblemLevel(post)"
        :size="size || 'sm'"
      />
      <UIcon 
        v-else
        name="i-heroicons-question-mark-circle" 
        class="w-3 h-3 text-gray-400" 
      />
    </div>
    <div 
      v-if="posts.length > maxVisibleCount" 
      class="rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-medium z-10"
      :class="iconClass"
    >
      +{{ posts.length - maxVisibleCount }}
    </div>
  </div>
</template>
