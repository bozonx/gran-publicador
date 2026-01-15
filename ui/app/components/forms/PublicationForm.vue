<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { PostType, PublicationStatus } from '~/types/posts'
import { usePublicationFormState, usePublicationFormValidation } from '~/composables/usePublicationForm'
import { FORM_SPACING, FORM_STYLES, GRID_LAYOUTS } from '~/utils/design-tokens'
import { isTextContentEmpty } from '~/utils/text'
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'

interface Props {
  /** Project ID for fetching channels (optional for personal drafts) */
  projectId?: string | null
  /** Publication data for editing, null for creating new */
  publication?: PublicationWithRelations | null
}

interface Emits {
  (e: 'success', publicationId: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  projectId: null,
  publication: null,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { 
  createPublication, 
  updatePublication, 
  createPostsFromPublication, 
  isLoading, 
  fetchPublicationsByProject, 
  publications 
} = usePublications()
const { channels, fetchChannels } = useChannels()
const { projects, fetchProjects } = useProjects()
const { typeOptions } = usePosts()
const { languageOptions } = useLanguages()
const { validatePostContent } = useSocialMediaValidation()

// Form Initialization
const languageParam = route.query.language as string | undefined
const channelIdParam = route.query.channelId as string | undefined
const state = usePublicationFormState(props.publication, languageParam)
// Add project ID to state if we want to allow changing it
const currentProjectId = ref<string | null>(props.publication?.projectId || props.projectId || null)
const { schema } = usePublicationFormValidation(t)

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)
const showAdvancedFields = ref(false)
const linkedPublicationId = ref<string | undefined>(undefined)
const showValidationWarning = ref(false)
const pendingSubmitData = ref<any>(null)
const showLlmModal = ref(false)

const isEditMode = computed(() => !!props.publication?.id)
const hasMedia = computed(() => Array.isArray(props.publication?.media) && props.publication!.media.length > 0)
const isContentMissing = computed(() => isTextContentEmpty(state.content) && !hasMedia.value)

// Social Media Validation
const validationErrors = computed(() => {
    const errors: string[] = []
    const mediaCount = props.publication?.media?.length || 0
    const mediaArray = props.publication?.media?.map(m => ({ type: m.media?.type || 'UNKNOWN' })) || []
    const postType = state.postType

    // 1. Determine relevant channels
    // Creating: checking selected channelIds
    if (!isEditMode.value) {
        state.channelIds.forEach(id => {
            const channel = channels.value.find(c => c.id === id)
            if (channel && channel.socialMedia) {
                const result = validatePostContent(state.content, mediaCount, channel.socialMedia as any, mediaArray, postType)
                if (!result.isValid) {
                    result.errors.forEach(err => {
                        errors.push(`${channel.name}: ${err.message}`)
                    })
                }
            }
        })
    } 
    // Editing: checking existing posts that inherit content
    else if (props.publication?.posts) {
         props.publication.posts.forEach((post: any) => {
             // Check if post inherits content: null, undefined, or empty string.
             const isInherited = isTextContentEmpty(post.content); 
             const hasChannel = post.channel && post.channel.socialMedia;

             if (isInherited && hasChannel) {
                  const result = validatePostContent(state.content, mediaCount, post.channel.socialMedia as any, mediaArray, postType)
                  
                  if (!result.isValid) {
                     result.errors.forEach(err => {
                         errors.push(`${post.channel.name}: ${err.message}`)
                     })
                  }
             }
         })
    }

    return errors
})

const isValid = computed(() => validationErrors.value.length === 0)


// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state)

onMounted(async () => {
    // If we have any project ID (from props or from existing publication), load its data
    if (currentProjectId.value) {
        await loadProjectData(currentProjectId.value)
    }

    if (projects.value.length === 0) {
        await fetchProjects()
    }

    // Auto-select channel if channelId parameter is provided
    if (channelIdParam && !isEditMode.value) {
      const selectedChannel = channels.value.find(ch => ch.id === channelIdParam)
      if (selectedChannel) {
        state.channelIds = [channelIdParam]
        state.language = selectedChannel.language
      }
    } else if (languageParam && !isEditMode.value) {
      state.channelIds = channels.value
        .filter(ch => ch.language === languageParam)
        .map(ch => ch.id)
    }
    
    nextTick(() => saveOriginalState())
})

async function loadProjectData(id: string) {
    await Promise.all([
      fetchChannels({ projectId: id }),
      fetchPublicationsByProject(id, { limit: 50 })
    ])
}

const activeProjectsOptions = computed(() => {
    return [
        { value: null, label: t('publication.personal_draft') },
        ...projects.value
            .filter(p => !p.archivedAt)
            .map(p => ({
                value: p.id,
                label: p.name
            }))
    ]
})

// Watch for project change to load new channels
watch(currentProjectId, async (newId) => {
    if (newId) {
        await loadProjectData(newId)
    } else {
        channels.value = []
        state.channelIds = []
        // Personal drafts cannot be scheduled
        if (state.status === 'SCHEDULED') {
            state.status = 'DRAFT'
        }
        state.scheduledAt = ''
    }
})

// Watch for external publication updates (e.g. from modals)
watch(() => props.publication, (newPub) => {
  if (newPub) {
    state.title = newPub.title || ''
    state.content = newPub.content || ''
    state.tags = newPub.tags || ''
    state.postType = newPub.postType as PostType
    state.status = (newPub.status || 'DRAFT') as PublicationStatus
    state.language = newPub.language || 'en-US'
    state.description = newPub.description || ''
    state.authorComment = newPub.authorComment || ''
    state.note = newPub.note || ''
    state.scheduledAt = newPub.scheduledAt ? new Date(newPub.scheduledAt).toISOString().slice(0, 16) : ''
    state.postDate = newPub.postDate ? new Date(newPub.postDate).toISOString().slice(0, 16) : ''
    state.translationGroupId = newPub.translationGroupId || undefined
    
    if (newPub.sourceTexts) {
        state.sourceTexts = newPub.sourceTexts.map((st: any, i: number) => ({
            ...st,
            order: typeof st.order === 'number' ? st.order : i
        }))
    }
    
    // Reset baseline for dirty tracking AFTER updating state
    nextTick(() => saveOriginalState())
  }
}, { deep: true })

// Linking logic
const availablePublications = computed(() => {
    return publications.value
        .filter(p => p.id !== props.publication?.id && p.postType === state.postType)
        .map(p => ({
            value: p.id,
            label: p.title ? `${p.title} (${p.language})` : `Untitled (${p.language}) - ${new Date(p.createdAt).toLocaleDateString()}`,
        }))
})

function handleTranslationLink(publicationId: string) {
    linkedPublicationId.value = publicationId
    state.translationGroupId = undefined
}

function handleUnlink() {
    state.translationGroupId = null
    linkedPublicationId.value = undefined
}

/**
 * Handle form submission
 */
async function handleSubmit(event: FormSubmitEvent<any>) {
  // If there are validation errors, show warning modal
  if (!isValid.value) {
      pendingSubmitData.value = event.data
      showValidationWarning.value = true
      return
  }

  await performSubmit(event.data)
}

/**
 * Perform actual submission (called directly or after warning confirmation)
 */
async function performSubmit(data: any) {
  try {
    const commonData = {
      title: data.title || null,
      description: data.description || null,
      content: isTextContentEmpty(data.content) ? null : (data.content || null),
      authorComment: data.authorComment || null,
      note: data.note || null,
      tags: data.tags || null,
      language: data.language,
      postType: data.postType,
      meta: data.meta || {},
      postDate: data.postDate ? new Date(data.postDate).toISOString() : null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      sourceTexts: data.sourceTexts || [],
    }

    let publicationId = props.publication?.id

    if (isEditMode.value && publicationId) {
      await updatePublication(publicationId, {
        ...commonData,
        // Status is managed by separate actions in edit mode, don't send it back 
        // to avoid validation errors for system-managed statuses (e.g. PUBLISHED)
        status: undefined,
        projectId: currentProjectId.value || null,
        linkToPublicationId: linkedPublicationId.value || undefined,
        translationGroupId: state.translationGroupId === null ? null : undefined,
      })
      
      const originalChannelIds = props.publication?.posts?.map((p: any) => p.channelId) || []
      const newChannelIds = state.channelIds.filter(id => !originalChannelIds.includes(id))
      
      if (newChannelIds.length > 0) {
          await createPostsFromPublication(
              publicationId, 
              newChannelIds, 
              data.status === 'SCHEDULED' ? data.scheduledAt : undefined
          )
      }
    } else {
      const createData = {
        ...commonData,
        projectId: currentProjectId.value || undefined,
        status: data.status === 'SCHEDULED' && (!currentProjectId.value || state.channelIds.length === 0) ? 'DRAFT' : data.status,
        linkToPublicationId: linkedPublicationId.value || undefined,
      }

      const pub = await createPublication(createData)
      if (!pub) throw new Error('Failed to create publication')
      publicationId = pub.id

      if (state.channelIds.length > 0) {
        await createPostsFromPublication(
          publicationId, 
          state.channelIds, 
          data.status === 'SCHEDULED' ? data.scheduledAt : undefined
        )
      }
    }

    formActionsRef.value?.showSuccess()
    emit('success', publicationId)
    saveOriginalState()
  } catch (error: any) {
    console.error('Publication save error:', error)
    formActionsRef.value?.showError()
    toast.add({
      title: t('common.error'),
      description: error.message || t('common.saveError'),
      color: 'error'
    })
  }
}

function handleValidationWarningConfirm() {
  if (pendingSubmitData.value) {
    performSubmit(pendingSubmitData.value)
    pendingSubmitData.value = null
  }
}

function handleValidationWarningCancel() {
  pendingSubmitData.value = null
}

function handleError(event: any) {
    const advancedFields = ['description', 'authorComment', 'note', 'postDate', 'meta']
    if (event.errors.some((e: any) => advancedFields.includes(e.path))) {
        showAdvancedFields.value = true
    }
    toast.add({
        title: t('common.error'),
        description: t('validation.checkFormErrors'),
        color: 'error'
    })
    formActionsRef.value?.showError()
}

function handleReset() {
  resetToOriginal()
}

const isSourceTextsOpen = ref(false)
const isAddingSourceText = ref(false)
const newSourceTextContent = ref('')
const editingSourceTextIndex = ref<number | null>(null)
const editingSourceTextContent = ref('')

// Translation Logic
const isTranslateModalOpen = ref(false)
const translationSourceText = ref('')

function handleOpenTranslateModal(text: string) {
    translationSourceText.value = text
    isTranslateModalOpen.value = true
}

function handleTranslated(result: { translatedText: string; action: 'insert' | 'add' }) {
    if (result.action === 'insert') {
        state.content = result.translatedText
    } else {
        if (!state.sourceTexts) state.sourceTexts = []
        state.sourceTexts.push({
            content: result.translatedText,
            source: 'translation',
            order: state.sourceTexts.length
        })
    }
}

function handleAddSourceText() {
    if (!newSourceTextContent.value.trim()) return
    if (!state.sourceTexts) state.sourceTexts = []
    
    state.sourceTexts.push({
        content: newSourceTextContent.value,
        source: 'manual',
        order: state.sourceTexts.length
    })
    newSourceTextContent.value = ''
    isAddingSourceText.value = false
    isSourceTextsOpen.value = true // Ensure list is visible
}

function handleStartEditingSourceText(index: number) {
    if (!state.sourceTexts) return
    editingSourceTextIndex.value = index
    editingSourceTextContent.value = state.sourceTexts[index].content
}

function handleSaveEditingSourceText() {
    if (editingSourceTextIndex.value === null || !state.sourceTexts) return
    state.sourceTexts[editingSourceTextIndex.value].content = editingSourceTextContent.value
    editingSourceTextIndex.value = null
    editingSourceTextContent.value = ''
}

function handleCancelEditingSourceText() {
    editingSourceTextIndex.value = null
    editingSourceTextContent.value = ''
}

function handleDeleteSourceText(index: number) {
    if (!state.sourceTexts) return
    const newList = [...state.sourceTexts]
    newList.splice(index, 1)
    state.sourceTexts = newList
}

function handleDeleteAllSourceTexts() {
    state.sourceTexts = []
    isSourceTextsOpen.value = false
}

function handleInsertLlmContent(content: string) {
    state.content = content
    showLlmModal.value = false
}
</script>

<template>
    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit" @error="handleError">
      
