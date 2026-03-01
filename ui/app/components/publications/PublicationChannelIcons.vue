<script setup lang="ts">
import type { PostWithRelations } from '~/types/posts'
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  posts: PostWithRelations[]
}>()

const { getPostProblemLevel } = usePublications()
</script>

<template>
  <div v-if="posts && posts.length > 0" class="flex -space-x-1.5 overflow-hidden">
    <div
      v-for="post in posts.slice(0, 5)"
      :key="post.id"
      class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden"
    >
      <CommonSocialIcon 
        v-if="post.channel"
        :platform="post.channel.socialMedia" 
        :problem-level="getPostProblemLevel(post)"
        size="sm"
      />
      <UIcon 
        v-else
        name="i-heroicons-question-mark-circle" 
        class="w-3 h-3 text-gray-400" 
      />
    </div>
    <div v-if="posts.length > 5" class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-500 font-medium z-10">
      +{{ posts.length - 5 }}
    </div>
  </div>
</template>
