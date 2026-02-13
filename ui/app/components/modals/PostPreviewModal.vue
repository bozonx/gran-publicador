<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { SocialPostingBodyFormatter } from '~/utils/bodyFormatter'
import { getSocialMediaDisplayName } from '~/utils/socialMedia'

interface Props {
  modelValue: boolean
  post: PostWithRelations | any
  publication?: PublicationWithRelations | null
  projectTemplates?: any[]
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const previewTitle = computed(() => {
  if (!props.post?.channel && !props.post?.socialMedia) return ''
  return getSocialMediaDisplayName(props.post.channel?.socialMedia || props.post.socialMedia, t)
})

const previewContent = computed(() => {
  if (!props.post) return ''

  // 1. Try to use snapshot if available
  if (props.post.postingSnapshot?.body) {
    return props.post.postingSnapshot.body
  }

  // 2. Fallback to dynamic formatting if snapshot is not available or we are in edit mode
  // and need to show unsaved changes
  const pub = props.publication || props.post.publication
  if (!pub) return props.post.content || ''

  return SocialPostingBodyFormatter.format(
    {
      title: pub.title,
      content: props.post.content || pub.content,
      tags: props.post.tags || pub.tags,
      postType: pub.postType,
      language: props.post.language || pub.language,
      authorComment: pub.authorComment,
      authorSignature: props.post.authorSignature || '',
    },
    props.post.channel || props.post,
    props.projectTemplates,
    pub.projectTemplateId
  )
})
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('post.previewTitle', 'Post Preview')"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <CommonSocialIcon 
          v-if="post?.channel?.socialMedia || post?.socialMedia" 
          :platform="post.channel?.socialMedia || post.socialMedia" 
        />
        <UIcon v-else name="i-heroicons-paper-airplane" class="w-5 h-5 text-primary-500" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {{ t('post.previewTitle', 'Post Preview') }}: {{ previewTitle }}
        </h3>
      </div>
    </template>

    <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
      <pre class="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200">{{ previewContent }}</pre>
    </div>

    <template #footer>
      <UButton color="neutral" variant="soft" @click="isOpen = false">
        {{ t('common.close') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
