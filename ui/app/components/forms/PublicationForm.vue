<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { PostType, PublicationStatus } from '~/types/posts'
import type { PublicationFormData } from '~/types/publication-form'
import { usePublicationFormState, usePublicationFormValidation } from '~/composables/usePublicationForm'
import { usePublicationValidator } from '~/composables/usePublicationValidator'
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'
import { useFormDirtyState } from '~/composables/useFormDirtyState'
import { FORM_SPACING, FORM_STYLES, GRID_LAYOUTS } from '~/utils/design-tokens'
import { usePosts } from '~/composables/usePosts'
import { useLanguages } from '~/composables/useLanguages'
import { isTextContentEmpty } from '~/utils/text'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
import type { ProjectTemplate } from '~/types/channels'

interface Props {
  /** Project ID for fetching channels */
  projectId?: string | null
  /** Publication data for editing, null for creating new */
  publication?: PublicationWithRelations | null
  /** Whether to enable auto-saving on changes (only for edit mode) */
  autosave?: boolean
}

interface Emits {
  (e: 'success', publicationId: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  projectId: null,
  publication: null,
  autosave: false,
})

const emit = defineEmits<Emits>()

// 1. Core utilities
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { user } = useAuth()

// 2. Publication state & logic
const { updatePublication, createPublication, createPostsFromPublication, statusOptions, publications, fetchPublicationsByProject } = usePublications()
const { projects, fetchProjects } = useProjects()
const { channels, fetchChannels } = useChannels()
const { typeOptions } = usePosts()
const { languageOptions } = useLanguages()
const { schema } = usePublicationFormValidation(t)
const { validateForChannels, validateForExistingPosts } = usePublicationValidator()
const { fetchByProject: fetchSignatures } = useAuthorSignatures()
const { templates: projectTemplates, fetchProjectTemplates } = useProjectTemplates()
const projectSignatures = ref<ProjectAuthorSignature[]>([])

const languageParam = route.query.language as string | undefined
const currentProjectId = ref<string | undefined>(props.publication?.projectId || props.projectId || undefined)
const state = usePublicationFormState(props.publication, languageParam)

const projectOptions = computed(() => {
    return projects.value.map(p => ({
        value: p.id,
        label: p.name
    }))
})

watch(currentProjectId, async (newId) => {
    if (newId) {
        await Promise.all([
            fetchChannels({ projectId: newId }),
            fetchPublicationsByProject(newId, { limit: 50 }),
            fetchSignatures(newId).then(sigs => { projectSignatures.value = sigs }),
            fetchProjectTemplates(newId).then(() => {
                // Auto-select template if creating new post
                if (!isEditMode.value && !state.projectTemplateId && filteredProjectTemplates.value.length > 0) {
                    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
                    if (def) state.projectTemplateId = def.id
                }
            }),
        ])
        
        // Auto-select signature if creating new
        if (!isEditMode.value) {
            const project = projects.value.find(p => p.id === newId)
            const userId = user.value?.id
            if (userId && project?.preferences?.defaultSignatures?.[userId]) {
                state.authorSignatureId = project.preferences.defaultSignatures[userId]
            } else if (projectSignatures.value.length > 0) {
                // Fallback to first one if no default set
                const userSigs = projectSignatures.value.filter(s => s.userId === userId)
                if (userSigs.length > 0) {
                    state.authorSignatureId = userSigs[0].id
                }
            }
        }
    }
})

// Filter templates by publication language and post type
const filteredProjectTemplates = computed(() => {
  return projectTemplates.value.filter(tpl => {
    const langMatch = !tpl.language || tpl.language === state.language
    const typeMatch = !tpl.postType || tpl.postType === state.postType
    return langMatch && typeMatch
  })
})

// Watch language/postType changes to update template selection if needed
watch([() => state.language, () => state.postType], () => {
  if (isEditMode.value) return
  
  // If current template is not in the filtered list, pick a new one
  if (state.projectTemplateId && !filteredProjectTemplates.value.some(t => t.id === state.projectTemplateId)) {
    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
    state.projectTemplateId = def?.id || ''
  } else if (!state.projectTemplateId && filteredProjectTemplates.value.length > 0) {
    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
    state.projectTemplateId = def?.id || ''
  }
})

