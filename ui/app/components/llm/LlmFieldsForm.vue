<script setup lang="ts">
import type { LlmPublicationFieldsResult, LlmPublicationFieldsPostResult, PostChannelInfo } from '../../types/llm'

interface Props {
  fieldsResult: LlmPublicationFieldsResult
  pubSelectedFields: {
    title: boolean
    description: boolean
    tags: boolean
    content: boolean
  }
  postSelectedFields: Record<string, {
    tags: boolean
    content: boolean
  }>
  postChannels: PostChannelInfo[]
  publicationLanguage?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'removePubTag', tag: string): void
  (e: 'removePostTag', channelId: string, tag: string): void
  (e: 'updatePostContent', channelId: string, content: string): void
}>()

const { t } = useI18n()

function getPostResult(channelId: string): LlmPublicationFieldsPostResult | undefined {
  return props.fieldsResult.posts.find((p: LlmPublicationFieldsPostResult) => p.channelId === channelId)
}

function getPostContentForChannel(channelId: string): string {
  const post = getPostResult(channelId)
  const base = props.fieldsResult.publication.content || ''
  return (post?.content || base).trim()
}
</script>

<template>
  <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
    <!-- PUBLICATION BLOCK -->
    <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-gray-200 dark:border-gray-700/50">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-primary" />
          <span class="font-semibold text-sm text-gray-900 dark:text-white">{{ t('llm.publicationBlock') }}</span>
          <UBadge v-if="publicationLanguage" variant="subtle" color="neutral" size="xs" class="font-mono ml-auto">
            {{ publicationLanguage }}
          </UBadge>
        </div>
      </div>
      <div class="p-4 space-y-4">
        <!-- Title -->
        <div class="space-y-1.5">
          <UCheckbox v-model="pubSelectedFields.title" :label="t('post.title')" />
          <UInput v-if="pubSelectedFields.title" v-model="fieldsResult.publication.title" class="bg-white dark:bg-gray-800 w-full" />
        </div>

        <!-- Tags -->
        <div class="space-y-1.5">
          <UCheckbox v-model="pubSelectedFields.tags" :label="t('post.tags')" />
          <div v-if="pubSelectedFields.tags" class="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 flex flex-wrap gap-1.5 min-h-9">
            <template v-if="fieldsResult.publication.tags.length > 0">
              <UButton
                v-for="tag in fieldsResult.publication.tags"
                :key="tag"
                size="xs"
                color="neutral"
                variant="soft"
                class="rounded-full! px-2 py-0.5 h-auto"
                @click="emit('removePubTag', tag)"
              >
                #{{ tag }}
                <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1 opacity-50 hover:opacity-100" />
              </UButton>
            </template>
            <span v-else class="text-xs text-gray-400 italic">{{ t('common.none') }}</span>
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-1.5">
          <UCheckbox v-model="pubSelectedFields.description" :label="t('post.description')" />
          <UTextarea v-if="pubSelectedFields.description" v-model="fieldsResult.publication.description" autoresize :rows="2" class="w-full" />
        </div>

        <!-- Content -->
        <div class="space-y-1.5">
          <UCheckbox v-model="pubSelectedFields.content" :label="t('post.contentLabel')" />
          <UTextarea v-if="pubSelectedFields.content" v-model="fieldsResult.publication.content" autoresize :rows="4" class="font-mono text-xs w-full" />
        </div>
      </div>
    </div>

    <!-- POST BLOCKS (per channel) -->
    <template v-for="ch in postChannels" :key="ch.channelId">
      <div
        v-if="postSelectedFields[ch.channelId]"
        class="border border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden"
      >
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/50">
          <div class="flex items-center gap-2">
            <CommonSocialIcon v-if="ch.socialMedia" :platform="ch.socialMedia" size="xs" />
            <UIcon v-else name="i-heroicons-megaphone" class="w-4 h-4 text-gray-400" />
            <span class="font-semibold text-sm text-gray-900 dark:text-white truncate">{{ ch.channelName }}</span>
          </div>
        </div>
        <div class="p-4 space-y-4">
          <!-- Post Content -->
          <div class="space-y-1.5">
            <UCheckbox v-model="postSelectedFields[ch.channelId]!.content" :label="t('post.contentLabel')" />
            <UTextarea
              v-if="postSelectedFields[ch.channelId]!.content"
              :model-value="getPostContentForChannel(ch.channelId)"
              autoresize
              :rows="4"
              class="font-mono text-xs w-full"
              @update:model-value="(v) => emit('updatePostContent', ch.channelId, String(v ?? ''))"
            />
          </div>

          <!-- Post Tags -->
          <div v-if="(getPostResult(ch.channelId)?.tags?.length ?? 0) > 0" class="space-y-1.5">
            <UCheckbox v-model="postSelectedFields[ch.channelId]!.tags" :label="t('post.tags')" />
            <div v-if="postSelectedFields[ch.channelId]!.tags" class="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 flex flex-wrap gap-1.5 min-h-9">
              <UButton
                v-for="tag in getPostResult(ch.channelId)!.tags"
                :key="tag"
                size="xs"
                :color="(ch.tags || []).includes(tag) ? 'primary' : 'neutral'"
                variant="soft"
                class="rounded-full! px-2 py-0.5 h-auto"
                @click="emit('removePostTag', ch.channelId, tag)"
              >
                #{{ tag }}
                <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1 opacity-50 hover:opacity-100" />
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
