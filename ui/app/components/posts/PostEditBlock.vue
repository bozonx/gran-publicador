<script setup lang="ts">
import type { PostWithRelations } from '~/composables/usePosts'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { ChannelWithProject } from '~/composables/useChannels'
import { 
    usePosts, 
    getPostTitle, 
    getPostContent, 
    getPostTags, 
    getPostDescription,
    getPostType,
    getPostLanguage 
} from '~/composables/usePosts'
import type { ChannelPostTemplate } from '~/types/channels'
import { useSocialPosting } from '~/composables/useSocialPosting'
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'
import SocialIcon from '~/components/common/SocialIcon.vue'
import MetadataEditor from '~/components/common/MetadataEditor.vue'
import TiptapEditor from '~/components/editor/TiptapEditor.vue'
import { stripHtmlAndSpecialChars, isTextContentEmpty } from '~/utils/text'
import AuthorSignatureSelector from './AuthorSignatureSelector.vue'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'

interface Props {
  post?: PostWithRelations
  publication?: PublicationWithRelations
  availableChannels?: ChannelWithProject[]
  channels?: ChannelWithProject[]
  isCreating?: boolean
  /** Whether to enable auto-saving on changes (only for edit mode) */
  autosave?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['deleted', 'cancel', 'success'])

const saveButtonRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const { updatePost, deletePost, createPost, isLoading, statusOptions: postStatusOptions } = usePosts()
const { getStatusColor, getStatusDisplayName, getStatusIcon } = usePosts()
const { publishPost, isPublishing, canPublishPost } = useSocialPosting()
const { getPostProblemLevel } = usePublications()
const { getChannelProblemLevel } = useChannels()

const isCollapsed = ref(!props.isCreating)
const isDeleting = ref(false)

// Formatting date helper
const toDatetimeLocal = (dateStr?: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const formatPublishedAt = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString()
}

const headerDateInfo = computed(() => {
    if (props.post?.publishedAt) {
        return {
            date: formatPublishedAt(props.post.publishedAt),
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500', 
            tooltip: t('post.publishedAt')
        }
    }
    // Only show if overridden specifically on the post
    if (props.post?.scheduledAt) {
        return {
            date: formatPublishedAt(props.post.scheduledAt),
            icon: 'i-heroicons-clock',
            color: 'text-amber-500',
            tooltip: t('post.scheduledAt')
        }
    }
    return null
})

const overriddenTags = computed(() => {
    if (!props.post?.tags) return []
    return props.post.tags.split(',').filter(t => t.trim())
})

const currentTemplateName = computed(() => {
    const template = formData.template
    if (!template || !template.id) return null
    
    // Try to find name in available templates
    const found = availableTemplates.value.find(t => t.value?.id === template.id)
    if (found) {
        // Remove " (Default)" suffix if present for display in header
        return found.label.replace(/\s\(.*\)$/, '')
    }
    
    return null
})

const formData = reactive({
  channelId: '', 
  tags: props.post?.tags || '', // Null or empty means use publication tags
  scheduledAt: toDatetimeLocal(props.post?.scheduledAt),
  status: (props.post?.status || 'PENDING') as PostStatus,
  content: props.post?.content || '',
  meta: (props.post?.meta && typeof props.post.meta === 'string' ? JSON.parse(props.post.meta) : (props.post?.meta || {})) as Record<string, any>,
  template: (props.post?.template && typeof props.post.template === 'string' ? JSON.parse(props.post.template) : (props.post?.template || null)) as { id: string } | null,
  footerId: props.post?.footerId || null,
  authorSignature: props.post?.authorSignature || '',
  platformOptions: (props.post?.platformOptions ? (typeof props.post.platformOptions === 'string' ? JSON.parse(props.post.platformOptions) : props.post.platformOptions) : {}) as Record<string, any>
})

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(formData, {
    enableNavigationGuard: !props.autosave,
    enableBeforeUnload: !props.autosave
})