// Signature selector options
const signatureOptions = computed(() => {
  const userLang = user.value?.language || 'en-US'
  const userId = user.value?.id
  
  // Filter by current user
  const userSigs = projectSignatures.value.filter(sig => sig.userId === userId)
  
  return userSigs.map(sig => {
    const variant = sig.variants.find(v => v.language === userLang) || sig.variants[0]
    return {
      value: sig.id,
      label: variant?.content || sig.id,
    }
  })
})

// Template selector options
const templateOptions = computed(() => {
  return filteredProjectTemplates.value.map(tpl => ({
    value: tpl.id,
    label: tpl.name + (tpl.isDefault ? ` (${t('common.default')})` : ''),
  }))
})

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)
const showAdvancedFields = ref(false)
const showValidationWarning = ref(false)
const pendingSubmitData = ref<PublicationFormData | null>(null)
const isLoading = ref(false)

const isEditMode = computed(() => !!props.publication?.id)
const isLocked = computed(() => state.status === 'READY')
const hasMedia = computed(() => Array.isArray(props.publication?.media) && props.publication!.media.length > 0)
const isContentMissing = computed(() => {
    // Only show content/media requirement for non-DRAFT statuses
    if (state.status === 'DRAFT') return false
    return isTextContentEmpty(state.content) && !hasMedia.value
})

// Social Media Validation
const validationErrors = computed(() => {
    const mediaCount = props.publication?.media?.length || 0
    const mediaArray = props.publication?.media?.map(m => ({ type: m.media?.type || 'UNKNOWN' })) || []
    const postType = state.postType

    let errors = []
    
    if (!isEditMode.value) {
        // Creating: validate for selected channels
        errors = validateForChannels(
            state.content,
            mediaCount,
            mediaArray,
            postType,
            state.channelIds,
            [] // Deprecated: channels.value is no longer required here
        )
    } else {
        // Editing: validate for existing posts that inherit content
        errors = validateForExistingPosts(
            state.content,
            mediaCount,
            mediaArray,
            postType,
            props.publication
        )
    }

    return errors
        .filter(e => e.message?.trim())
        .map(e => `${e.channel}: ${e.message}`)
})

const isValid = computed(() => validationErrors.value.length === 0)


// Dirty state tracking
const dirtyState = props.autosave
  ? null
  : useFormDirtyState(state, {
      enableNavigationGuard: true,
      enableBeforeUnload: true,
    })

const isDirty = computed(() => dirtyState?.isDirty.value ?? false)
const saveOriginalState = () => dirtyState?.saveOriginalState()
const resetToOriginal = () => dirtyState?.resetToOriginal()

// Initial load
onMounted(async () => {
    if (currentProjectId.value) {
        await Promise.all([
            fetchChannels({ projectId: currentProjectId.value }),
            fetchPublicationsByProject(currentProjectId.value, { limit: 50 }),
            fetchSignatures(currentProjectId.value).then(sigs => { 
                projectSignatures.value = sigs 
                // Auto-select signature if creating new post
                if (!isEditMode.value && state.authorSignatureId === '') {
                    const project = projects.value.find(p => p.id === currentProjectId.value)
                    const userId = user.value?.id
                    if (userId && project?.preferences?.defaultSignatures?.[userId]) {
                        state.authorSignatureId = project.preferences.defaultSignatures[userId]
                    } else {
                        const userSigs = sigs.filter(s => s.userId === userId)
                        if (userSigs.length > 0) state.authorSignatureId = userSigs[0].id
                    }
                }
            }),
            fetchProjectTemplates(currentProjectId.value).then(() => {
                // Auto-select default template if creating new post
                if (!isEditMode.value && !state.projectTemplateId && filteredProjectTemplates.value.length > 0) {
                    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
                    if (def) state.projectTemplateId = def.id
                }
            }),
        ])
    }
    
    if (projects.value.length === 0) {
        await fetchProjects()
    }
    
    nextTick(() => saveOriginalState())
})