      <!-- Project Selection -->
      <UFormField :label="t('project.title')" :help="t('publication.projectSelectorHelp')">
        <USelectMenu
          v-model="currentProjectId"
          :items="activeProjectsOptions"
          value-key="value"
          label-key="label"
          class="w-full"
          :placeholder="t('project.selectProject')"
        >
          <template #leading>
            <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
          </template>
        </USelectMenu>
      </UFormField>

      <!-- Channels Selection Section -->
      <div v-if="currentProjectId">
        <UFormField name="channelIds" :help="t('publication.channelsHelp')">
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('channel.titlePlural') }}</span>
              <CommonInfoTooltip :text="t('publication.channelsTooltip')" />
            </div>
          </template>
            <FormsPublicationChannelSelector 
              v-model="state.channelIds"
              :channels="channels"
              :current-language="state.language"
            />
        </UFormField>
      </div>

      <div :class="GRID_LAYOUTS.twoColumn">
        <!-- Status (Only when creating) -->
        <UFormField v-if="!isEditMode" name="status" required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.statusLabel') }}</span>
              <CommonInfoTooltip :text="t('post.statusTooltip')" />
            </div>
          </template>
          <FormsPublicationStatusSelector 
            v-model="state.status"
            :is-content-missing="isContentMissing"
            :is-personal="!currentProjectId"
          />
        </UFormField>

        <!-- Scheduling -->
        <UFormField v-if="state.status === 'SCHEDULED'" name="scheduledAt" :label="t('post.scheduledAt')" required>
          <UInput v-model="state.scheduledAt" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
        </UFormField>

        <!-- Language -->
        <UFormField v-if="!isEditMode" name="language" required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('common.language') }}</span>
              <CommonInfoTooltip :text="t('common.languageTooltip')" />
            </div>
          </template>
          <USelectMenu
            v-model="state.language"
            :items="languageOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-language"
          />
        </UFormField>

        <!-- Post Type -->
        <UFormField v-if="!isEditMode" name="postType" required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.postType') }}</span>
              <CommonInfoTooltip :text="t('post.postTypeTooltip')" />
            </div>
          </template>
          <USelectMenu
            v-model="state.postType"
            :items="typeOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-information-circle"
          />
        </UFormField>
      </div>

      <!-- Main Content Section -->
      <UFormField name="title" :help="t('common.optional')">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('post.postTitle') }}</span>
            <CommonInfoTooltip :text="t('post.postTitleTooltip')" />
          </div>
        </template>
        <UInput
          v-model="state.title"
          :placeholder="t('post.titlePlaceholder')"
          :size="FORM_STYLES.inputSizeLarge"
          class="w-full"
        />
      </UFormField>

      <!-- Description for ARTICLE -->
      <UFormField v-if="state.postType === 'ARTICLE'" name="description" :help="t('post.descriptionPlaceholder')">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('post.description') }}</span>
            <CommonInfoTooltip :text="t('post.descriptionTooltip')" />
          </div>
        </template>
        <UTextarea v-model="state.description" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" />
      </UFormField>

      <UFormField name="content">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('post.content') }}</span>
            <CommonInfoTooltip :text="t('post.contentTooltip')" />
            <UTooltip :text="t('llm.tooltip')">
              <UButton
                icon="i-heroicons-sparkles"
                color="primary"
                variant="ghost"
                size="xs"
                @click="showLlmModal = true"
              />
            </UTooltip>
          </div>
        </template>
        
        <UAlert
          v-if="isContentMissing"
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          :title="t('publication.validation.contentOrMediaRequired')"
          class="mb-3"
        />

        <UAlert v-if="validationErrors.length > 0" color="warning" variant="soft" icon="i-heroicons-exclamation-triangle" title="Validation Warning" class="mb-3">
            <template #title>
              <span>{{ t('validation.validationWarningTitle') }}</span>
            </template>
            <ul class="list-disc list-inside text-sm mt-1">
                <li v-for="(err, index) in validationErrors" :key="index">
                    {{ err }}
                </li>
            </ul>
            <p class="text-xs mt-2 opacity-80">
              {{ t('validation.failedStatusExplanation') }}
            </p>
        </UAlert>

        <EditorTiptapEditor
          v-model="state.content"
          :placeholder="t('post.contentPlaceholder')"
          :min-height="250"
        />
      </UFormField>

      <!-- Author Comment for NEWS -->
      <UFormField v-if="state.postType === 'NEWS'" name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
        <UTextarea v-model="state.authorComment" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" :placeholder="t('post.authorCommentPlaceholder')" />
      </UFormField>

      <!-- Source Texts Section -->
      <!-- Source Texts Section -->
      <div class="mb-6 ml-1">
            <div class="flex items-center gap-2 mb-2">
                <UButton
                    variant="ghost"
                    color="primary"
                    size="sm"
                    :icon="isSourceTextsOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    @click="isSourceTextsOpen = !isSourceTextsOpen"
                >
                    {{ isSourceTextsOpen ? t('sourceTexts.hide') : t('sourceTexts.view') }} ({{ state.sourceTexts?.length || 0 }})
                </UButton>
                
                <UButton
                    v-if="!isAddingSourceText"
                    variant="soft"
                    color="primary"
                    size="xs"
                    icon="i-heroicons-plus"
                    :label="t('sourceTexts.add', 'Add Source Text')"
                    @click="isAddingSourceText = true"
                />
            </div>

            <!-- Add New Source Text Form -->
            <div v-if="isAddingSourceText" class="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
                 <UTextarea
                    v-model="newSourceTextContent"
                    :placeholder="t('sourceTexts.placeholder', 'Enter source text here...')"
                    autoresize
                    :rows="3"
                    class="w-full mb-2"
                 />
                 <div class="flex justify-end gap-2">
                     <UButton
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :label="t('common.cancel')"
                        @click="isAddingSourceText = false"
                     />
                     <UButton
                        color="primary"
                        size="sm"
                        :label="t('common.add')"
                        :disabled="!newSourceTextContent.trim()"
                        @click="handleAddSourceText"
                     />
                 </div>
            </div>

            <div v-if="isSourceTextsOpen && state.sourceTexts && state.sourceTexts.length > 0" class="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
                <div class="flex justify-end">
                    <UButton
                        color="error"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-trash"
                        @click="handleDeleteAllSourceTexts"
                    >
                        {{ t('sourceTexts.deleteAll') }}
                    </UButton>
                </div>

                <div v-for="(item, index) in state.sourceTexts" :key="index" class="p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 text-sm group hover:border-primary-200 dark:hover:border-primary-800/50 transition-colors">
                    
                    <!-- View Mode -->
                    <div v-if="editingSourceTextIndex !== index">
                        <div class="flex justify-between items-start gap-3">
                            <div class="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300 leading-relaxed font-normal">{{ item.content }}</div>
                            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <UButton
                                    color="primary"
                                    variant="ghost"
                                    size="xs"
                                    icon="i-heroicons-pencil-square"
                                    @click="handleStartEditingSourceText(index)"
                                />
                                <UButton
                                    color="primary"
                                    variant="ghost"
                                    size="xs"
                                    icon="i-heroicons-language"
                                    :title="t('sourceTexts.translate')"
                                    @click="handleOpenTranslateModal(item.content)"
                                />
                                <UButton
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    icon="i-heroicons-trash"
                                    @click="handleDeleteSourceText(index)"
                                />
                            </div>
                        </div>
                        <div v-if="item.source && item.source !== 'manual'" class="mt-2 text-xs text-gray-400 font-mono flex items-center gap-1">
                            <UIcon name="i-heroicons-link" class="w-3 h-3" />
                            {{ item.source }}
                        </div>
                    </div>

                    <!-- Edit Mode -->
                    <div v-else>
                        <UTextarea
                            v-model="editingSourceTextContent"
                            autoresize
                            :rows="3"
                            class="w-full mb-2"
                        />
                        <div class="flex justify-end gap-2">
                             <UButton
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                :label="t('common.cancel')"
                                @click="handleCancelEditingSourceText"
                             />
                             <UButton
                                color="primary"
                                size="xs"
                                :label="t('common.save')"
                                @click="handleSaveEditingSourceText"
                             />
                        </div>
                    </div>

                </div>
            </div>
      </div>

      
      <UFormField name="tags" :label="t('post.tags')" :help="t('post.tagsHint')">
        <UInput
            v-model="state.tags"
            :placeholder="t('post.tagsPlaceholder')"
            class="w-full"
            icon="i-heroicons-hashtag"
        />
      </UFormField>

      <!-- Post Date for ARTICLE -->
      <UFormField v-if="state.postType === 'ARTICLE'" name="postDate" :label="t('post.postDate')" :help="t('post.postDateHint')">
        <UInput v-model="state.postDate" type="datetime-local" class="w-full" icon="i-heroicons-calendar" />
      </UFormField>

      <!-- Linking Section -->
      <UFormField name="translationGroupId" :help="t('publication.linkTranslationHelp')">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('publication.linkTranslation') }}</span>
            <CommonInfoTooltip :text="t('publication.linkTranslationTooltip')" />
          </div>
        </template>
        <div class="flex gap-2">
            <USelectMenu
                :model-value="linkedPublicationId"
                :items="availablePublications"
                value-key="value"
                label-key="label"
                searchable
                :placeholder="state.translationGroupId ? t('publication.linked') : t('publication.selectToLink')"
                class="flex-1"
                @update:model-value="handleTranslationLink"
            />
            <UTooltip v-if="state.translationGroupId || linkedPublicationId" :text="t('publication.unlink')">
              <UButton
                icon="i-heroicons-link-slash"
                color="neutral"
                variant="soft"
                @click="handleUnlink"
              />
            </UTooltip>
        </div>
        
        <!-- Display Current Group Info -->
        <div v-if="publication?.translations?.length" class="mt-2 text-sm text-gray-500">
            <span class="font-medium mr-1">{{ t('publication.currentTranslations') }}</span>
            <div class="flex flex-wrap gap-1 mt-1">
                <UBadge 
                  v-for="trans in publication.translations" 
                  :key="trans.id"
                  variant="soft" 
                  color="neutral"
                  size="sm"
                  class="font-mono"
                >
                  {{ trans.language }} <span v-if="trans.title" class="ml-1 opacity-70">- {{ trans.title }}</span>
                </UBadge>
                <UBadge variant="soft" color="primary" size="sm" class="font-mono">
                  {{ state.language }} ({{ t('common.current') }})
                </UBadge>
            </div>
        </div>
      </UFormField>

      <!-- Advanced Configuration Section -->
      <UiFormAdvancedSection v-model="showAdvancedFields">
        <UFormField v-if="state.postType !== 'ARTICLE'" name="description" :help="t('post.descriptionPlaceholder')">
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.description') }}</span>
              <CommonInfoTooltip :text="t('post.descriptionTooltip')" />
            </div>
          </template>
          <UTextarea v-model="state.description" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" />
        </UFormField>

        <UFormField v-if="state.postType !== 'NEWS'" name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
          <UTextarea v-model="state.authorComment" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" :placeholder="t('post.authorCommentPlaceholder')" />
        </UFormField>

        <UFormField v-if="state.postType !== 'ARTICLE'" name="postDate" :label="t('post.postDate')" :help="t('post.postDateHint')">
          <UInput v-model="state.postDate" type="datetime-local" class="w-full" icon="i-heroicons-calendar" />
        </UFormField>

        <CommonYamlEditor v-model="state.meta" label="Meta (YAML)" help="Additional metadata in YAML format" :rows="8" />

      </UiFormAdvancedSection>

      <UiFormActions
        ref="formActionsRef"
        :loading="isLoading"
        :is-dirty="isDirty"
        :save-label="isEditMode ? t('common.save') : t('common.create')"
        hide-cancel
        @reset="handleReset"
      />
    </UForm>

    <!-- Validation Warning Modal -->
    <ModalsValidationWarningModal
      v-model:open="showValidationWarning"
      :errors="validationErrors"
      entity-type="publication"
      @confirm="handleValidationWarningConfirm"
      @cancel="handleValidationWarningCancel"
    />

    <ModalsTranslateModal
      v-model:open="isTranslateModalOpen"
      :source-text="translationSourceText"
      :default-target-lang="state.language"
      @translated="handleTranslated"
    />

    <!-- LLM Generator Modal -->
    <ModalsLlmGeneratorModal
      v-model:open="showLlmModal"
      @insert="handleInsertLlmContent"
    />
</template>