// Auto-save setup
const { saveStatus, saveError } = useAutosave({
  data: toRef(() => formData),
  saveFn: async (data) => {
    if (!props.autosave || props.isCreating) return
    
    // Only save if valid. If invalid, we skip auto-save to avoid corrupting data
    if (!validationResult.value.isValid) return

    await performSave()
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const channelOptions = computed(() => {
    return props.availableChannels?.map(c => ({
        value: c.id,
        label: c.name,
        socialMedia: c.socialMedia,
        language: c.language,
        problemLevel: getChannelProblemLevel(c)
    })) || []
})



const selectedChannel = computed(() => {
    if (props.isCreating) {
        return props.availableChannels?.find(c => c.id === formData.channelId)
    }
    // Try to find full channel object in props.channels
    if (props.channels && props.post?.channelId) {
        const pid = props.post.channelId
        const found = props.channels.find(c => c.id === pid)
        if (found) return found
    }
    return props.post?.channel
})

const publicationLanguage = computed(() => {
    return props.publication?.language || props.post?.publication?.language
})

const channelLanguage = computed(() => {
    return selectedChannel.value?.language
})

const hasLanguageMismatch = computed(() => {
    const pLang = publicationLanguage.value
    const cLang = channelLanguage.value
    if (!pLang || !cLang) return false
    
    // Normalize: lowercase, trim, and treat - and _ the same for comparison
    const normalize = (l: string) => l.toLowerCase().replace(/[-_]/g, '').trim()
    return normalize(pLang) !== normalize(cLang)
})

function toggleCollapse() {
  if (props.isCreating) return
  isCollapsed.value = !isCollapsed.value
}

const isDeleteModalOpen = ref(false)
const isRepublishModalOpen = ref(false)
const isArchiveWarningModalOpen = ref(false)
const showValidationWarning = ref(false)
const archiveWarningMessage = ref('')

async function handleSave() {
  if (!validationResult.value.isValid) {
    showValidationWarning.value = true
    return
  }
  await performSave()
}

async function performSave() {
  try {
    if (props.isCreating) {
        if (!formData.channelId || !props.publication) return 

        const normalizedContent = isTextContentEmpty(formData.content) ? null : formData.content

        const newPost = await createPost({
            channelId: formData.channelId,
            publicationId: props.publication.id,
            tags: formData.tags || null,
            scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
            content: normalizedContent,
            meta: formData.meta,
            template: formData.template,
            footerId: formData.footerId,
            authorSignature: formData.authorSignature || null,
            platformOptions: JSON.parse(JSON.stringify(formData.platformOptions))
        }, { silent: true })

        if (newPost) {
            saveButtonRef.value?.showSuccess()
            saveOriginalState() // Clear dirty state
            emit('success', newPost)
        } else {
            throw new Error('Failed to create post')
        }

    } else {
        if (!props.post) return

        const normalizedContent = isTextContentEmpty(formData.content) ? null : formData.content
        const updatedPost = await updatePost(props.post.id, {
          tags: formData.tags || null,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
          content: normalizedContent,
          meta: formData.meta,
          template: formData.template,
          footerId: formData.footerId,
          authorSignature: formData.authorSignature || null,
          platformOptions: JSON.parse(JSON.stringify(formData.platformOptions))
        }, { silent: true })

        if (!updatedPost) throw new Error('Failed to update post')

        saveButtonRef.value?.showSuccess()
        saveOriginalState() // Clear dirty state
        emit('success')
    }
  } catch (error) {
    saveButtonRef.value?.showError()
    const toast = useToast()
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error',
    })
  }
}

async function handleDelete() {
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (!props.post) return
  isDeleting.value = true
  const success = await deletePost(props.post.id)
  isDeleting.value = false
  isDeleteModalOpen.value = false
  
  if (success) {
    saveOriginalState() // Clear dirty state
    emit('deleted', props.post.id)
  }
}

// Accessors for inherited content
const displayTitle = computed(() => props.post ? getPostTitle(props.post) : props.publication?.title)
const isPostContentOverride = computed(() => !isTextContentEmpty(formData.content))
const displayContent = computed(() => {
    if (!isPostContentOverride.value) return props.publication?.content
    return formData.content
})
const displayDescription = computed(() => props.post ? getPostDescription(props.post) : props.publication?.description)
const displayLanguage = computed(() => {
    // Priority: Channel language (since this block is for a post in a specific channel)
    return channelLanguage.value || publicationLanguage.value
})
const displayType = computed(() => props.post ? getPostType(props.post) : props.publication?.postType)

// Social media validation
const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation()

const mediaCount = computed(() => {
    // If post specific media overrides exist we should use them, but currently we only have publication media
    // So we use publication media count.
    return props.publication?.media?.length || 0
})

const mediaArray = computed(() => {
    // Map publication media to validation format
    return props.publication?.media?.map(m => ({
        type: m.media?.type || 'UNKNOWN'
    })) || []
})

const validationResult = computed(() => {
    if (!selectedChannel.value?.socialMedia) {
        return { isValid: true, errors: [] }
    }
    
    // Use displayContent (effective content)
    const content = displayContent.value
    return validatePostContent(
        content,
        mediaCount.value,
        selectedChannel.value.socialMedia as any,
        mediaArray.value,
        displayType.value
    )
})

const contentLength = computed(() => {
    return getContentLength(displayContent.value)
})

const remainingCharacters = computed(() => {
    if (!selectedChannel.value?.socialMedia) return null
    
    return getRemainingCharacters(
        displayContent.value,
        mediaCount.value,
        selectedChannel.value.socialMedia as any
    )
})

const getChannelPreferences = (channel: any) => {
    if (!channel || !channel.preferences) return {}
    if (typeof channel.preferences === 'string') {
        try {
            return JSON.parse(channel.preferences)
        } catch (e) {
             // console.warn('Failed to parse channel preferences', e)
             return {}
        }
    }
    return channel.preferences
}

const availableTemplates = computed(() => {
    const channel = selectedChannel.value
    // Check if channel has preferences (type guard)
    // We must handle cases where preferences is a string (backend raw response)
    const preferences = getChannelPreferences(channel)
    
    if (!preferences?.templates) return []
    
    // Filter templates by post type (if specified in template)
    // If template has specific post type, it must match publication's post type
    // If template post type is null, it applies to all
    const publicationPostType = displayType.value
    
    const list = (preferences.templates || []).filter((t: any) => {
        // Filter by Post Type
        if (t.postType && t.postType !== publicationPostType) return false
        
        // Filter by Language? Usually not strictly enforced but good to consider
        // If template has specific language, maybe valid only if channel language matches?
        // For now, let's stick to post type filtering as primary
        
        return true
    }).map((template: any) => ({
        value: { id: template.id },
        label: template.name + (template.isDefault ? ` (${t('channel.templateIsDefault', 'Default')})` : '')
    }))

    // Find current default to show in label
    const defaultTemplate = (preferences.templates || []).find((t: any) => t.isDefault)
    const defaultLabel =  defaultTemplate ? `${t('channel.templateDefault', 'Default')} (currently '${defaultTemplate.name}')` : t('channel.templateDefault', 'Default (Auto)')

    // Add "Default" option at the top
    return [
        { value: null, label: defaultLabel },
        ...list
    ]
})

// Track previous template list to detect actual changes (not just recomputation)
const previousTemplateIds = ref<Set<string>>(new Set())

watch(availableTemplates, (newTemplates, oldTemplates) => {
    // If list is empty (loading or no channel), don't reset anything
    if (newTemplates.length === 0) return

    // Build set of current template IDs (excluding null/default option)
    const currentIds = new Set(
        newTemplates
            .filter(t => t.value && t.value.id)
            .map(t => t.value!.id)
    )

    // If this is the first run or the template list hasn't actually changed, skip
    // We update the tracking set but don't reset the form data
    if (previousTemplateIds.value.size === 0) {
        previousTemplateIds.value = currentIds
        return
    }

    // Check if the list actually changed (not just recomputed)
    const listsAreEqual = 
        currentIds.size === previousTemplateIds.value.size &&
        Array.from(currentIds).every(id => previousTemplateIds.value.has(id))

    if (listsAreEqual) {
        // List didn't change content-wise, just recomputed - don't reset
        return
    }

    // Update previous list
    previousTemplateIds.value = currentIds

    // User requested to mark problematic instead of resetting to null
    // So we don't automatically reset formData.template = null anymore
})

const availableFooters = computed(() => {
    const channel = selectedChannel.value
    const preferences = getChannelPreferences(channel)
    const footers = preferences?.footers || []
    
    // 1. Map existing footers
    const list = footers.map((f: any) => ({
        value: f.id,
        label: f.content.split('\n')[0].slice(0, 50) + (f.isDefault ? ` (${t('channel.footerDefault', 'Default')})` : '')
    }))

    // 2. Determine "Default" label based on template or channel default
    let effectiveDefaultLabel = t('channel.footerDefault', 'Default (Auto)')
    
    const currentTemplate = (preferences?.templates || []).find((t: any) => t.id === formData.template?.id)
    const footerBlock = currentTemplate?.template?.find((b: any) => b.enabled && b.insert === 'footer')
    
    if (footerBlock?.footerId) {
        const templateFooter = footers.find((f: any) => f.id === footerBlock.footerId)
        if (templateFooter) {
            effectiveDefaultLabel = `${t('channel.footerDefault', 'Default')} (Template: '${templateFooter.content.split('\n')[0].slice(0, 30)}...')`
        }
    } else {
        const defaultFooter = footers.find((f: any) => f.isDefault)
        if (defaultFooter) {
            effectiveDefaultLabel = `${t('channel.footerDefault', 'Default')} (Channel: '${defaultFooter.content.split('\n')[0].slice(0, 30)}...')`
        }
    }

    return [
        { value: null, label: effectiveDefaultLabel },
        { value: 'none', label: t('post.noneFooter', 'No footer') },
        ...list
    ]
})

const isTemplateMissing = computed(() => {
    if (!formData.template?.id) return false
    const preferences = getChannelPreferences(selectedChannel.value)
    if (!preferences?.templates) return true
    return !preferences.templates.some((t: any) => t.id === formData.template!.id)
})

const isFooterMissing = computed(() => {
    if (!formData.footerId || formData.footerId === 'none') return false
    const preferences = getChannelPreferences(selectedChannel.value)
    if (!preferences?.footers) return true
    return !preferences.footers.some((f: any) => f.id === formData.footerId)
})

// Watchers for external updates
watch(() => props.post, (newPost, oldPost) => {
    if (!newPost) return

    // Only update if post actually changed (not just duplicate object reference or same timestamp)
    // Checking updatedAt is usually sufficient for backend updates
    if (oldPost && newPost.id === oldPost.id && newPost.updatedAt === oldPost.updatedAt) {
        return
    }

    formData.tags = newPost.tags || ''
    formData.scheduledAt = toDatetimeLocal(newPost.scheduledAt)
    formData.status = newPost.status
    formData.content = newPost.content || ''
    formData.meta = (newPost.meta && typeof newPost.meta === 'string' ? JSON.parse(newPost.meta) : (newPost.meta || {}))
    formData.template = (newPost.template && typeof newPost.template === 'string' ? JSON.parse(newPost.template) : (newPost.template || null))
    formData.footerId = newPost.footerId || null
    formData.authorSignature = newPost.authorSignature || ''
    formData.platformOptions = (newPost.platformOptions && typeof newPost.platformOptions === 'string' ? JSON.parse(newPost.platformOptions) : (newPost.platformOptions || {}))
    
    // Save original state after update
    nextTick(() => {
        saveOriginalState()
    })
}, { deep: true, immediate: true })

// Auto-select default signature when channel is selected (only in creation mode)
watch(() => formData.channelId, async (newChannelId) => {
  if (props.isCreating && newChannelId && !formData.authorSignature) {
    const { fetchByChannel } = useAuthorSignatures()
    try {
      const signatures = await fetchByChannel(newChannelId)
      const defaultSig = signatures.find(s => s.isDefault)
      if (defaultSig) {
        formData.authorSignature = defaultSig.content
      }
    } catch (error) {
      // Silently fail - not critical
      console.warn('Failed to load default signature:', error)
    }
  }
})

onMounted(() => {
    if (props.isCreating) {
        const channels = props.availableChannels
        if (channels && channels.length === 1 && channels[0]) {
            formData.channelId = channels[0].id
        }
    }
    // Initialize dirty state tracking
    saveOriginalState()
})

const isSaveDisabled = computed(() => {
    if (props.isCreating) return !formData.channelId
    return false
})

async function handlePublishPost() {
  if (!props.post) return

  // Check for archive warnings
  let warning = ''
  const channel = selectedChannel.value as ChannelWithProject | undefined
  
  if (props.publication?.archivedAt) {
      warning = t('publication.archiveWarning.publication')
  } else if (channel?.archivedAt) {
      warning = t('publication.archiveWarning.channel', { name: channel.name })
  } else if (channel?.project?.archivedAt) {
      warning = t('publication.archiveWarning.project', { name: channel.project.name })
  } else if (channel?.isActive === false) {
      warning = t('publication.archiveWarning.inactiveChannel', { name: channel.name })
  }

  if (warning) {
      archiveWarningMessage.value = warning
      isArchiveWarningModalOpen.value = true
      return
  }

  // Check if already published or failed
  if (props.post.status === 'PUBLISHED' || props.post.status === 'FAILED') {
      isRepublishModalOpen.value = true
      return
  }
  
  await executePublish()
}

async function handleConfirmArchivePublish() {
    isArchiveWarningModalOpen.value = false
    
    // Proceed to Republish check
    if (props.post?.status === 'PUBLISHED' || props.post?.status === 'FAILED') {
        isRepublishModalOpen.value = true
        return
    }

    await executePublish()
}

async function handleConfirmRepublish() {
    isRepublishModalOpen.value = false
    await executePublish()
}

async function executePublish() {
  if (!props.post) return

  const toast = useToast()
  try {
    const result = await publishPost(props.post.id)
    
    if (result.success) {
      toast.add({
        title: t('common.success'),
        description: t('publication.publishSuccess'),
        color: 'success'
      })
    } else {
         let errorMsg = result.message || t('publication.publishError')
         if (result.data?.results?.[0]?.error) {
             errorMsg = result.data.results[0].error
         }
         
         toast.add({
            title: t('common.error'),
            description: errorMsg,
            color: 'error'
         })
    }

    // Always emit success to refresh the parent publication state 
    // (which includes current post status, errors and meta)
    emit('success')

  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('publication.publishError'),
      color: 'error'
    })
    // Also emit success on catch if something went wrong but backend might have saved some status
    emit('success')
  }
}