// Auto-save setup
const { saveStatus, saveError, isIndicatorVisible, indicatorStatus, syncBaseline, retrySave } = useAutosave({
  data: toRef(() => state),
  saveFn: async (data) => {
    if (!props.autosave || !isEditMode.value) return { saved: false, skipped: true }
    
    // Skip auto-save if invalid and NOT in DRAFT status
    // For DRAFTs we allow saving even if content is missing or rules are violated
    const canSaveAsInvalid = state.status === 'DRAFT'
    
    if (!isValid.value && !canSaveAsInvalid) {
      return { saved: false, skipped: true }
    }

    await performSubmit(data as PublicationFormData)
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
  enableNavigationGuards: props.autosave,
})

// Watch for external publication updates (e.g. from modals)
watch(() => props.publication, (newPub, oldPub) => {
  if (newPub) {
    // Fix for race condition/overwrite:
    // Only update local state if we are switching to a DIFFERENT publication.
    // If we are looking at the same publication (same ID), we trust our local state (user input)
    // more than the props (which might be stale or just an echo from autosave).
    // We strictly avoid overwriting user input with server data while editing.
    if (oldPub && newPub.id === oldPub.id) {
        // Sync status from server even for the same publication
        // (status is managed externally via buttons on the edit page)
        if (newPub.status && newPub.status !== state.status) {
          state.status = newPub.status as PublicationStatus
          // Reset baseline so status sync doesn't trigger autosave
          nextTick(() => {
            if (props.autosave) {
              syncBaseline()
              return
            }
            saveOriginalState()
          })
        }
        if (props.autosave) {
          syncBaseline()
        }
        return
    }

    state.title = newPub.title || ''
    state.content = newPub.content || ''
    state.tags = newPub.tags || ''
    state.postType = newPub.postType as PostType
    state.status = (newPub.status || 'DRAFT') as PublicationStatus
    state.language = newPub.language || user.value?.language || locale.value
    state.description = newPub.description || ''
    state.authorComment = newPub.authorComment || ''
    state.note = newPub.note || ''
    state.scheduledAt = newPub.scheduledAt ? new Date(newPub.scheduledAt).toISOString().slice(0, 16) : ''
    state.postDate = newPub.postDate ? new Date(newPub.postDate).toISOString().slice(0, 16) : ''
    
    // Reset baseline AFTER updating state
    nextTick(() => {
      if (props.autosave) {
        syncBaseline()
        return
      }
      saveOriginalState()
    })
  }
}, { deep: true, immediate: true })

/**
 * Handle form submission
 */
async function handleSubmit(event: FormSubmitEvent<any>) {
  // If there are validation errors, show warning modal
  if (!isValid.value) {
      pendingSubmitData.value = event.data as PublicationFormData
      showValidationWarning.value = true
      return
  }

  await performSubmit(event.data as PublicationFormData)
}

/**
 * Perform actual submission (called directly or after warning confirmation)
 */
async function performSubmit(data: PublicationFormData) {
  try {
    const commonData = {
      title: data.title || null,
      description: data.description || null,
      content: isTextContentEmpty(data.content) ? null : (data.content || null),
      authorComment: data.authorComment || null,
      note: data.note || null,
      tags: data.tags || null,
      postType: data.postType,
      meta: data.meta || {},
      postDate: data.postDate ? new Date(data.postDate).toISOString() : null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
    }

    let publicationId = props.publication?.id

    const isReadOnly = state.status === 'READY' || state.status === 'SCHEDULED'
    
    // If read-only, we must filter out fields that are not allowed to be modified
    // to avoid backend validation errors (server rejects modifications to title, content etc in READY state)
    let payload = { ...commonData }
    
    if (isReadOnly) {
       // Create a new payload with only allowed keys that are present in commonData
       const filteredPayload: any = {}
       
       // Explicitly copy allowed keys
       if (payload.note !== undefined) filteredPayload.note = payload.note
       if (payload.scheduledAt !== undefined) filteredPayload.scheduledAt = payload.scheduledAt
       
       payload = filteredPayload
    }

    if (isEditMode.value && publicationId) {
      await updatePublication(publicationId, {
        ...payload,
        projectTemplateId: isReadOnly ? undefined : (data.projectTemplateId || null),
        // Status is managed by separate actions in edit mode, don't send it back 
        // to avoid validation errors for system-managed statuses (e.g. PUBLISHED)
        status: undefined,
      }, { silent: props.autosave })
      
      const originalChannelIds = props.publication?.posts?.map((p: any) => p.channelId) || []
      const newChannelIds = state.channelIds.filter(id => !originalChannelIds.includes(id))
      
      if (newChannelIds.length > 0) {
          await createPostsFromPublication({
              id: publicationId,
              channelIds: newChannelIds,
              scheduledAt: data.status === 'SCHEDULED' ? data.scheduledAt : undefined,
              authorSignatureId: state.authorSignatureId || undefined,
              projectTemplateId: state.projectTemplateId || undefined,
          })
      }
    } else {
      const createData = {
        ...commonData,
        projectId: currentProjectId.value!,
        language: data.language,
        status: data.status === 'SCHEDULED' && state.channelIds.length === 0 ? 'DRAFT' : data.status,
        projectTemplateId: data.projectTemplateId || null,
      }

      const pub = await createPublication(createData)
      if (!pub) throw new Error('Failed to create publication')
      publicationId = pub.id

      if (state.channelIds.length > 0) {
        await createPostsFromPublication({
          id: publicationId,
          channelIds: state.channelIds,
          scheduledAt: data.status === 'SCHEDULED' ? data.scheduledAt : undefined,
          authorSignatureId: state.authorSignatureId || undefined,
          projectTemplateId: state.projectTemplateId || undefined,
        })
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
      description: t('common.saveError'),
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

const isTranslateModalOpen = ref(false)
const translationSourceText = ref('')

function handleOpenTranslateModal() {
    translationSourceText.value = state.content || ''
    isTranslateModalOpen.value = true
}

function handleTranslated(result: { translatedText: string }) {
    state.content = result.translatedText
}

const isQuickGenModalOpen = ref(false)

function handleLlmGenerated(text: string) {
    state.content = text
}

</script>

<template>
    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit" @error="handleError">


      <div :class="GRID_LAYOUTS.twoColumn">
        <!-- Project Selection -->
        <UFormField v-if="!isEditMode" name="projectId" :help="t('publication.projectSelectorHelp')">
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('project.title') }}</span>
              <CommonInfoTooltip :text="t('publication.projectSelectorHelp')" />
            </div>
          </template>
          <USelectMenu
            v-model="currentProjectId"
            :items="projectOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-folder"
          />
        </UFormField>

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
          />
        </UFormField>

        <!-- Scheduling -->
        <UFormField v-if="state.status === 'SCHEDULED'" name="scheduledAt" :label="t('post.scheduledAt')" required>
          <UInput v-model="state.scheduledAt" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
        </UFormField>

        <!-- Language -->
        <UFormField name="language" required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.languageLabel') }}</span>
              <CommonInfoTooltip :text="t('post.languageTooltip')" />
            </div>
          </template>
          <USelectMenu
            v-model="state.language"
            :items="languageOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-language"
            :disabled="isLocked"
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
          <PublicationsPublicationTypeSelect
            v-model="state.postType"
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
          :disabled="isLocked"
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
        <UTextarea v-model="state.description" :rows="FORM_STYLES.textareaRows" autoresize :disabled="isLocked" class="w-full" />
      </UFormField>

      <UFormField name="content">
        <template #label>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.content') }}</span>
              <CommonInfoTooltip :text="t('post.contentTooltip')" />
            </div>
                <UButton
                    icon="i-heroicons-sparkles"
                    color="primary"
                    variant="ghost"
                    size="xs"
                    :label="t('llm.generate')"
                    :disabled="isLocked"
                    @click="isQuickGenModalOpen = true"
                />
                <UButton
                    icon="i-heroicons-language"
                    color="primary"
                    variant="ghost"
                    size="xs"
                    :label="$t('actions.translate')"
                    :disabled="isLocked"
                    @click="() => handleOpenTranslateModal()"
                />
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

        <UAlert v-if="validationErrors.length > 0" color="warning" variant="soft" icon="i-heroicons-exclamation-triangle" class="mb-3">
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
          :default-target-lang="state.language"
          :project-id="currentProjectId"
          :disabled="isLocked"
        />
      </UFormField>

      <!-- Author Comment for NEWS -->
      <UFormField v-if="state.postType === 'NEWS'" name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
        <UTextarea v-model="state.authorComment" :rows="FORM_STYLES.textareaRows" autoresize :disabled="isLocked" class="w-full" :placeholder="t('post.authorCommentPlaceholder')" />
      </UFormField>

      <!-- Source Texts Section -->

      
      <UFormField name="tags" :label="t('post.tags')" :help="t('post.tagsHint')">
        <CommonInputTags
          v-model="state.tags"
          :placeholder="t('post.tagsPlaceholder')"
          color="neutral"
          variant="outline"
          :disabled="isLocked"
          class="w-full"
        />
      </UFormField>

      <!-- Project Configuration Section (Templates & Signatures) -->
      <div v-if="!isEditMode && (templateOptions.length > 0 || signatureOptions.length > 0)" :class="GRID_LAYOUTS.twoColumn">
        <!-- Publication Template Selection -->
        <UFormField
          v-if="templateOptions.length > 0"
          name="projectTemplateId"
          :label="t('projectTemplates.title', 'Publication Template')"
        >
          <USelectMenu
            v-model="state.projectTemplateId"
            :items="templateOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-squares-plus"
          />
        </UFormField>

        <!-- Author Signature Selection -->
        <UFormField
          v-if="signatureOptions.length > 0"
          name="authorSignatureId"
          :label="t('authorSignature.title', 'Author Signature')"
        >
          <USelectMenu
            v-model="state.authorSignatureId"
            :items="[{ value: null, label: t('common.none', 'None') }, ...signatureOptions]"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-pencil-square"
          />
        </UFormField>
      </div>

      <!-- Post Date for ARTICLE -->
      <UFormField v-if="state.postType === 'ARTICLE'" name="postDate" :label="t('post.postDate')" :help="t('post.postDateHint')">
        <UInput v-model="state.postDate" type="datetime-local" class="w-full" icon="i-heroicons-calendar" :disabled="isLocked" />
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
          <UTextarea v-model="state.description" :rows="FORM_STYLES.textareaRows" autoresize :disabled="isLocked" class="w-full" />
        </UFormField>

        <UFormField v-if="state.postType !== 'NEWS'" name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
          <UTextarea v-model="state.authorComment" :rows="FORM_STYLES.textareaRows" autoresize :disabled="isLocked" class="w-full" :placeholder="t('post.authorCommentPlaceholder')" />
        </UFormField>

        <UFormField v-if="state.postType !== 'ARTICLE'" name="postDate" :label="t('post.postDate')" :help="t('post.postDateHint')">
          <UInput v-model="state.postDate" type="datetime-local" class="w-full" icon="i-heroicons-calendar" :disabled="isLocked" />
        </UFormField>
        


        <CommonMetadataEditor v-model="state.meta" :label="t('common.meta')" :rows="8" :disabled="isLocked" />

      </UiFormAdvancedSection>

      <div class="flex justify-end items-center gap-4">
        <UiSaveStatusIndicator 
          v-if="autosave && isEditMode" 
          :status="indicatorStatus" 
          :visible="isIndicatorVisible"
          :error="saveError" 
          show-retry
          @retry="retrySave"
        />
        <UiFormActions
          v-else
          ref="formActionsRef"
          :loading="isLoading"
          :is-dirty="isDirty"
          :save-label="isEditMode ? t('common.save') : t('common.create')"
          hide-cancel
          @reset="handleReset"
        />
      </div>
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
      @translated="(res) => handleTranslated(res)"
    />

    <ModalsLlmQuickGeneratorModal
      v-model:open="isQuickGenModalOpen"
      :content="state.content"
      :media="(publication?.media?.map(m => m.media).filter(m => !!m) as any)"
      :project-id="currentProjectId"
      @apply="handleLlmGenerated"
    />

</template>
