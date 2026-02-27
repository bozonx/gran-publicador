<script setup lang="ts">
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import type { ApplyData, ChatMessage, LlmContextTag, PostChannelInfo } from '~/types/llm'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'
import LlmPromptTemplatePickerModal from '~/components/modals/LlmPromptTemplatePickerModal.vue'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import LlmContextPicker from '~/components/llm/LlmContextPicker.vue'
import LlmChatMessages from '~/components/llm/LlmChatMessages.vue'
import LlmChatInput from '~/components/llm/LlmChatInput.vue'
import LlmFieldsForm from '~/components/llm/LlmFieldsForm.vue'
import type { MediaItem } from '~/composables/useMedia'
import type { LlmPublicationFieldsResult, LlmPublicationFieldsPostResult, ChannelInfoForLlm } from '~/composables/useLlm'
import { LlmErrorType } from '~/composables/useLlm'
import {
  getAggregatedMaxTextLength,
  getAggregatedTagsConfig,
  getTagsLimitsByPlatform,
  getPostTypeConfig,
  type PostType,
  type SocialMedia,
} from '~/utils/socialMediaPlatforms'

interface Emits {
  (e: 'apply', data: ApplyData): void
  (e: 'close'): void
}

interface Props {
  publicationId: string
  content?: string
  title?: string
  media?: MediaItem[]
  projectId?: string
  publicationMeta?: Record<string, any>
  postType?: string
  publicationLanguage?: string
  postChannels?: PostChannelInfo[]
}

const { publicationId, content, title, media, projectId, publicationMeta, postType, publicationLanguage, postChannels } = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generatePublicationFields, isGenerating, estimateTokens, stop: stopLlm, error: llmError } = useLlm()
const { publicationLlmChat } = usePublications()
const { updatePublication } = usePublications()
const {
  isRecording,
  isTranscribing,
  error: sttError,
  recorderError: voiceError,
  start: startStt,
  stop: stopStt,
  cancel: cancelStt,
} = useStt()
const { user } = useAuth()

const isSttHovered = ref(false)

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
    const text = await stopStt()

    if (text) {
      if (prompt.value && !prompt.value.endsWith('\n')) {
        prompt.value += '\n\n'
      }
      prompt.value += text

      toast.add({
        title: t('llm.transcriptionSuccess', 'Transcription successful'),
        color: 'success',
      })
    } else if (sttError.value && sttError.value !== 'cancelled') {
      toast.add({
        title: t('llm.transcriptionError'),
        description: sttError.value ? t(`llm.${sttError.value}`, sttError.value) : t('llm.errorMessage'),
        color: 'error',
      })
    }

    return
  }

  const success = await startStt(user.value?.language)
  if (!success) {
    toast.add({
      title: t('llm.recordingError'),
      description: voiceError.value ? t(`llm.${voiceError.value}`, voiceError.value) : undefined,
      color: 'error',
    })
  }
}

function handleCancelStt() {
  cancelStt()
  isSttHovered.value = false
}

// Steps
const step = ref(1) // 1: AI Chat, 2: Parameter Generation

const chatMessages = ref<ChatMessage[]>([])
const prompt = ref('')

const api = useApi()
const activeChatController = ref<AbortController | null>(null)
const isChatGenerating = ref(false)
const isSkippingChat = ref(false)

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
  content: boolean
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

const isTemplatePickerOpen = ref(false)

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
  if (chatMessages.value.length > 0) return

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
const canSeeModelMetadata = computed(() => user.value?.isSuperAdmin === true)

// Token counter with debounce
const estimatedTokens = computed(() => {
  return estimateTokens(prompt.value + makeContextPromptBlock(contextTags.value))
})

const estimatedTokensValue = computed(() => Number(estimatedTokens.value) || 0)

// Initialize post selected fields when fieldsResult changes
function initPostSelectedFields() {
  const fields: Record<string, PostSelectedFields> = {}
  for (const ch of postChannels || []) {
    const hasChannelTags = Array.isArray(ch.tags) && ch.tags.length > 0
    fields[ch.channelId] = {
      tags: hasChannelTags,
      content: true,
    }
  }
  postSelectedFields.value = fields
}