</script>

<template>
  <div 
    :id="post?.channelId ? `post-${post.channelId}` : undefined"
    class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden mb-4 shadow-sm"
    :class="{ 'ring-2 ring-primary-500/20': isCreating }"
  >
    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('post.deleteConfirm')"
      :description="t('archive.delete_permanent_warning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />

    <!-- Republish Confirmation Modal -->
    <UiConfirmModal
      v-model:open="isRepublishModalOpen"
      :title="t('publication.republishConfirm')"
      :description="props.post?.status === 'FAILED' ? t('publication.republishFailedWarning') : t('publication.republishPostWarning')"
      :confirm-text="t('publication.republish', 'Republish')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :loading="isPublishing"
      @confirm="handleConfirmRepublish"
    />

    <!-- Archive Warning Modal -->
    <UiConfirmModal
      v-model:open="isArchiveWarningModalOpen"
      :title="t('publication.archiveWarning.title')"
      :description="archiveWarningMessage + '\n\n' + t('publication.archiveWarning.confirm')"
      :confirm-text="t('publication.archiveWarning.publishAnyway')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :loading="isPublishing"
      @confirm="handleConfirmArchivePublish"
    />

    <!-- Header -->
    <div 
      class="p-4 transition-colors select-none"
      :class="[
        isCreating ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80'
      ]"
      @click="toggleCollapse"
    >
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <div class="mt-0.5 shrink-0">
             <SocialIcon 
              v-if="selectedChannel?.socialMedia" 
              :platform="selectedChannel.socialMedia" 
            />
            <UIcon v-else-if="isCreating" name="i-heroicons-plus-circle" class="w-5 h-5 text-primary-500" />
            <UIcon v-else name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
        </div>
        
        <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
                <!-- Channel Name or Title -->
                <span v-if="isCreating" class="font-medium text-gray-900 dark:text-white truncate">
                  {{ t('post.newPostInChannel', 'New post in channel') }}
                </span>
                <NuxtLink 
                    v-else-if="selectedChannel?.id"
                    :to="`/channels/${selectedChannel.id}`"
                    class="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1 group/link min-w-0"
                    :title="t('channel.viewChannel')"
                    @click.stop
                >
                    <span class="truncate">{{ props.post?.channel?.name || t('common.unknownChannel') }}</span>
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                </NuxtLink>
                <span v-else class="font-medium text-gray-900 dark:text-white truncate">
                    {{ props.post?.channel?.name || t('common.unknownChannel') }}
                </span>

                <!-- Language Code -->
                <UTooltip 
                    :text="hasLanguageMismatch ? t('post.languageMismatch', 'Channel language differs from publication') : ''"
                    v-if="!isCreating && displayLanguage"
                    :disabled="!hasLanguageMismatch"
                >
                    <UBadge 
                        variant="subtle" 
                        :color="hasLanguageMismatch ? 'warning' : 'neutral'" 
                        size="xs"
                        class="font-mono shrink-0 rounded-md gap-1"
                    >
                        <UIcon v-if="hasLanguageMismatch" name="i-heroicons-exclamation-triangle" class="w-3 h-3" />
                        {{ displayLanguage }}
                    </UBadge>
                </UTooltip>

                <!-- Status Display -->
                <UBadge 
                  v-if="!isCreating && props.post?.status && props.post.status !== 'PENDING'" 
                  :variant="props.post.status === 'FAILED' ? 'solid' : 'subtle'" 
                  :color="getStatusColor(props.post.status)" 
                  size="xs"
                  class="gap-1 px-2 py-0.5"
                >
                  <UIcon :name="getStatusIcon(props.post.status)" class="w-3.5 h-3.5" />
                  {{ getStatusDisplayName(props.post.status) }}
                </UBadge>

                <!-- Date Display -->
                <span v-if="!isCreating && headerDateInfo" class="text-xs font-medium flex items-center gap-1" :class="headerDateInfo.color">
                     <UIcon :name="headerDateInfo.icon" class="w-3.5 h-3.5" />
                     {{ headerDateInfo.date }}
                </span>


            </div>
            
            <!-- Template & Tags Info -->
            <div v-if="currentTemplateName || overriddenTags.length > 0" class="flex flex-wrap gap-1 items-center">
                 <!-- Template Name -->
                 <UBadge
                    v-if="currentTemplateName"
                    variant="subtle"
                    color="primary"
                    size="xs"
                    class="font-medium mr-1"
                 >
                    <UIcon name="i-heroicons-squares-2x2" class="w-3 h-3 mr-1" />
                    {{ currentTemplateName }}
                 </UBadge>

                 <!-- Overridden Tags -->
                 <UBadge 
                    v-for="tag in overriddenTags" 
                    :key="tag"
                    variant="subtle" 
                    color="neutral" 
                    size="xs"
                    class="font-mono"
                >
                    #{{ tag.trim() }}
                </UBadge>
            </div>

            <!-- Content Preview (Only if overridden for this post) -->
            <p v-if="isPostContentOverride" class="text-sm text-primary-600 dark:text-primary-400 font-medium line-clamp-2 mt-1 bg-primary-50 dark:bg-primary-900/10 px-2 py-1 rounded border border-primary-100 dark:border-primary-800/20">
                {{ stripHtmlAndSpecialChars(formData.content) }}
            </p>
        </div>

        <!-- Expand/Collapse Button -->
        <div class="shrink-0 ml-2" v-if="!isCreating">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            :icon="isCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
          />
        </div>
      </div>
    </div>

    <!-- Collapsible Content -->
    <div v-show="!isCollapsed" class="border-t border-gray-200 dark:border-gray-700/50 p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/20">
       
       <!-- Error Message -->
       <UAlert
          v-if="props.post?.errorMessage"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-circle"
          :title="t('common.error')"
          :description="props.post.errorMessage"
          class="mb-4"
       />
        <!-- Channel Selector (Only if Creating) -->
        <div v-if="isCreating" class="space-y-1">
            <div class="flex items-center gap-1 mb-1">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('post.selectChannel', 'Select Channel') }}</span>
                <span class="text-red-500">*</span>
            </div>
            <USelectMenu
                v-model="formData.channelId"
                :items="channelOptions"
                value-key="value"
                label-key="label"
                class="w-full"
                :placeholder="t('post.selectChannel', 'Select a channel...')"
            >
                <template #item="{ item }">
                    <div class="flex items-center gap-2 w-full">
                        <SocialIcon 
                            :platform="item.socialMedia" 
                            size="xs" 
                            :problem-level="item.problemLevel"
                        />
                        <span class="truncate">{{ item.label }}</span>
                        <span class="ml-auto text-xs text-gray-500 uppercase">{{ item.language }}</span>
                    </div>
                </template>
            </USelectMenu>
            <!-- Language Mismatch Warning (Create Mode) -->
            <div v-if="hasLanguageMismatch" class="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                {{ t('post.languageMismatchWarning', 'Warning: Channel language differs from publication language') }}
            </div>
        </div>

        <!-- Social Media Validation Warning (Global for entire post) -->
        <UAlert
          v-if="!validationResult.isValid"
          color="warning"
          variant="soft"
          class="mb-4"
          icon="i-heroicons-exclamation-triangle"
          :title="t('validation.validationWarningTitle')"
        >
          <template #description>
             <ul class="list-disc list-inside">
                <li v-for="(error, index) in validationResult.errors" :key="index">
                  {{ error.message }}
                </li>
             </ul>
             <p class="text-xs mt-2 opacity-80">
              {{ t('validation.failedStatusExplanation') }}
            </p>
             <p v-if="!isPostContentOverride" class="text-xs mt-2 italic text-warning-600 dark:text-warning-400">
               {{ t('validation.inheritedContentError', 'This error is from inherited publication content. Shorten the publication content or override it for this post.') }}
             </p>
          </template>
        </UAlert>



       <!-- Post-specific settings (Editable) -->
       <div class="space-y-6">
            <!-- General Override Hint -->
            <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20 rounded-lg p-4 flex gap-3">
                <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-500 shrink-0" />
                <p class="text-sm text-blue-700 dark:text-blue-300">
                    {{ t('post.overrideHint') }}
                </p>
            </div>

            <div class="flex flex-col md:flex-row gap-6">
                <!-- Column 1 (60%) -->
                <div class="w-full md:w-[60%] space-y-6">
                    <!-- Scheduled At (Custom for post) -->
                    <UFormField :label="t('post.scheduledAt')">
                        <UTooltip :text="props.publication?.archivedAt ? t('publication.archived_notice') : (!props.publication?.scheduledAt ? t('publication.status.publicationTimeRequired') : '')">
                            <UInput 
                                v-model="formData.scheduledAt" 
                                type="datetime-local" 
                                class="w-full" 
                                icon="i-heroicons-clock" 
                                :disabled="!props.publication?.scheduledAt || !!props.publication?.archivedAt"
                            />
                        </UTooltip>
                    </UFormField>

                    <!-- Tags (Override) -->
                    <UFormField :label="t('post.tags')">
                        <UInput 
                          v-model="formData.tags" 
                          :placeholder="t('post.tagsPlaceholder')" 
                          icon="i-heroicons-hashtag" 
                          class="w-full"
                        />
                    </UFormField>

                    <!-- Author Signature Editor -->
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {{ t('post.authorSignature', 'Author Signature') }}
                            </label>
                            <AuthorSignatureSelector
                                :channel-id="formData.channelId || props.post?.channelId || null"
                                :disabled="isLoading"
                                minimal
                                @select="(content) => formData.authorSignature = content"
                            />
                        </div>
                        <UTextarea
                            v-model="formData.authorSignature"
                            :placeholder="t('post.authorSignaturePlaceholder', 'Enter author signature...')"
                            :disabled="isLoading"
                            :rows="3"
                            class="w-full"
                        />
                    </div>
                </div>

                <!-- Column 2 (40%) -->
                <div class="w-full md:w-[40%] space-y-6">
                    <!-- Template Selector -->
                    <UFormField 
                        v-if="availableTemplates.length > 0"
                        :label="t('post.template')" 
                        :error="isTemplateMissing ? t('post.errorTemplateDeleted', 'Template was deleted, using system default') : undefined"
                    >
                        <USelectMenu
                            v-model="formData.template"
                            :items="availableTemplates"
                            value-key="value"
                            label-key="label"
                            class="w-full"
                            :placeholder="t('post.selectTemplate', 'Select template...')"
                            :color="isTemplateMissing ? 'warning' : 'neutral'"
                        >
                        </USelectMenu>
                    </UFormField>

                    <!-- Footer Selector -->
                    <UFormField 
                        v-if="availableFooters.length > 1"
                        :label="t('channel.footers', 'Footers')" 
                        :error="isFooterMissing ? t('post.errorFooterDeleted', 'Selected footer was deleted, it will be skipped') : undefined"
                    >
                        <USelectMenu
                            v-model="formData.footerId"
                            :items="availableFooters"
                            value-key="value"
                            label-key="label"
                            class="w-full"
                            :placeholder="t('post.selectFooter', 'Select footer...')"
                            :color="isFooterMissing ? 'warning' : 'neutral'"
                        >
                        </USelectMenu>
                    </UFormField>

                    <!-- Platform Specific Options -->
                    <div v-if="selectedChannel?.socialMedia === 'TELEGRAM'">
                        <UFormField :label="t('post.options.title', 'Platform Options')">
                            <div class="flex items-center gap-2 py-1">
                                <UCheckbox 
                                v-model="formData.platformOptions.disableNotification" 
                                :label="t('post.options.disableNotification')" 
                                />
                            </div>
                        </UFormField>
                    </div>
                </div>
            </div>
       </div>
       
       <!-- Post Content (Override) -->
       <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('post.content') }}</span>
                <UButton 
                    v-if="formData.content" 
                    variant="ghost" 
                    color="neutral" 
                    size="xs" 
                    icon="i-heroicons-x-mark"
                    @click="formData.content = ''"
                >
                    {{ t('common.reset') }}
                </UButton>
            </div>
            <TiptapEditor 
                v-model="formData.content" 
                :placeholder="t('post.contentOverridePlaceholder')"
                :min-height="150"
            />
            <div class="flex justify-between items-start text-xs text-gray-500 dark:text-gray-400">
               <span v-if="!formData.content" class="italic">
                   {{ t('post.contentInheritedFromPublication') }}
               </span>
               <span v-else></span> <!-- Spacer if no inheritance msg -->
               
               <!-- Character Counter -->
                 <span v-if="remainingCharacters !== null" class="flex items-center gap-1" :class="{ 'text-red-500 font-bold': remainingCharacters < 0 }">
                    <template v-if="remainingCharacters < 0">
                       <UIcon name="i-heroicons-exclamation-circle" class="w-3.5 h-3.5" />
                    </template>
                    {{ contentLength }} / {{ contentLength + remainingCharacters }}
                    ({{ remainingCharacters >= 0 ? '+' : '' }}{{ remainingCharacters }})
                </span>
            </div>
       </div>

      <!-- Actions -->
      <div class="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700/50 mt-4">
        
        <div class="flex items-center gap-3">
             <!-- Delete Button (Only if NOT creating) -->
            <UButton
              v-if="!isCreating"
              color="error"
              variant="outline"
              :loading="isDeleting"
              icon="i-heroicons-trash"
              @click="handleDelete"
            >
              {{ t('common.delete') }}
            </UButton>

             <!-- Reset Button & unsaved warning -->
             <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <div v-if="isDirty && !isCreating && !autosave" class="flex items-center gap-3">
                    <UButton
                        color="neutral"
                        variant="outline"
                        size="sm"
                        icon="i-heroicons-arrow-path"
                        @click="resetToOriginal"
                    >
                        {{ t('common.reset') }}
                    </UButton>
                     <span class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
                        {{ t('form.unsavedChanges', 'Unsaved changes') }}
                    </span>
                </div>
            </Transition>
        </div>

        <div class="flex items-center gap-3">
            <UButton
              v-if="isCreating"
              color="neutral"
              variant="ghost"
              @click="emit('cancel')"
            >
              {{ t('common.cancel') }}
            </UButton>
            
            <UTooltip 
              v-if="!isCreating" 
              :text="props.publication?.archivedAt ? t('publication.archived_notice') : (!canPublishPost(props.post, props.publication) ? (!validationResult.isValid ? t('publication.validation.fixMediaErrors') : t('publication.cannotPublish')) : '')"
            >
              <UButton
                :label="t('publication.publishNow')"
                icon="i-heroicons-paper-airplane"
                variant="soft"
                color="success"
                :disabled="!canPublishPost(props.post, props.publication)"
                :loading="isPublishing"
                @click="handlePublishPost"
              ></UButton>
            </UTooltip>

            <UiAutosaveStatus 
              v-if="autosave && !isCreating" 
              :status="saveStatus" 
              :error="saveError" 
            />
            <UiSaveButton
              v-else
              ref="saveButtonRef"
              :loading="isLoading"
              :disabled="isSaveDisabled"
              :label="isCreating ? t('common.create') : t('common.save')"
              @click="handleSave"
            />
        </div>
      </div>

      <!-- Validation Warning Modal -->
      <ModalsValidationWarningModal
        v-model:open="showValidationWarning"
        :errors="validationResult.errors.map(err => err.message)"
        entity-type="post"
        @confirm="performSave"
      />

      <!-- Meta Data YAML -->
      <!-- Meta Data YAML -->
      <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
        <MetadataEditor 
          v-model="formData.meta"
          :label="t('post.metadata', 'Metadata')"
          :disabled="isDeleting"
        />
      </div>

    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
