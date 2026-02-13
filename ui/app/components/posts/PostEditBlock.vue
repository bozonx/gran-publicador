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
import type { PostStatus } from '~/types/posts'
 
import { useSocialPosting } from '~/composables/useSocialPosting'
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import type { ProjectAuthorSignature } from '~/types/author-signatures'

import MetadataEditor from '~/components/common/MetadataEditor.vue'
import TiptapEditor from '~/components/editor/TiptapEditor.vue'
import { stripHtmlAndSpecialChars, isTextContentEmpty } from '~/utils/text'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { normalizeTags, parseTags } from '~/utils/tags'

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
const { user } = useAuth()
const { fetchByProject } = useAuthorSignatures()

const publicationContent = computed(() => props.publication?.content ?? '')
const publicationMedia = computed(() => props.publication?.media?.map(m => m.media).filter(Boolean) ?? [])

const projectId = computed(() => props.publication?.projectId ?? props.post?.channel?.projectId ?? '')

const projectSignatures = ref<ProjectAuthorSignature[]>([])

function coerceTagsToArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return normalizeTags(raw.map(tag => String(tag ?? '')))
  }

  if (typeof raw === 'string') {
    return normalizeTags(parseTags(raw))
  }

  return []
}

const isCollapsed = ref(!props.isCreating)
const isDeleting = ref(false)
const isPreviewModalOpen = ref(false)

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
    return coerceTagsToArray(props.post?.tags)
})

const formData = reactive({
  channelId: '', 
  tags: coerceTagsToArray(props.post?.tags), // Empty array means use publication tags
  scheduledAt: toDatetimeLocal(props.post?.scheduledAt),
  status: (props.post?.status || 'PENDING') as PostStatus,
  content: props.post?.content || '',
  meta: (props.post?.meta && typeof props.post.meta === 'string' ? JSON.parse(props.post.meta) : (props.post?.meta || {})) as Record<string, any>,
  authorSignature: props.post?.authorSignature || '',
  platformOptions: (props.post?.platformOptions ? (typeof props.post.platformOptions === 'string' ? JSON.parse(props.post.platformOptions) : props.post.platformOptions) : {}) as Record<string, any>
})

// Dirty state tracking
const dirtyState = props.autosave
  ? null
  : useFormDirtyState(formData, {
      enableNavigationGuard: true,
      enableBeforeUnload: true,
    })

const isDirty = computed(() => dirtyState?.isDirty.value ?? false)
const isLocked = computed(() => props.publication?.status === 'READY')
const saveOriginalState = () => dirtyState?.saveOriginalState()
const resetToOriginal = () => dirtyState?.resetToOriginal()

