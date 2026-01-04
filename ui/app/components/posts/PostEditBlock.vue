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
import SocialIcon from '~/components/common/SocialIcon.vue'

interface Props {
  post?: PostWithRelations
  publication?: PublicationWithRelations
  availableChannels?: ChannelWithProject[]
  isCreating?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['deleted', 'cancel', 'success'])

const saveButtonRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const { updatePost, deletePost, createPost, isLoading, statusOptions: postStatusOptions } = usePosts()
const { getStatusColor, getStatusDisplayName } = usePosts()

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

// Form Data - Only post-specific fields
const formData = reactive({
  channelId: '', 
  tags: props.post?.tags || '', // Null or empty means use publication tags
  scheduledAt: toDatetimeLocal(props.post?.scheduledAt),
  status: (props.post?.status || 'PENDING') as PostStatus
})

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(formData)

const channelOptions = computed(() => {
    return props.availableChannels?.map(c => ({
        value: c.id,
        label: c.name,
        socialMedia: c.socialMedia,
        language: c.language
    })) || []
})

const selectedChannel = computed(() => {
    if (props.isCreating) {
        return props.availableChannels?.find(c => c.id === formData.channelId)
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
    if (!publicationLanguage.value || !channelLanguage.value) return false
    return publicationLanguage.value !== channelLanguage.value
})

function toggleCollapse() {
  if (props.isCreating) return
  isCollapsed.value = !isCollapsed.value
}

async function handleSave() {
  try {
    if (props.isCreating) {
        if (!formData.channelId || !props.publication) return 

        const newPost = await createPost({
            channelId: formData.channelId,
            publicationId: props.publication.id,
            tags: formData.tags || null,
            scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
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
        await updatePost(props.post.id, {
          tags: formData.tags || null,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
        }, { silent: true })
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
const displayContent = computed(() => props.post ? getPostContent(props.post) : props.publication?.content)
const displayDescription = computed(() => props.post ? getPostDescription(props.post) : props.publication?.description)
const displayLanguage = computed(() => props.post ? getPostLanguage(props.post) : props.publication?.language)
const displayType = computed(() => props.post ? getPostType(props.post) : props.publication?.postType)

// Watchers for external updates
watch(() => props.post, (newPost) => {
    if (!newPost) return
    formData.tags = newPost.tags || ''
    formData.scheduledAt = toDatetimeLocal(newPost.scheduledAt)
    formData.status = newPost.status
    
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
                <UBadge 
                  v-if="!isCreating && displayLanguage" 
                  variant="subtle" 
                  color="neutral" 
                  size="xs"
                  class="font-mono shrink-0 rounded-md"
                >
                  {{ displayLanguage }}
                </UBadge>

                <!-- Status Display -->
                <UBadge 
                  v-if="!isCreating && props.post?.status" 
                  variant="subtle" 
                  :color="getStatusColor(props.post.status)" 
                  size="xs"
                >
                  {{ getStatusDisplayName(props.post.status) }}
                </UBadge>

                <!-- Date Display -->
                <span v-if="!isCreating && headerDateInfo" class="text-xs font-medium flex items-center gap-1" :class="headerDateInfo.color">
                     <UIcon :name="headerDateInfo.icon" class="w-3.5 h-3.5" />
                     {{ headerDateInfo.date }}
                </span>

                <!-- Language Mismatch Warning (Edit Mode) -->
                <UTooltip 
                    v-if="!isCreating && hasLanguageMismatch" 
                    :text="t('post.languageMismatch', 'Channel language differs from publication')"
                >
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-500" />
                </UTooltip>
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
                        <SocialIcon :platform="item.socialMedia" size="xs" />
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

            <!-- Scheduled At -->
            <UFormField :label="t('post.scheduledAt')" :disabled="!!props.post?.publishedAt" :help="formData.scheduledAt ? t('post.scheduledAtHint', 'Specific time for this channel') : (props.publication?.scheduledAt ? t('post.inheritedTimeHint', 'Using time from publication: ') + formatPublishedAt(props.publication.scheduledAt) : '')">
                <UInput 
                  v-model="formData.scheduledAt" 
                  type="datetime-local" 
                  icon="i-heroicons-clock" 
                />
            </UFormField>

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

            <UiSaveButton
              ref="saveButtonRef"
              :loading="isLoading"
              :disabled="!isValid"
              :label="isCreating ? t('common.create') : t('common.save')"
              @click="handleSave"
            />
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
