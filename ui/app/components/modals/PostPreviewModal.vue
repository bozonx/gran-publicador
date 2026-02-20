<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { SocialPostingBodyFormatter } from '~/utils/bodyFormatter'
import { getSocialMediaDisplayName } from '~/utils/socialMedia'
import { marked, type Tokens } from 'marked'
import { preformatMarkdownForPlatform } from '@gran/shared/social-posting/md-preformatter'
import { normalizeTags, parseTags } from '~/utils/tags'
import type { TabsItem } from '@nuxt/ui'

interface Props {
  modelValue: boolean
  post: PostWithRelations | any
  publication?: PublicationWithRelations | null
  projectTemplates?: any[]
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const viewMode = ref<'md' | 'html'>('html')

const viewModeItems = computed<TabsItem[]>(() => [
  { label: 'HTML', value: 'html' },
  { label: 'MD', value: 'md' },
])

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
  const tagsCsv = tags.join(', ')

  const md = SocialPostingBodyFormatter.format(
    {
      title: pub.title,
      content: props.post.content || pub.content,
      tags: tagsCsv,
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
      <div class="flex items-start justify-between gap-4 w-full">
        <div class="flex items-center gap-2 min-w-0">
          <CommonSocialIcon 
            v-if="post?.channel?.socialMedia || post?.socialMedia" 
            :platform="post.channel?.socialMedia || post.socialMedia" 
          />
          <UIcon v-else name="i-heroicons-paper-airplane" class="w-5 h-5 text-primary-500" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ t('post.previewTitle', 'Post Preview') }}: {{ previewTitle }}
          </h3>
        </div>

        <UTabs
          v-model="viewMode"
          :items="viewModeItems"
          :content="false"
          class="shrink-0 mt-0.5"
        />
      </div>
    </template>

    <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
      <pre
        v-if="viewMode === 'md'"
        class="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200"
      >{{ previewContent }}</pre>
      <div
        v-else
        class="post-preview-html"
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

<style scoped>
.post-preview-html {
  color: rgb(31 41 55);
  font-size: 0.875rem;
  line-height: 1.5rem;
}

.dark .post-preview-html {
  color: rgb(229 231 235);
}

.post-preview-html :deep(p) {
  margin: 0.5rem 0;
}

.post-preview-html :deep(h1),
.post-preview-html :deep(h2),
.post-preview-html :deep(h3),
.post-preview-html :deep(h4),
.post-preview-html :deep(h5),
.post-preview-html :deep(h6) {
  margin: 0.75rem 0 0.5rem;
  font-weight: 600;
  line-height: 1.25;
}

.post-preview-html :deep(h1) {
  font-size: 1.125rem;
}

.post-preview-html :deep(h2) {
  font-size: 1.05rem;
}

.post-preview-html :deep(h3) {
  font-size: 1rem;
}

.post-preview-html :deep(ul),
.post-preview-html :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.post-preview-html :deep(li) {
  margin: 0.25rem 0;
}

.post-preview-html :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dark .post-preview-html :deep(a) {
  color: rgb(96 165 250);
}

.post-preview-html :deep(blockquote) {
  margin: 0.75rem 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid rgb(209 213 219);
  background: rgb(243 244 246);
}

.dark .post-preview-html :deep(blockquote) {
  border-left-color: rgb(75 85 99);
  background: rgb(17 24 39);
}

.post-preview-html :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.825rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  background: rgb(243 244 246);
}

.dark .post-preview-html :deep(code) {
  background: rgb(31 41 55);
}

.post-preview-html :deep(pre) {
  margin: 0.75rem 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: rgb(17 24 39);
  color: rgb(229 231 235);
  overflow: auto;
}

.post-preview-html :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.post-preview-html :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
}

.post-preview-html :deep(th),
.post-preview-html :deep(td) {
  border: 1px solid rgb(209 213 219);
  padding: 0.375rem 0.5rem;
  vertical-align: top;
}

.dark .post-preview-html :deep(th),
.dark .post-preview-html :deep(td) {
  border-color: rgb(55 65 81);
}

.post-preview-html :deep(th) {
  font-weight: 600;
  background: rgb(243 244 246);
}

.dark .post-preview-html :deep(th) {
  background: rgb(31 41 55);
}
</style>
