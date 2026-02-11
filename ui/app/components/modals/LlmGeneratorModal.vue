<script setup lang="ts">
import { FORM_SPACING } from '~/utils/design-tokens'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'
import LlmPromptTemplatePickerModal from '~/components/modals/LlmPromptTemplatePickerModal.vue'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import type { MediaItem } from '~/composables/useMedia'
import type { LlmPublicationFieldsResult, LlmPublicationFieldsPostResult, ChannelInfoForLlm } from '~/composables/useLlm'
import { DialogTitle, DialogDescription } from 'reka-ui'
import { LlmErrorType } from '~/composables/useLlm'
import {
  getAggregatedMaxTextLength,
  getAggregatedTagsConfig,
  getTagsLimitsByPlatform,
  type PostType,
  type SocialMedia,
} from '~/utils/socialMediaPlatforms'

interface PostChannelInfo {
  channelId: string
  channelName: string
  language: string
  tags?: string[]
  socialMedia?: string
}

interface ApplyData {
  publication?: {
    title?: string
    description?: string
    tags?: string
    content?: string
  }
  posts?: Array<{
    channelId: string
    content?: string
    tags?: string
  }>
  meta?: Record<string, any>
}

interface Emits {
  (e: 'apply', data: ApplyData): void
  (e: 'close'): void
}

interface Props {
  publicationId: string
  content?: string
  media?: MediaItem[]
  projectId?: string
  publicationMeta?: Record<string, any>
  postType?: string
  publicationLanguage?: string
  postChannels?: PostChannelInfo[]
}

const { publicationId, content, media, projectId, publicationMeta, postType, publicationLanguage, postChannels } = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generatePublicationFields, isGenerating, estimateTokens, stop: stopLlm, error: llmError } = useLlm()
const { publicationLlmChat } = usePublications()
const { updatePublication } = usePublications()
const { transcribeAudio, isTranscribing, error: sttError } = useStt()
const {
  isRecording,
  recordingDuration,
  error: voiceError,
  startRecording,
  stopRecording,
} = useVoiceRecorder()
const { user } = useAuth()

const isOpen = defineModel<boolean>('open', { required: true })

const platformsForConstraints = computed(() => {
  const platforms = (postChannels || [])
    .map((ch) => ch.socialMedia)
    .filter(Boolean) as SocialMedia[]
  return [...new Set(platforms)]
})

function parseUserRequestedMaxContentLength(text: string): number | null {
  const input = String(text ?? '')

  const patterns: RegExp[] = [
    /max(?:imum)?\s*(?:content\s*)?length\s*[:=]?\s*(\d{2,6})/i,
    /(?:up\s*to|no\s*more\s*than|not\s*more\s*than)\s*(\d{2,6})\s*(?:chars|characters|symbols)/i,
    /(?:до|не\s*более)\s*(\d{2,6})\s*(?:символ(?:ов|а)?|знак(?:ов|а)?|chars|characters)/i,
    /(\d{2,6})\s*(?:символ(?:ов|а)?|знак(?:ов|а)?|chars|characters)\s*(?:макс|max(?:imum)?)/i,
  ]

  for (const re of patterns) {
    const m = input.match(re)
    const raw = m?.[1]
    if (!raw) continue
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) continue
    if (n < 10 || n > 500000) continue
    return n
  }

  return null
}

function resolveMaxContentLengthForPrompt(params: { sourceText: string }): number | null {
  const resolvedPostType = (postType || 'POST') as PostType
  const hasMedia = (media || []).length > 0

  const platformMax = getAggregatedMaxTextLength({
    platforms: platformsForConstraints.value,
    postType: resolvedPostType,
    hasMedia,
  })
  const userRequested = parseUserRequestedMaxContentLength(params.sourceText)

  if (userRequested && Number.isFinite(userRequested)) {
    if (platformMax && Number.isFinite(platformMax)) {
      return Math.min(platformMax, userRequested)
    }
    return userRequested
  }

  return platformMax && Number.isFinite(platformMax) ? platformMax : null
}

