<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { SocialPostingBodyFormatter } from '~/utils/bodyFormatter'
import { getSocialMediaDisplayName } from '~/utils/socialMedia'
import { marked, type Tokens } from 'marked'
import { preformatMarkdownForPlatform } from '@gran/shared/social-posting/md-preformatter'
import { normalizeTags, parseTags } from '~/utils/tags'

interface Props {
  modelValue: boolean
  post: PostWithRelations | any
  publication?: PublicationWithRelations | null
  projectTemplates?: any[]
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const viewMode = ref<'md' | 'html'>('md')

const renderer = new marked.Renderer()
const originalLinkRenderer = renderer.link.bind(renderer)
renderer.link = function (token: Tokens.Link) {
  const html = originalLinkRenderer(token)
  return html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
}

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const previewTitle = computed(() => {
  if (!props.post?.channel && !props.post?.socialMedia) return ''
  return getSocialMediaDisplayName(props.post.channel?.socialMedia || props.post.socialMedia, t)
})

function resolveTagsForPreview(): string[] {
  const postTags = (props.post as any)?.tags
  const pub = props.publication || props.post?.publication
  const pubTags = (pub as any)?.tags

  if (Array.isArray(postTags) && postTags.length > 0) {
    return normalizeTags(postTags.map(t => String(t ?? '')))
  }

  if (typeof postTags === 'string' && postTags.trim()) {
    return normalizeTags(parseTags(postTags))
  }

  if (Array.isArray((props.post as any)?.tagObjects) && (props.post as any).tagObjects.length > 0) {
    return normalizeTags((props.post as any).tagObjects.map((tag: any) => String(tag?.normalizedName || tag?.name || '')).filter(Boolean))
  }

  if (Array.isArray(pubTags) && pubTags.length > 0) {
    return normalizeTags(pubTags.map(t => String(t ?? '')))
  }

  if (typeof pubTags === 'string' && pubTags.trim()) {
    return normalizeTags(parseTags(pubTags))
  }

  if (Array.isArray((pub as any)?.tagObjects) && (pub as any).tagObjects.length > 0) {
    return normalizeTags((pub as any).tagObjects.map((tag: any) => String(tag?.normalizedName || tag?.name || '')).filter(Boolean))
  }

  return []
}

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

  const tags = resolveTagsForPreview()

  const md = SocialPostingBodyFormatter.format(
    {
      title: pub.title,
      content: props.post.content || pub.content,
      tags,
      postType: pub.postType,
      language: props.post.language || pub.language,
      authorComment: pub.authorComment,
      authorSignature: props.post.authorSignature || '',
    },
    props.post.channel || props.post,
    props.projectTemplates,
    pub.projectTemplateId
  )

  const platform = (props.post.channel?.socialMedia || props.post.socialMedia) as any
  return preformatMarkdownForPlatform({ platform, markdown: md })
})

const previewHtml = computed(() => {
  const snapshot = props.post?.postingSnapshot
  if (snapshot?.body && snapshot?.bodyFormat === 'html') {
    return snapshot.body
  }

  return marked.parse(previewContent.value) as string
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

      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          color="neutral"
          :variant="viewMode === 'md' ? 'solid' : 'soft'"
          @click="viewMode = 'md'"
        >
          MD
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          :variant="viewMode === 'html' ? 'solid' : 'soft'"
          @click="viewMode = 'html'"
        >
          HTML
        </UButton>
      </div>
    </template>

    <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
      <pre
        v-if="viewMode === 'md'"
        class="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200"
      >{{ previewContent }}</pre>
      <div
        v-else
        class="prose prose-sm dark:prose-invert max-w-none"
        v-html="previewHtml"
      />
    </div>

    <template #footer>
      <UButton color="neutral" variant="soft" @click="isOpen = false">
        {{ t('common.close') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