// Auto-save setup
const { saveStatus, saveError, isIndicatorVisible, indicatorStatus, syncBaseline, retrySave } = useAutosave({
  data: computed(() => formData),
  saveFn: async (data) => {
    if (!props.autosave || props.isCreating) return { saved: false, skipped: true }
    
    // Skip auto-save if invalid and NOT in PENDING status
    // For PENDING posts we allow saving even if constraints are violated (draft mode)
    // If it's already PUBLISHED or FAILED we are more strict, but usually those shouldn't be edited directly without republishing
    const canSaveAsInvalid = formData.status === 'PENDING'
    
    if (!validationResult.value.isValid && !canSaveAsInvalid) {
      return { saved: false, skipped: true }
    }

    await performSave()
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
  enableNavigationGuards: props.autosave,
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
            tags: formData.tags.length > 0 ? formData.tags : null,
            scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
            content: normalizedContent,
            meta: formData.meta,
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
          tags: formData.tags.length > 0 ? formData.tags : null,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
          content: normalizedContent,
          meta: formData.meta,
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
    if (!isPostContentOverride.value) return props.publication?.content || ''
    return formData.content
})
const displayAuthorSignature = computed(() => formData.authorSignature)
const displayTags = computed(() => {
    if (overriddenTags.value.length > 0) return overriddenTags.value
    return coerceTagsToArray(props.publication?.tags)
})
const hasActivatedPlatformOptions = computed(() => {
    if (!formData.platformOptions) return false
    return Object.values(formData.platformOptions).some(v => !!v)
})
const displayLanguage = computed(() => {
    // Priority: Channel language (since this block is for a post in a specific channel)
    return channelLanguage.value || publicationLanguage.value
})
const displayType = computed(() => props.post ? getPostType(props.post) : props.publication?.postType)

// Signature options filtered by channel language
const signatureOptions = computed(() => {
    if (!projectSignatures.value.length || !channelLanguage.value) {
        return []
    }

    return projectSignatures.value
        .map(sig => {
            // Find variant in channel language, fallback to first available
            const variant = sig.variants.find(v => v.language === channelLanguage.value)
                || sig.variants[0]

            if (!variant?.content) return null

            return {
                value: variant.content,
                label: variant.content,
                signatureId: sig.id
            }
        })
        .filter(Boolean) as { value: string; label: string; signatureId: string }[]
})

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

// Watchers for external updates
watch(() => props.post, (newPost, oldPost) => {
    if (!newPost) return

    // Only update if post actually changed (not just duplicate object reference or same timestamp)
    // Checking updatedAt is usually sufficient for backend updates
    if (oldPost && newPost.id === oldPost.id && newPost.updatedAt === oldPost.updatedAt) {
        return
    }

    formData.tags = coerceTagsToArray(newPost.tags)
    formData.scheduledAt = toDatetimeLocal(newPost.scheduledAt)
    formData.status = newPost.status
    formData.content = newPost.content || ''
    formData.meta = (newPost.meta && typeof newPost.meta === 'string' ? JSON.parse(newPost.meta) : (newPost.meta || {}))
    formData.authorSignature = newPost.authorSignature || ''
    formData.platformOptions = (newPost.platformOptions && typeof newPost.platformOptions === 'string' ? JSON.parse(newPost.platformOptions) : (newPost.platformOptions || {}))
    
    // Save original state after update
    nextTick(() => {
        saveOriginalState()
        if (props.autosave) {
            syncBaseline()
        }
    })
}, { deep: true, immediate: true })

// Load signatures when projectId changes
watch(projectId, async (newProjectId) => {
    if (newProjectId) {
        projectSignatures.value = await fetchByProject(newProjectId)
    } else {
        projectSignatures.value = []
    }
}, { immediate: true })

// Auto-select first signature when creating a new post
watch(signatureOptions, (newOptions) => {
    // Only auto-select if creating a new post and signature is not already set
    if (props.isCreating && !formData.authorSignature && newOptions.length > 0) {
        formData.authorSignature = newOptions[0].value
    }
}, { immediate: true })


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
    // When locked, we allow saving because all fields except allowed ones (like scheduledAt) are disabled
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
             <CommonSocialIcon 
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

                <!-- Platform Options Icon -->
                <UTooltip v-if="hasActivatedPlatformOptions" :text="t('post.platformOptionsActivated', 'Platform options activated')">
                   <UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4 text-primary-500" />
                </UTooltip>
            </div>
            
            <!-- Collapsed Preview info -->
            <div v-if="isCollapsed" class="space-y-1">
                <div v-if="displayTags.length > 0 || displayAuthorSignature" class="flex flex-wrap gap-1 items-center mt-1">

                     <!-- Author Signature -->
                     <UBadge
                        v-if="displayAuthorSignature"
                        variant="subtle"
                        color="neutral"
                        size="xs"
                        class="italic gap-1"
                     >
                        <UIcon name="i-heroicons-pencil" class="w-3 h-3" />
                        <span class="max-w-[150px] truncate">{{ displayAuthorSignature }}</span>
                     </UBadge>

                     <!-- Tags -->
                     <CommonTags
                       :tags="displayTags"
                       color="neutral"
                       variant="subtle"
                       size="xs"
                       badge-class="font-mono"
                     />
                </div>

                <!-- Content Preview -->
                <p v-if="displayContent" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1 px-0.5" :class="{ 'text-primary-600 dark:text-primary-400 font-medium bg-primary-50 dark:bg-primary-900/10 px-2 py-1 rounded border border-primary-100 dark:border-primary-800/20': isPostContentOverride }">
                    {{ stripHtmlAndSpecialChars(displayContent) }}
                </p>
            </div>
        </div>

        <!-- Expand/Collapse Button -->
        <div v-if="!isCreating" class="shrink-0 ml-2 flex items-center gap-1">
          <UTooltip :text="t('post.previewTitle', 'Post Preview')">
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-eye"
              @click.stop="isPreviewModalOpen = true"
            />
          </UTooltip>
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
                        <CommonSocialIcon 
                            :platform="item.socialMedia" 
                            size="xs" 
                            :problem-level="item.problemLevel"
                        />
                        <span class="truncate">{{ item.label }}</span>
                        <span class="ml-auto text-xs text-gray-500 uppercase">{{ item.language }}</span>
                    </div>
                </template>
            </USelectMenu>
        </div>

        <!-- Social Media Validation Warning (Global for entire post) -->
        <UAlert
          v-if="!validationResult.isValid"
          color="warning"
          variant="soft"
          class="mb-4"
          icon="i-heroicons-exclamation-triangle"
        >
          <template #title>
             <span>{{ t('validation.validationWarningTitle') }}</span>
          </template>
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

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Row 1: Author Signature (2/3) | Scheduled At (1/3) -->
                <UFormField :label="t('post.authorSignature', 'Author Signature')" class="md:col-span-2">
                    <div class="flex gap-2 items-end">
                        <UInput
                            v-model="formData.authorSignature"
                            :placeholder="t('post.authorSignaturePlaceholder', 'Enter author signature...')"
                            :disabled="isLoading || isLocked"
                            class="flex-1"
                        />
                        <USelectMenu
                            v-if="signatureOptions.length > 0"
                            :items="signatureOptions"
                            value-key="value"
                            label-key="label"
                            :placeholder="t('post.selectSignature', 'Select...')"
                            :disabled="isLoading || isLocked"
                            @update:model-value="formData.authorSignature = $event"
                        >
                            <UButton
                                icon="i-heroicons-pencil"
                                variant="outline"
                                color="neutral"
                                :disabled="isLoading || isLocked"
                            />
                        </USelectMenu>
                    </div>
                </UFormField>

                <UFormField :label="t('post.scheduledAt')" class="md:col-span-1">
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

                <!-- Row 2: Tags (2/3) | Platform Specific Options (1/3) -->
                <UFormField :label="t('post.tags')" class="md:col-span-2">
                    <CommonInputTags
                        v-model="formData.tags"
                        :placeholder="t('post.tagsPlaceholder')"
                        color="neutral"
                        variant="outline"
                        :disabled="isLocked"
                        :project-id="projectId"
                        :user-id="user?.id"
                        class="w-full"
                    />
                </UFormField>

                <div v-if="selectedChannel?.socialMedia === 'telegram'" class="md:col-span-1">
                    <UFormField :label="t('post.options.title', 'Platform Options')">
                        <div class="flex items-center gap-2 py-1">
                            <UCheckbox 
                                v-model="formData.platformOptions.disableNotification" 
                                :label="t('post.options.disableNotification')" 
                                :disabled="isLocked"
                            />
                        </div>
                    </UFormField>
                </div>
            </div>
       </div>
       
        <!-- Post Content (Override) -->
       <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('post.content') }}</span>
                <div class="flex items-center gap-2">
                    <UButton 
                        v-if="formData.content" 
                        variant="ghost" 
                        color="neutral" 
                        size="xs" 
                        icon="i-heroicons-x-mark"
                        :disabled="isLocked"
                        @click="formData.content = ''"
                    >
                        {{ t('common.reset') }}
                    </UButton>
                </div>
            </div>
            <TiptapEditor 
                v-model="formData.content" 
                :placeholder="t('post.contentOverridePlaceholder')"
                :min-height="150"
                :default-target-lang="channelLanguage"
                :project-id="projectId"
                :disabled="isLocked"
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
              :disabled="isLocked"
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
            
            <UiSaveStatusIndicator 
              v-if="autosave && !isCreating" 
              :status="indicatorStatus" 
              :visible="isIndicatorVisible"
              :error="saveError" 
              show-retry
              @retry="retrySave"
            />
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
          :disabled="isDeleting || isLocked"
        />
      </div>

    </div>

    <!-- Preview Modal -->
    <ModalsPostPreviewModal
      v-model="isPreviewModalOpen"
      :post="props.post"
      :publication="props.publication"
    />
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