function buildConstraintsBlock(params: { sourceText: string }): string {
  const maxLen = resolveMaxContentLengthForPrompt({ sourceText: params.sourceText })

  const lines: string[] = []
  if (maxLen && Number.isFinite(maxLen)) {
    lines.push(`Max content length: ${maxLen} characters. Do not exceed this limit.`)
  }

  const tagsCfg = getAggregatedTagsConfig(platformsForConstraints.value)
  if (tagsCfg.supported && tagsCfg.maxCount && tagsCfg.recommendedCount) {
    lines.push(`Publication tags: recommended ${tagsCfg.recommendedCount}, maximum ${tagsCfg.maxCount}.`)
  }

  const tagLimitsByPlatform = getTagsLimitsByPlatform(platformsForConstraints.value)
  const supportedTagPlatforms = tagLimitsByPlatform.filter((x) => x.supported)
  if (supportedTagPlatforms.length > 0) {
    lines.push('Channel tags limits by platform:')
    for (const lim of supportedTagPlatforms) {
      const maxCount = lim.maxCount ?? 'n/a'
      const recommendedCount = lim.recommendedCount ?? 'n/a'
      const maxTagLength = lim.maxTagLength ?? 'n/a'
      lines.push(
        `- ${lim.platform}: recommended ${recommendedCount}, maximum ${maxCount}, maxTagLength ${maxTagLength}.`,
      )
    }
  }

  if (lines.length === 0) return ''
  return `\n\n<content_constraints>\n${lines.join('\n')}\n</content_constraints>\n`
}

function stripContentConstraintsBlock(text: string): string {
  return String(text ?? '')
    .replace(/\n*<content_constraints>[\s\S]*?<\/content_constraints>\n*/g, '\n')
    .trim()
}

async function handleVoiceRecording() {
  if (isRecording.value) {
    const audioBlob = await stopRecording()

    if (!audioBlob) {
      toast.add({
        title: t('llm.recordingError'),
        color: 'error',
      })
      return
    }

    const text = await transcribeAudio(audioBlob, user.value?.language)

    if (text) {
      if (prompt.value && !prompt.value.endsWith('\n')) {
        prompt.value += '\n\n'
      }
      prompt.value += text

      toast.add({
        title: t('llm.transcriptionSuccess', 'Transcription successful'),
        color: 'success',
      })
    } else {
      toast.add({
        title: t('llm.transcriptionError'),
        description: sttError.value || t('llm.errorMessage'),
        color: 'error',
      })
    }

    return
  }

  const success = await startRecording()
  if (!success) {
    toast.add({
      title: t('llm.recordingError'),
      description: voiceError.value ? t(`llm.${voiceError.value}`, voiceError.value) : undefined,
      color: 'error',
    })
  }
}

// Steps
const step = ref(1) // 1: AI Chat, 2: Parameter Generation

// Step 1: Chat state
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  contextTagIds?: string[]
  contextSnapshot?: Array<{
    id: string
    label: string
    promptText: string
    kind: 'content' | 'media'
    enabled?: boolean
  }>
}
const chatMessages = ref<ChatMessage[]>([])
const prompt = ref('')

const api = useApi()
const activeChatController = ref<AbortController | null>(null)
const isChatGenerating = ref(false)

function getChatErrorDescription(err: any): string {
  const msg = String(err?.message || '')
  if (msg.toLowerCase().includes('aborted')) {
    return t('llm.aborted', 'Request was stopped.')
  }
  if (msg.toLowerCase().includes('timeout')) {
    return t('llm.timeoutError', 'Request timed out. Try reducing context or retry.')
  }
  if (err?.status === 429 || err?.statusCode === 429) {
    return t('llm.rateLimitError', 'Too many requests. Please try again later.')
  }
  return t('llm.errorMessage')
}

const modalDescription = computed(() => {
  return step.value === 1 ? t('llm.step1Description') : t('llm.step2Description')
})

// Step 2: Fields generation state
const fieldsResult = ref<LlmPublicationFieldsResult | null>(null)
const pubSelectedFields = reactive({
  title: true,
  description: true,
  tags: true,
  content: false,
})

interface PostSelectedFields {
  tags: boolean
}
const postSelectedFields = ref<Record<string, PostSelectedFields>>({})

