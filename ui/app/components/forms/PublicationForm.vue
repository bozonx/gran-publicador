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
            fetchPublicationsByProject(newId, { limit: 50 })
        ])
    }
})

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)
const showAdvancedFields = ref(false)
const linkedPublicationId = ref<string | undefined>(undefined)
const showValidationWarning = ref(false)
const pendingSubmitData = ref<PublicationFormData | null>(null)
const isLoading = ref(false)

const isEditMode = computed(() => !!props.publication?.id)
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
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state, {
  enableNavigationGuard: !props.autosave,
  enableBeforeUnload: !props.autosave
})

// Initial load
onMounted(async () => {
    if (currentProjectId.value) {
        await Promise.all([
            fetchChannels({ projectId: currentProjectId.value }),
            fetchPublicationsByProject(currentProjectId.value, { limit: 50 })
        ])
    }
    
    if (projects.value.length === 0) {
        await fetchProjects()
    }
    
    nextTick(() => saveOriginalState())
})

// Auto-save setup
const { saveStatus, saveError } = useAutosave({
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
})

// Watch for external publication updates (e.g. from modals)
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
          // Reset dirty baseline so status sync doesn't trigger autosave
          nextTick(() => saveOriginalState())
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
    state.translationGroupId = newPub.translationGroupId || undefined
    
    
    // Reset baseline for dirty tracking AFTER updating state
    nextTick(() => saveOriginalState())
  }
}, { deep: true, immediate: true })

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
      language: data.language,
      postType: data.postType,
      meta: data.meta || {},
      postDate: data.postDate ? new Date(data.postDate).toISOString() : null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
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
        projectId: currentProjectId.value!,
        status: data.status === 'SCHEDULED' && state.channelIds.length === 0 ? 'DRAFT' : data.status,
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
        <UFormField v-if="!isEditMode" name="language" required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('common.language') }}</span>
              <CommonInfoTooltip :text="t('common.languageTooltip')" />
            </div>
          </template>
          <CommonLanguageSelect
            v-model="state.language"
            mode="all"
            searchable
            class="w-full"
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
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.content') }}</span>
              <CommonInfoTooltip :text="t('post.contentTooltip')" />
            </div>
            <UButton
                icon="i-heroicons-language"
                color="primary"
                variant="ghost"
                size="xs"
                :label="$t('actions.translate')"
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
        />
      </UFormField>

      <!-- Author Comment for NEWS -->
      <UFormField v-if="state.postType === 'NEWS'" name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
        <UTextarea v-model="state.authorComment" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" :placeholder="t('post.authorCommentPlaceholder')" />
      </UFormField>

      <!-- Source Texts Section -->

      
      <UFormField name="tags" :label="t('post.tags')" :help="t('post.tagsHint')">
        <CommonInputTags
          v-model="state.tags"
          :placeholder="t('post.tagsPlaceholder')"
          color="neutral"
          variant="outline"
          class="w-full"
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
        
        <UFormField name="note" :label="t('post.note')" :help="t('post.noteHint')">
          <UTextarea v-model="state.note" :rows="4" autoresize class="w-full" :placeholder="t('post.notePlaceholder')" />
        </UFormField>

        <CommonMetadataEditor v-model="state.meta" :label="t('common.meta')" :rows="8" />

      </UiFormAdvancedSection>

      <div class="flex justify-end items-center gap-4">
        <UiAutosaveStatus 
          v-if="autosave && isEditMode" 
          :status="saveStatus" 
          :error="saveError" 
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

</template>
