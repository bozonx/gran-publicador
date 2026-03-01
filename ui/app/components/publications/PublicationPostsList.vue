<script setup lang="ts">
import type { PublicationWithRelations } from '~/types/publications'

const props = defineProps<{
  publication: PublicationWithRelations
  channels: any[]
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'post-deleted'): void
}>()

const { t } = useI18n()

function handlePostDeleted() {
  emit('post-deleted')
}

function handleRefresh() {
  emit('refresh')
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="props.publication.posts && props.publication.posts.length > 0">
      <div class="flex items-center gap-2 mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('publication.postsInChannels') }}
        </h3>
      </div>
      
      <div class="space-y-4">
        <PostsPostEditBlock
          v-for="post in props.publication.posts"
          :key="post.id"
          :post="post"
          :publication="props.publication"
          :channels="props.channels"
          autosave
          @deleted="handlePostDeleted"
          @success="handleRefresh"
        ></PostsPostEditBlock>
      </div>
    </div>
    <div v-else class="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-gray-500 dark:text-gray-400">{{ t('publication.noPosts') }}</p>
    </div>
  </div>
</template>