const isExtracting = ref(false)
const isApplying = ref(false)

const modalRootRef = ref<HTMLElement | null>(null)
const promptInputRef = ref()
const step2TitleInputRef = ref()

const isStep1Open = computed(() => isOpen.value && step.value === 1)
const isStep2Open = computed(() => isOpen.value && step.value === 2)

useModalAutoFocus({
  open: isStep1Open,
  root: modalRootRef,
  candidates: [{ target: promptInputRef }],
})

useModalAutoFocus({
  open: isStep2Open,
  root: modalRootRef,
  candidates: [{ target: step2TitleInputRef }],
})

// Form common state
// Template selection
const isTemplatePickerOpen = ref(false)

interface LlmContextTag {
  id: string
  label: string
  promptText: string
  kind: 'content' | 'media'
  enabled: boolean
}

const contextTags = ref<LlmContextTag[]>([])

const runtimeConfig = useRuntimeConfig()

const contextLimit = computed(() => {
  const isArticle = postType === 'ARTICLE'
  const raw = isArticle
    ? runtimeConfig.public.llmContextLimitArticle
    : runtimeConfig.public.llmContextLimitDefault
  const parsed = Number.parseInt(String(raw), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : (isArticle ? 100000 : 10000)
})

const contextStats = computed(() => {
  const rawParts = contextTags.value
    .filter(t => t.enabled)
    .map(t => t.promptText?.trim())
    .filter((x): x is string => Boolean(x))

  const rawText = rawParts.join('\n')
  const limit = contextLimit.value
  const used = rawText.slice(0, Math.max(0, limit))

  return {
    totalChars: rawText.length,
    usedChars: used.length,
    limitChars: limit,
    isTruncated: rawText.length > used.length,
  }
})

function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}

function getCleanedContextText(ctx: LlmContextTag): string {
  if (!ctx.promptText) return ctx.label
  return ctx.promptText
    .replace(/<[^>]*>/g, '')
    .trim()
}

function makeContextPromptBlock(tags: LlmContextTag[]): string {
  const rawParts = tags
    .filter(t => t.enabled)
    .map((t) => t.promptText?.trim())
    .filter((x): x is string => Boolean(x))

  if (rawParts.length === 0) return ''

  const limit = contextLimit.value
  let remaining = limit

  const parts: string[] = []
  for (const part of rawParts) {
    if (remaining <= 0) break

    const trimmed = part.trim()
    if (!trimmed) continue

    const next = truncateText(trimmed, remaining)
    if (!next.trim()) continue

    parts.push(next)
    remaining -= next.length
  }

  if (parts.length === 0) return ''
  return `\n\n${parts.join('\n')}`
}

function toggleContextTag(id: string) {
  const tag = contextTags.value.find(t => t.id === id)
  if (tag) {
    tag.enabled = !tag.enabled
  }

  activeChatController.value = null
}

function handleStop() {
  stopLlm()
  activeChatController.value?.abort()
  isChatGenerating.value = false

  if (step.value === 2) {
    isExtracting.value = false
    fieldsResult.value = null
    step.value = 1
  }
}

const contextTagById = computed(() => {
  return new Map(contextTags.value.map(t => [t.id, t] as const))
})

function getContextTagsForMessage(message: ChatMessage): LlmContextTag[] {
  // If we have a snapshot, use it (historical accuracy)
  if (message.contextSnapshot && message.contextSnapshot.length > 0) {
    // Ensure all tags have the enabled field (for backward compatibility)
    return message.contextSnapshot.map(tag => ({
      ...tag,
      enabled: tag.enabled ?? true,
    }))
  }

  // Fallback to current tags (for older saved messages without snapshots)
  const ids = message.contextTagIds || []
  if (ids.length === 0) return []

  const map = contextTagById.value
  return ids.map(id => map.get(id)).filter((x): x is LlmContextTag => Boolean(x))
}

const hasContext = computed(() => contextTags.value.length > 0)

// Metadata from last generation
const metadata = ref<any>(null)

// Token counter with debounce
const estimatedTokens = computed(() => {
  return estimateTokens(prompt.value + makeContextPromptBlock(contextTags.value))
})

