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
import yaml from 'js-yaml'
import SocialIcon from '~/components/common/SocialIcon.vue'
import TiptapEditor from '~/components/editor/TiptapEditor.vue'
import { stripHtmlAndSpecialChars, isTextContentEmpty } from '~/utils/text'

interface Props {
  post?: PostWithRelations
  publication?: PublicationWithRelations
  availableChannels?: ChannelWithProject[]
  channels?: ChannelWithProject[]
  isCreating?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['deleted', 'cancel', 'success'])

const saveButtonRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const { updatePost, deletePost, createPost, isLoading, statusOptions: postStatusOptions } = usePosts()
const { getStatusColor, getStatusDisplayName, getStatusIcon } = usePosts()
const { publishPost, isPublishing, canPublishPost } = useSocialPosting()
const { getPostProblemLevel } = usePublications()

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
    const scheduledAt = props.post?.scheduledAt || props.publication?.scheduledAt
    if (scheduledAt) {
        return {
            date: formatPublishedAt(scheduledAt),
            icon: 'i-heroicons-clock',
            color: 'text-amber-500',
            tooltip: props.post?.scheduledAt ? t('post.scheduledAt') : t('post.inheritedScheduledAt', 'Scheduled (inherited from publication)')
        }
    }
    return null
})

const overriddenTags = computed(() => {
    if (!props.post?.tags) return []
    return props.post.tags.split(',').filter(t => t.trim())
})

const formData = reactive({
  channelId: '', 
  tags: props.post?.tags || '', // Null or empty means use publication tags
  scheduledAt: toDatetimeLocal(props.post?.scheduledAt),
  status: (props.post?.status || 'PENDING') as PostStatus,
  content: props.post?.content || '',
  meta: (props.post?.meta && typeof props.post.meta === 'string' ? JSON.parse(props.post.meta) : (props.post?.meta || {})) as Record<string, any>,
  template: (props.post?.template && typeof props.post.template === 'string' ? JSON.parse(props.post.template) : (props.post?.template || null)) as { id: string } | null,
  platformOptions: (props.post?.platformOptions ? (typeof props.post.platformOptions === 'string' ? JSON.parse(props.post.platformOptions) : props.post.platformOptions) : {}) as Record<string, any>
})

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(formData)