// Load templates when modal opens
watch(isOpen, async (open) => {
  if (open) {
    const nextTags: LlmContextTag[] = []

    if (content?.trim() || title?.trim()) {
      const header = title?.trim() ? `# ${title.trim()}\n\n` : ''
      nextTags.push({
        id: 'content:1',
        label: t('llm.publicationBlock'),
        promptText: `<source_content>\n${header}${content?.trim() || ''}\n</source_content>`,
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

      // Restore context snapshot from the first message if available
      if (chatMessages.value.length > 0) {
        const firstMsg = chatMessages.value[0]
        const snapshot = firstMsg?.contextSnapshot
        if (Array.isArray(snapshot)) {
          contextTags.value.forEach(tag => {
            const saved = snapshot.find(s => s.id === tag.id)
            if (saved) {
              tag.enabled = saved.enabled ?? true
            } else if (chatMessages.value.length > 0) {
              // If there's a chat, any tag not in the first message's snapshot should be disabled
              tag.enabled = false
            }
          })
        }
      }
    }
  } else {
    // Reset form when modal closes
    step.value = 1
    isSkippingChat.value = false
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

  let response: any
  try {
    response = await publicationLlmChat(
      publicationId,
      {
        message,
        ...(isFirstMessage
          ? {
              context: {
                content: title?.trim() ? `# ${title.trim()}\n\n${content || ''}` : content,
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
  // Skip chat — show context selection next
  isSkippingChat.value = true
}

function handleConfirmSkipChat() {
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
  isSkippingChat.value = false
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
    const resolvedPostType = (postType || 'POST') as PostType
    const hasMedia = (media || []).length > 0

    const channelsForApi: ChannelInfoForLlm[] = (postChannels || []).map((ch) => {
      const platform = ch.socialMedia as SocialMedia | undefined
      const maxContentLength = platform
        ? (getPostTypeConfig(platform, resolvedPostType)?.content
            ? hasMedia
              ? getPostTypeConfig(platform, resolvedPostType)!.content.maxCaptionLength
              : getPostTypeConfig(platform, resolvedPostType)!.content.maxTextLength
            : undefined)
        : undefined

      return {
        channelId: ch.channelId,
        channelName: ch.channelName,
        socialMedia: ch.socialMedia,
        tags: ch.tags,
        maxContentLength,
      }
    })

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
      
      const normalizedPosts: LlmPublicationFieldsPostResult[] = [...(response.posts || [])]
      for (const ch of postChannels || []) {
        if (!normalizedPosts.some(p => p.channelId === ch.channelId)) {
          normalizedPosts.push({ channelId: ch.channelId, content: '', tags: [] })
        }
      }

      fieldsResult.value = {
        ...response,
        posts: normalizedPosts,
      }
    } else {
      const errType = llmError.value?.type
      const description =
        errType === LlmErrorType.RATE_LIMIT
          ? t('llm.rateLimitError', 'Too many requests. Please try again later.')
          : errType === LlmErrorType.TIMEOUT
            ? t('llm.timeoutError', 'Request timed out. Try reducing context or retry.')
            : errType === LlmErrorType.ABORTED
              ? t('llm.aborted', 'Request was stopped.')
              : errType === LlmErrorType.GATEWAY_ERROR
                ? t('llm.gatewayError', 'Service temporarily unavailable. Please retry.')
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

function setPostContentForChannel(channelId: string, content: string) {
  if (!fieldsResult.value) return

  let post = fieldsResult.value.posts.find(p => p.channelId === channelId)
  if (!post) {
    post = { channelId, content: '', tags: [] }
    fieldsResult.value.posts.push(post)
  }

  post.content = content
}

async function handleInsert() {
  if (!fieldsResult.value) return
  
  // Check if at least one field is selected
  const hasPubSelection = pubSelectedFields.title || pubSelectedFields.description || 
                           pubSelectedFields.tags || pubSelectedFields.content
  const hasPostSelection = Object.values(postSelectedFields.value).some(f => f.tags || f.content)
  
  if (!hasPubSelection && !hasPostSelection) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.noFieldsSelected'),
      color: 'error',
    })
    return
  }

  isApplying.value = true
  try {
    const postsToApply: ApplyData['posts'] = []
    
    for (const channelId in postSelectedFields.value) {
      const selection = postSelectedFields.value[channelId]
      if (selection.content || selection.tags) {
        const postRes = getPostResult(channelId)
        if (postRes) {
          postsToApply.push({
            channelId,
            content: selection.content ? postRes.content : undefined,
            tags: selection.tags ? postRes.tags : undefined,
          })
        }
      }
    }

    emit('apply', {
      publication: {
        title: pubSelectedFields.title ? fieldsResult.value.publication.title : undefined,
        description: pubSelectedFields.description ? fieldsResult.value.publication.description : undefined,
        tags: pubSelectedFields.tags ? fieldsResult.value.publication.tags : undefined,
        content: pubSelectedFields.content ? fieldsResult.value.publication.content : undefined,
      },
      posts: postsToApply,
      metadata: metadata.value,
      chat: {
        messages: chatMessages.value,
        model: metadata.value,
      },
    })
    
    isOpen.value = false
    emit('close')
  } finally {
    isApplying.value = false
  }
}

const isResetChatConfirmOpen = ref(false)

function handleResetChat() {
  isResetChatConfirmOpen.value = true
}

async function confirmResetChat() {
  chatMessages.value = []
  prompt.value = ''
  metadata.value = null
  
  const nextTags: LlmContextTag[] = []

  if (content?.trim() || title?.trim()) {
    const header = title?.trim() ? `# ${title.trim()}\n\n` : ''
    nextTags.push({
      id: 'content:1',
      label: t('llm.publicationBlock'),
      promptText: `<source_content>\n${header}${content?.trim() || ''}\n</source_content>`,
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
  <UiAppModal
    v-model:open="isOpen"
    :title="step === 1 ? t('llm.title') : t('llm.reviewTitle')"
    :description="step === 1 ? t('llm.description') : t('llm.reviewDescription')"
    size="xl"
    :prevent-close="isGenerating || isChatGenerating || isRecording || isTranscribing"
  >
    <div ref="modalRootRef" class="flex flex-col h-full overflow-hidden">
      <!-- STEP 1: CHAT / CONTEXT -->
      <template v-if="step === 1">
        <!-- Context Tags Display -->
        <LlmContextPicker
          v-model="contextTags"
          :disabled="isGenerating || isChatGenerating"
          :is-chat-empty="chatMessages.length === 0"
          @toggle="toggleContextTag"
        />

        <UAlert
          v-if="contextStats.isTruncated"
          color="warning"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="t('llm.contextTruncatedTitle', 'Context was truncated')"
          :description="t('llm.contextTruncatedDesc', { used: contextStats.usedChars, total: contextStats.totalChars, limit: contextStats.limitChars })"
          class="mb-4"
        />

        <!-- Chat Area (HIDDEN IF SKIPPING) -->
        <div 
          v-if="!isSkippingChat"
          ref="chatContainer"
          class="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700/50 rounded-lg bg-gray-50/50 dark:bg-gray-950 p-4"
        >
          <LlmChatMessages
            :messages="chatMessages"
            :is-generating="isChatGenerating"
            :get-context-tags-for-message="getContextTagsForMessage"
          />
        </div>

        <!-- SKIP CHAT VIEW -->
        <div v-else class="flex flex-col flex-1 min-h-[300px] space-y-4">
           <div class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 flex-1">
              <h3 class="text-sm font-medium mb-4 text-gray-700 dark:text-gray-300">{{ t('llm.context') }}</h3>
              <div class="flex flex-wrap gap-3">
                 <div
                   v-for="ctx in contextTags"
                   :key="ctx.id"
                   class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:border-primary transition-colors"
                   @click="toggleContextTag(ctx.id)"
                 >
                    <UCheckbox
                      :model-value="ctx.enabled"
                      hide-details
                      @click.stop
                      @update:model-value="toggleContextTag(ctx.id)"
                    />
                    <span class="text-sm">{{ ctx.label }}</span>
                 </div>
              </div>
           </div>
        </div>

        <!-- Template Picker (HIDDEN IF SKIPPING) -->
        <div v-if="!isSkippingChat" class="mb-4">
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

        <!-- Chat Input (HIDDEN IF SKIPPING) -->
        <LlmChatInput
          v-if="!isSkippingChat"
          v-model="prompt"
          :is-generating="isChatGenerating"
          :is-recording="isRecording"
          :is-transcribing="isTranscribing"
          :disabled="isGenerating"
          :estimated-tokens="estimatedTokensValue"
          @send="handleGenerate"
          @stop="handleStop"
          @voice="handleVoiceRecording"
          @cancel-voice="handleCancelStt"
        />

        <!-- Metadata & Stats (Chat) (HIDDEN IF SKIPPING) -->
        <div v-if="!isSkippingChat" class="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1">
           <div class="flex items-center gap-2">
              <span v-if="estimatedTokensValue">{{ t('llm.estimatedTokens', { count: estimatedTokensValue }) }}</span>
           </div>
           <div v-if="metadata && canSeeModelMetadata" class="flex items-center gap-2">
              <CommonAdminDebugInfo :data="metadata" placement="top-end" />
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
        
        <LlmFieldsForm
          v-else-if="fieldsResult"
          :fields-result="fieldsResult"
          :pub-selected-fields="pubSelectedFields"
          :post-selected-fields="postSelectedFields"
          :post-channels="postChannels || []"
          :publication-language="publicationLanguage || 'en-US'"
          @remove-pub-tag="removePubTag"
          @remove-post-tag="removePostTag"
          @update-post-content="setPostContentForChannel"
        />
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
        <div v-if="isSkippingChat" class="flex gap-2">
           <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-left"
            @click="isSkippingChat = false"
          >
            {{ t('common.back') }}
          </UButton>
          <UButton
            color="primary"
            class="min-w-[100px]"
            :disabled="!hasContext"
            @click="handleConfirmSkipChat"
          >
            {{ t('common.next') }}
          </UButton>
        </div>
        <div v-else class="flex gap-2">
           <UTooltip :text="hasContext ? t('llm.skipDescription') : t('llm.skipDisabledNoContext')">
             <UButton
              color="neutral"
              variant="soft"
              :disabled="!hasContext"
              @click="handleSkip"
            >
              {{ t('llm.skipChat') }}
            </UButton>
           </UTooltip>
          <UTooltip :text="t('llm.generateFieldsTooltip')">
            <UButton
              color="primary"
              class="min-w-[100px]"
              :disabled="!chatMessages.some(m => m.role === 'assistant')"
              @click="handleNext"
            >
              {{ t('llm.generateFields') }}
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