const estimatedTokensValue = computed(() => Number(estimatedTokens.value) || 0)

// Track if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  if (step.value === 1 && chatMessages.value.length > 0) return true
  if (step.value === 2 && fieldsResult.value) return true
  return false
})

// Helper: get channel info for a post result
function getChannelInfo(channelId: string): PostChannelInfo | undefined {
  return postChannels?.find(ch => ch.channelId === channelId)
}

// Channels that have posts (for Step 2 display)
const channelsWithPosts = computed(() => postChannels || [])

// Initialize post selected fields when fieldsResult changes
function initPostSelectedFields() {
  const fields: Record<string, PostSelectedFields> = {}
  for (const ch of channelsWithPosts.value) {
    const hasChannelTags = Array.isArray(ch.tags) && ch.tags.length > 0
    fields[ch.channelId] = {
      tags: hasChannelTags,
    }
  }
  postSelectedFields.value = fields
}

// Load templates when modal opens
watch(isOpen, async (open) => {
  if (open) {
    const nextTags: LlmContextTag[] = []

    if (content?.trim()) {
      nextTags.push({
        id: 'content:1',
        label: t('llm.publicationBlock'),
        promptText: `<source_content>\n${content.trim()}\n</source_content>`,
        kind: 'content',
        enabled: true,
      })
    }

    const mediaItems = (media || []).filter(m => m?.type === 'IMAGE')
    for (const item of mediaItems) {
      const text = (item.description || item.alt || '').trim()
      if (!text) continue
      nextTags.push({
        id: `media:${item.id}`,
        label: text,
        promptText: `<image_description>${text}</image_description>`,
        kind: 'media',
        enabled: true,
      })
    }

    contextTags.value = nextTags

    const savedChat = publicationMeta?.llmPublicationContentGenerationChat
    const savedMessages = savedChat?.messages
    if (Array.isArray(savedMessages) && savedMessages.length > 0) {
      chatMessages.value = savedMessages.map((m: any, idx: number) => {
        const role = m?.role
        const content = typeof m?.content === 'string' ? m.content : ''
        if (idx === 0 && role === 'user') {
          return {
            ...m,
            content: stripContentConstraintsBlock(content),
          }
        }
        return m
      })
      metadata.value = savedChat?.model || null
    }
  } else {
    // Reset form when modal closes
    step.value = 1
    chatMessages.value = []
    prompt.value = ''
    fieldsResult.value = null
    metadata.value = null
    contextTags.value = []
    isTemplatePickerOpen.value = false
    isResetChatConfirmOpen.value = false
    pubSelectedFields.content = false
    isApplying.value = false
    postSelectedFields.value = {}
  }
})

function handleTemplateSelected(template: LlmPromptTemplate) {
  if (!template?.prompt?.trim()) return

  if (prompt.value.trim()) {
    prompt.value = prompt.value.trimEnd() + '\n\n'
  }

  prompt.value += template.prompt
}

// Watch for voice recording errors
watch(voiceError, (err) => {
  if (err) {
    toast.add({
      title: t('llm.recordingError'),
      description: t(`llm.${err}`),
      color: 'error',
    })
  }
})