const channelOptions = computed(() => {
    return props.availableChannels?.map(c => ({
        value: c.id,
        label: c.name,
        socialMedia: c.socialMedia,
        language: c.language,
        problemLevel: getPostProblemLevel({ channel: c })
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

async function handleSave() {
  console.log('[PostEditBlock] handleSave formData:', JSON.parse(JSON.stringify(formData)))
  try {
    if (props.isCreating) {
        if (!formData.channelId || !props.publication) return 

        const newPost = await createPost({
            channelId: formData.channelId,
            publicationId: props.publication.id,
            tags: formData.tags || null,
            scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
            content: formData.content || null,
            meta: formData.meta,
            template: formData.template,
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
        const updatedPost = await updatePost(props.post.id, {
          tags: formData.tags || null,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
          content: formData.content || null,
          meta: formData.meta,
          template: formData.template,
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

const isDeleteModalOpen = ref(false)
const isRepublishModalOpen = ref(false)
const isArchiveWarningModalOpen = ref(false)
const archiveWarningMessage = ref('')

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
    return formData.content || props.publication?.content
})
const displayDescription = computed(() => props.post ? getPostDescription(props.post) : props.publication?.description)
const displayLanguage = computed(() => {
    // Priority: Channel language (since this block is for a post in a specific channel)
    return channelLanguage.value || publicationLanguage.value
})
const displayType = computed(() => props.post ? getPostType(props.post) : props.publication?.postType)

const availableTemplates = computed(() => {
    const channel = selectedChannel.value
    // Check if channel has preferences (type guard)
    if (!channel || !('preferences' in channel) || !(channel as ChannelWithProject).preferences?.templates) return []
    
    // Filter templates by post type (if specified in template)
    // If template has specific post type, it must match publication's post type
    // If template post type is null, it applies to all
    const publicationPostType = displayType.value
    
    const list = ((channel as ChannelWithProject).preferences?.templates || []).filter(t => {
        // Filter by Post Type
        if (t.postType && t.postType !== publicationPostType) return false
        
        // Filter by Language? Usually not strictly enforced but good to consider
        // If template has specific language, maybe valid only if channel language matches?
        // For now, let's stick to post type filtering as primary
        
        return true
    }).map(template => ({
        value: { id: template.id },
        label: template.name + (template.isDefault ? ` (${t('channel.templateIsDefault', 'Default')})` : '')
    }))

    // Find current default to show in label
    const defaultTemplate = ((channel as ChannelWithProject).preferences?.templates || []).find(t => t.isDefault)
    const defaultLabel =  defaultTemplate ? `${t('channel.templateDefault', 'Default')} (currently '${defaultTemplate.name}')` : t('channel.templateDefault', 'Default (Auto)')

    // Add "Default" option at the top
    return [
        { value: null, label: defaultLabel },
        ...list
    ]
})

// Auto-select logic?
watch(availableTemplates, (newTemplates) => {
    // If current selection is explicit ({id:...}) but not in list (deleted?), fallback to Default (null)
    const current = formData.template
    if (current && current.id) {
        const exists = newTemplates.some(t => t.value && t.value.id === current.id)
        if (!exists) {
            formData.template = null // Reset to default
        }
    }
}, { immediate: true })

// Watchers for external updates
watch(() => props.post, (newPost) => {
    if (!newPost) return
    formData.tags = newPost.tags || ''
    formData.scheduledAt = toDatetimeLocal(newPost.scheduledAt)
    formData.status = newPost.status
    formData.content = newPost.content || ''
    formData.meta = (newPost.meta && typeof newPost.meta === 'string' ? JSON.parse(newPost.meta) : (newPost.meta || {}))
    formData.template = (newPost.template && typeof newPost.template === 'string' ? JSON.parse(newPost.template) : (newPost.template || null))
    formData.platformOptions = (newPost.platformOptions && typeof newPost.platformOptions === 'string' ? JSON.parse(newPost.platformOptions) : (newPost.platformOptions || {}))
    
    // Save original state after update
    nextTick(() => {
        saveOriginalState()
    })
}, { deep: true, immediate: true })

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

const isValid = computed(() => {
    if (props.isCreating) return !!formData.channelId
    return true
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
      description: error.message || t('publication.publishError'),
      color: 'error'
    })
    // Also emit success on catch if something went wrong but backend might have saved some status
    emit('success')
  }
}
const metaYaml = computed(() => {
  if (!props.post?.meta) return null
  try {
    const metaObj = typeof props.post.meta === 'string' 
      ? JSON.parse(props.post.meta) 
      : props.post.meta
    
    if (Object.keys(metaObj).length === 0) return null
    return yaml.dump(metaObj)
  } catch (e) {
    console.error('Failed to dump meta to YAML', e)
    return typeof props.post.meta === 'string' ? props.post.meta : JSON.stringify(props.post.meta, null, 2)
  }
})
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden mb-4 shadow-sm"
       :class="{ 'ring-2 ring-primary-500/20': isCreating }">
    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('post.deleteConfirm') }}
            </h3>
          </div>

          <p class="text-gray-500 dark:text-gray-400 mb-6">
            {{ t('archive.delete_permanent_warning') }}
          </p>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isDeleteModalOpen = false"
            ></UButton>
            <UButton
              color="error"
              :label="t('common.delete')"
              :loading="isDeleting"
              @click="confirmDelete"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Republish Confirmation Modal -->
    <UModal v-model:open="isRepublishModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-warning-500 mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('publication.republishConfirm') }}
            </h3>
          </div>

          <p class="text-gray-500 dark:text-gray-400 mb-6">
            {{ props.post?.status === 'FAILED' ? t('publication.republishFailedWarning') : t('publication.republishPostWarning') }}
          </p>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isRepublishModalOpen = false"
            ></UButton>
            <UButton
              color="warning"
              :label="t('publication.republish', 'Republish')"
              :loading="isPublishing"
              @click="handleConfirmRepublish"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Archive Warning Modal -->
    <UModal v-model:open="isArchiveWarningModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 text-warning-500 mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6"></UIcon>
            <h3 class="text-lg font-medium">
              {{ t('publication.archiveWarning.title') }}
            </h3>
          </div>

          <p class="text-gray-500 dark:text-gray-400 mb-6 font-medium">
            {{ archiveWarningMessage }}
          </p>
          <p class="text-gray-500 dark:text-gray-400 mb-6">
            {{ t('publication.archiveWarning.confirm') }}
          </p>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('common.cancel')"
              @click="isArchiveWarningModalOpen = false"
            ></UButton>
            <UButton
              color="warning"
              :label="t('publication.archiveWarning.publishAnyway')"
              :loading="isPublishing"
              @click="handleConfirmArchivePublish"
            ></UButton>
          </div>
        </div>
      </template>
    </UModal>

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
                <span class="font-medium text-gray-900 dark:text-white truncate">
                  <template v-if="isCreating">
                      {{ t('post.newPostInChannel', 'New post in channel') }}
                  </template>
                  <template v-else>
                      {{ props.post?.channel?.name || t('common.unknownChannel') }}
                  </template>
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
            
            <!-- Overridden Tags -->
            <div v-if="overriddenTags.length > 0" class="flex flex-wrap gap-1">
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



       <!-- Post-specific settings (Editable) -->
       <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Tags (Override) -->
            <UFormField :label="t('post.tags')" :help="t('post.tagsOverrideHint')">
                <UInput 
                  v-model="formData.tags" 
                  :placeholder="t('post.tagsPlaceholder')" 
                  icon="i-heroicons-hashtag" 
                />
            </UFormField>

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

            <!-- Template Selector -->
            <UFormField :label="t('post.template')" v-if="availableTemplates.length > 0">
                <USelectMenu
                    v-model="formData.template"
                    :items="availableTemplates"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                    :placeholder="t('post.selectTemplate', 'Select template...')"
                >
                    <template #label>

                        <span v-if="formData.template" class="truncate" :class="{ 'text-red-500': !availableTemplates.find(t => t.value?.id === formData.template?.id) }">
                            <template v-if="availableTemplates.find(t => t.value?.id === formData.template?.id)">
                                {{ availableTemplates.find(t => t.value?.id === formData.template?.id)?.label }}
                            </template>
                            <template v-else>
                                {{ t('post.templateNotFound', 'Template Not Found') }}
                            </template>
                        </span>
                        <span v-else class="text-gray-500 truncate">
                             {{ availableTemplates.find(t => t.value === null)?.label || t('channel.templateDefault', 'Default (Auto)') }}
                        </span>
                    </template>
                </USelectMenu>
            </UFormField>


       </div>
       
       <!-- Platform Specific Options -->
       <div v-if="selectedChannel?.socialMedia === 'TELEGRAM'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField :label="t('post.options.title', 'Platform Options')">
                <div class="flex items-center gap-2 py-2">
                    <UCheckbox 
                      v-model="formData.platformOptions.disableNotification" 
                      :label="t('post.options.disableNotification')" 
                    />
                </div>
            </UFormField>
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
            <p v-if="!formData.content" class="text-xs text-gray-500 dark:text-gray-400 italic">
                {{ t('post.contentInheritedFromPublication') }}
            </p>
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
                <div v-if="isDirty && !isCreating" class="flex items-center gap-3">
                    <UButton
                        color="neutral"
                        variant="outline"
                        size="sm"
                        icon="i-heroicons-arrow-path"
                        @click="resetToOriginal"
                    >
                        {{ t('common.reset') }}
                    </UButton>
                     <span v-if="isDirty" class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
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
              :text="props.publication?.archivedAt ? t('publication.archived_notice') : (!canPublishPost(props.post, props.publication) ? t('publication.cannotPublish') : '')"
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
              ref="saveButtonRef"
              :loading="isLoading"
              :disabled="!isValid"
              :label="isCreating ? t('common.create') : t('common.save')"
              @click="handleSave"
            />
        </div>
      </div>

      <!-- Meta Data YAML -->
      <div v-if="metaYaml" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
        <div class="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
          {{ t('post.metadata', 'Metadata') }}
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 rounded-md p-4 overflow-x-auto border border-gray-200 dark:border-gray-700">
          <pre class="text-xs font-mono text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre">{{ metaYaml }}</pre>
        </div>
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