async function handleGenerate() {
  if (!prompt.value.trim()) {
    toast.add({
      title: t('llm.promptRequired'),
      color: 'error',
    });
    return;
  }

  const userText = prompt.value.trim()
  const isFirstMessage = chatMessages.value.length === 0

  const mediaDescriptions = contextTags.value
    .filter(t => t.enabled && t.kind === 'media')
    .map(t => (t.label || '').trim())
    .filter(Boolean)

  const message = userText

  chatMessages.value.push({
    role: 'user',
    content: message,
    contextTagIds: contextTags.value.filter(t => t.enabled).map(t => t.id),
    contextSnapshot: contextTags.value.filter(t => t.enabled).map(t => ({ ...t })),
  });
  prompt.value = '';

  isChatGenerating.value = true

  activeChatController.value?.abort()
  activeChatController.value = api.createAbortController()

  let response: any = null
  try {
    response = await publicationLlmChat(
      publicationId,
      {
        message,
        ...(isFirstMessage
          ? {
              context: {
                content,
                mediaDescriptions,
                contextLimitChars: contextLimit.value,
              },
            }
          : {}),
      },
      { signal: activeChatController.value.signal },
    )
  } catch (err: any) {
    const description = getChatErrorDescription(err)
    const isAborted = String(description || '').toLowerCase().includes('stopped')
      || String(err?.message || '').toLowerCase().includes('aborted')

    if (!isAborted) {
      toast.add({
        title: t('llm.error'),
        description,
        color: 'error',
      })
    }
    response = null
  } finally {
    activeChatController.value = null
    isChatGenerating.value = false
  }

  if (response) {
    if (Array.isArray(response.chat?.messages) && response.chat!.messages.length > 0) {
      chatMessages.value = (response.chat!.messages as any[]).map((m: any, idx: number) => {
        const role = m?.role
        const content = typeof m?.content === 'string' ? m.content : ''
        if (idx === 0 && role === 'user') {
          return {
            ...m,
            content: stripContentConstraintsBlock(content),
          }
        }
        return m
      }) as any
    } else {
      chatMessages.value.push({ role: 'assistant', content: response.message });
    }
    metadata.value = response.metadata || null;
  }
}

function handleSkip() {
  // Skip chat — use context as source text
  const contextText = makeContextPromptBlock(contextTags.value).trim()
  if (!contextText) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.contextTruncation'),
      color: 'error',
    })
    return
  }

  step.value = 2
  pubSelectedFields.content = false
  initPostSelectedFields()
  handleFieldsGeneration(contextText)
}

function handleNext() {
  const lastAssistantMessage = [...chatMessages.value].reverse().find(m => m.role === 'assistant')
  
  if (!lastAssistantMessage?.content?.trim()) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.lastMessageEmpty'),
      color: 'error',
    })
    return
  }
  
  step.value = 2
  pubSelectedFields.content = true
  initPostSelectedFields()
  handleFieldsGeneration(lastAssistantMessage.content)
}

async function handleFieldsGeneration(sourceText: string) {
  isExtracting.value = true
  fieldsResult.value = null
  
  try {
    const channelsForApi: ChannelInfoForLlm[] = channelsWithPosts.value.map(ch => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      socialMedia: ch.socialMedia,
      tags: ch.tags,
    }))

      const response = await generatePublicationFields(
        (sourceText + buildConstraintsBlock({ sourceText })).trim(),
        publicationLanguage || 'en-US',
        channelsForApi
      )
    
    if (response) {
      const hasData = response.publication.title || response.publication.description || response.publication.tags.length > 0 || response.publication.content
      
      if (!hasData) {
        toast.add({
          title: t('llm.extractionFailed'),
          description: t('llm.extractionEmpty'),
          color: 'warning',
        })
      }
      
      fieldsResult.value = response
    } else {
      const errType = llmError.value?.type
      const description =
        errType === LlmErrorType.RATE_LIMIT
          ? t('llm.rateLimitError', 'Too many requests. Please try again later.')
          : errType === LlmErrorType.TIMEOUT
            ? t('llm.timeoutError', 'Request timed out. Try reducing context or retry.')
            : errType === LlmErrorType.ABORTED
              ? t('llm.aborted', 'Request was stopped.')
              : t('llm.errorMessage')

      toast.add({
        title: t('llm.error'),
        description,
        color: 'error',
      });
    }
  } finally {
    isExtracting.value = false
  }
}

const formattedDuration = computed(() => {
  const minutes = Math.floor(recordingDuration.value / 60)
  const seconds = recordingDuration.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const chatContainer = useTemplateRef<HTMLElement>('chatContainer')

watch(() => chatMessages.value.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTo({
      top: chatContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
})

// Tag management for publication
function removePubTag(tagToRemove: string) {
  if (!fieldsResult.value) return
  fieldsResult.value.publication.tags = fieldsResult.value.publication.tags.filter(t => t !== tagToRemove)
}

// Tag management for posts
function removePostTag(channelId: string, tagToRemove: string) {
  if (!fieldsResult.value) return
  const post = fieldsResult.value.posts.find(p => p.channelId === channelId)
  if (post) {
    post.tags = post.tags.filter(t => t !== tagToRemove)
  }
}

// Get post result for a channel
function getPostResult(channelId: string): LlmPublicationFieldsPostResult | undefined {
  return fieldsResult.value?.posts.find(p => p.channelId === channelId)
}

async function handleInsert() {
  if (!fieldsResult.value) return
  
  // Check if at least one field is selected
  const hasPubSelection = pubSelectedFields.title || pubSelectedFields.description || 
                           pubSelectedFields.tags || pubSelectedFields.content
  const hasPostSelection = Object.values(postSelectedFields.value).some(f => f.tags)
  
  if (!hasPubSelection && !hasPostSelection) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.noFieldsSelected'),
      color: 'error',
    })
    return
  }
  
  const data: ApplyData = {}

  // Publication fields
  if (hasPubSelection) {
    const pub: ApplyData['publication'] = {}
    if (pubSelectedFields.title && fieldsResult.value.publication.title) {
      pub.title = fieldsResult.value.publication.title
    }
    if (pubSelectedFields.description && fieldsResult.value.publication.description) {
      pub.description = fieldsResult.value.publication.description
    }
    if (pubSelectedFields.tags && fieldsResult.value.publication.tags.length > 0) {
      pub.tags = fieldsResult.value.publication.tags.join(', ')
    }
    if (pubSelectedFields.content && fieldsResult.value.publication.content) {
      pub.content = fieldsResult.value.publication.content
    }
    data.publication = pub
  }

  // Post fields
  if (hasPostSelection) {
    const posts: ApplyData['posts'] = []
    for (const [channelId, fields] of Object.entries(postSelectedFields.value)) {
      if (!fields.tags) continue
      const postResult = getPostResult(channelId)
      if (!postResult) continue

      const postData: { channelId: string; tags?: string } = { channelId }
      if (fields.tags && postResult.tags.length > 0) {
        postData.tags = postResult.tags.join(', ')
      }
      posts.push(postData)
    }
    if (posts.length > 0) {
      data.posts = posts
    }
  }

  isApplying.value = true
  emit('apply', data)
}

function handleClose() {
  if (hasUnsavedChanges.value) {
    const confirmed = confirm(t('llm.unsavedChangesMessage'))
    if (!confirmed) return
  }
  
  isOpen.value = false
  emit('close')
}

// Called by parent after successful save
function onApplySuccess() {
  isApplying.value = false
  isOpen.value = false
}

// Called by parent after failed save
function onApplyError() {
  isApplying.value = false
}

defineExpose({
  onApplySuccess,
  onApplyError
})

const isResetChatConfirmOpen = ref(false)

function handleResetChat() {
  isResetChatConfirmOpen.value = true
}

async function confirmResetChat() {
  handleStop()

  // Clear chat messages
  chatMessages.value = []
  prompt.value = ''
  metadata.value = null

  // Re-initialize context tags
  const nextTags: LlmContextTag[] = []

  if (content?.trim()) {
    nextTags.push({
      id: 'content:1',
      label: 'Контент',
      promptText: `<source_content>\n${content.trim()}\n</source_content>`,
      kind: 'content',
      enabled: true,
    })
  }

  const mediaItems = (media || []).filter(m => m?.type === 'IMAGE')
  for (const item of mediaItems) {
    const text = (item.description || item.alt || '').trim()
    if (!text) continue
    nextTags.push({
      id: `media:${item.id}`,
      label: text,
      promptText: `<image_description>${text}</image_description>`,
      kind: 'media',
      enabled: true,
    })
  }

  contextTags.value = nextTags

  // Clear publication meta
  if (publicationId) {
    try {
      await updatePublication(publicationId, {
        meta: {
          ...publicationMeta,
          llmPublicationContentGenerationChat: null,
        },
      })
    } catch (error) {
      console.error('Failed to clear chat meta:', error)
    }
  }

  isResetChatConfirmOpen.value = false

  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('llm.generate')" :description="modalDescription" size="2xl">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {{ t('llm.generate') }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ modalDescription }}
        </DialogDescription>
      </div>
    </template>
    <div ref="modalRootRef" :class="FORM_SPACING.section">
      <!-- STEP 1: CHAT -->
      <template v-if="step === 1">

        <UAlert
          v-if="contextStats.isTruncated"
          color="warning"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="t('llm.contextTruncatedTitle', 'Context was truncated')"
          :description="t('llm.contextTruncatedDesc', { used: contextStats.usedChars, total: contextStats.totalChars, limit: contextStats.limitChars })"
          class="mb-4"
        />

        <div v-if="contextTags.length > 0" class="mb-4">
          <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
            <div class="flex flex-wrap gap-2">
              <UPopover
                v-for="ctx in contextTags"
                :key="ctx.id"
                mode="hover"
                :popper="{ placement: 'top' }"
              >
                <div class="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                  <UCheckbox
                    :model-value="ctx.enabled"
                    @update:model-value="toggleContextTag(ctx.id)"
                  />
                  <span class="text-xs truncate max-w-105">{{ ctx.label }}</span>
                </div>
                <template #content>
                  <div class="p-3 max-w-sm text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {{ getCleanedContextText(ctx) }}
                  </div>
                </template>
              </UPopover>
            </div>
          </div>
        </div>

        <!-- Chat Area -->
        <div 
          ref="chatContainer"
          class="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700/50 rounded-lg bg-gray-50/50 dark:bg-gray-950 p-4 space-y-4"
        >
          <div v-if="chatMessages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 opacity-60">
             <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 mb-2" />
             <p class="text-sm">{{ t('llm.chatEmpty') }}</p>
          </div>
          
          <div 
            v-for="(msg, idx) in chatMessages" 
            :key="idx"
            class="flex flex-col"
            :class="msg.role === 'user' ? 'items-end' : 'items-start'"
          >
            <div 
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
              :class="msg.role === 'user' 
                ? 'bg-primary text-white dark:bg-primary-600 rounded-tr-none' 
                : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 rounded-tl-none shadow-sm'"
            >
              <div class="whitespace-pre-wrap">{{ msg.content }}</div>

              <div v-if="msg.role === 'user' && idx === 0 && getContextTagsForMessage(msg).length > 0" class="mt-2">
                <div class="flex flex-wrap gap-1.5">
                  <UPopover
                    v-for="ctx in getContextTagsForMessage(msg)"
                    :key="ctx.id"
                    mode="hover"
                    :popper="{ placement: 'top' }"
                  >
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="soft"
                      class="rounded-full! px-2 py-0.5 h-auto max-w-full"
                    >
                      <span class="truncate max-w-105">{{ ctx.label }}</span>
                    </UButton>
                    <template #content>
                      <div class="p-3 max-w-sm text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {{ getCleanedContextText(ctx) }}
                      </div>
                    </template>
                  </UPopover>
                </div>
              </div>
            </div>
            <span class="text-[10px] text-gray-400 mt-1 uppercase font-medium tracking-tight">
              {{ msg.role === 'user' ? t('common.user') : t('common.assistant') }}
            </span>
          </div>
          
          <!-- Generating indicator -->
          <div v-if="isChatGenerating" class="flex items-start gap-2">
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
               <div class="flex gap-1.5">
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
               </div>
            </div>
          </div>
        </div>

        <!-- Template Picker -->
        <div class="mb-4">
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-heroicons-squares-2x2"
            :disabled="isGenerating"
            @click="isTemplatePickerOpen = true"
          >
            {{ t('llm.selectTemplate') }}
          </UButton>

          <LlmPromptTemplatePickerModal
            v-model:open="isTemplatePickerOpen"
            :project-id="projectId"
            @select="handleTemplateSelected"
          />
        </div>

        <!-- Chat Input -->
        <div class="relative mb-4">
          <UTextarea
            ref="promptInputRef"
            v-model="prompt"
            :placeholder="t('llm.promptPlaceholder')"
            :rows="3"
            autoresize
            :disabled="isChatGenerating || isGenerating || isRecording || isTranscribing"
            class="w-full pr-12"
            @keydown.ctrl.enter="handleGenerate"
          />
          
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5">
            <UTooltip :text="t('llm.voiceInputAppend')">
              <UButton
                icon="i-heroicons-microphone"
                :color="isRecording ? 'error' : 'neutral'"
                variant="ghost"
                size="sm"
                :disabled="isGenerating || isTranscribing"
                @click="handleVoiceRecording"
              />
            </UTooltip>
            <UButton
              v-if="isChatGenerating"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="solid"
              size="sm"
              @click="handleStop"
            />
            <UButton
              v-else
              icon="i-heroicons-paper-airplane"
              color="primary"
              variant="solid"
              size="sm"
              :loading="isChatGenerating"
              :disabled="!prompt.trim() || isRecording"
              @click="handleGenerate"
            />
          </div>
        </div>

        <!-- Metadata & Stats (Chat) -->
        <div class="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1">
           <div class="flex items-center gap-2">
              <span v-if="estimatedTokensValue">{{ t('llm.estimatedTokens', { count: estimatedTokensValue }) }}</span>
           </div>
           <div v-if="metadata" class="flex items-center gap-2">
              <span>{{ metadata.provider }} ({{ metadata.model_name }})</span>
           </div>
        </div>
      </template>

      <!-- STEP 2: FIELDS GENERATION -->
      <template v-else-if="step === 2">

        <div v-if="isExtracting" class="flex flex-col items-center justify-center py-12 space-y-4">
           <UiLoadingSpinner size="lg" color="primary" :label="t('llm.processingParameters')" centered />
           <UButton
             color="neutral"
             variant="outline"
             icon="i-heroicons-x-mark"
             @click="handleStop"
           >
             {{ t('common.cancel') }}
           </UButton>
        </div>
        
        <div v-else-if="fieldsResult" class="space-y-6 max-h-[60vh] overflow-y-auto pr-1">

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
                 <UInput v-if="pubSelectedFields.title" ref="step2TitleInputRef" v-model="fieldsResult.publication.title" class="bg-white dark:bg-gray-800 w-full" />
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
                       @click="removePubTag(tag)"
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
           <template v-for="ch in channelsWithPosts" :key="ch.channelId">
             <div
               v-if="postSelectedFields[ch.channelId] && (getPostResult(ch.channelId)?.tags?.length ?? 0) > 0"
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
                       @click="removePostTag(ch.channelId, tag)"
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
    </div>

    <template #footer>
      <div v-if="step === 1" class="flex justify-between w-full">
        <div>
          <UButton
            v-if="chatMessages.length > 0"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            @click="handleResetChat"
          >
            {{ t('llm.resetChat') }}
          </UButton>
        </div>
        <div class="flex gap-2">
           <UTooltip :text="hasContext ? t('llm.skipDescription') : t('llm.skipDisabledNoContext')">
             <UButton
              color="neutral"
              variant="soft"
              :disabled="!hasContext"
              @click="handleSkip"
            >
              {{ t('common.skip') }}
            </UButton>
           </UTooltip>
          <UTooltip :text="t('llm.nextDescription')">
            <UButton
              color="primary"
              class="min-w-[100px]"
              :disabled="!chatMessages.some(m => m.role === 'assistant')"
              @click="handleNext"
            >
              {{ t('common.next') }}
            </UButton>
          </UTooltip>
        </div>
      </div>

      <div v-else-if="step === 2 && !isExtracting" class="flex justify-between w-full">
         <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-left"
          @click="step = 1"
        >
          {{ t('common.back') }}
        </UButton>
        <UButton
          color="primary"
          class="min-w-[120px]"
          :disabled="isExtracting || !fieldsResult"
          :loading="isApplying"
          icon="i-heroicons-check"
          @click="handleInsert"
        >
          {{ isApplying ? t('llm.applying') : t('common.apply') }}
        </UButton>
      </div>
    </template>

    <UiConfirmModal
      v-if="isResetChatConfirmOpen"
      v-model:open="isResetChatConfirmOpen"
      :title="t('llm.resetChat')"
      :description="t('llm.resetChatConfirm')"
      :confirm-text="t('common.confirm')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      @confirm="confirmResetChat"
    />
  </UiAppModal>
</template>
