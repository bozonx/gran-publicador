<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { PostType, PublicationStatus } from '~/types/posts'
import { usePublicationFormState, usePublicationFormValidation } from '~/composables/usePublicationForm'
import { FORM_SPACING, FORM_STYLES, GRID_LAYOUTS } from '~/utils/design-tokens'
import { isTextContentEmpty } from '~/utils/text'

interface Props {
  /** Project ID for fetching channels */
  projectId: string
  /** Publication data for editing, null for creating new */
  publication?: PublicationWithRelations | null
}

interface Emits {
  (e: 'success', publicationId: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
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
const { typeOptions } = usePosts()
const { languageOptions } = useLanguages()

// Form Initialization
const languageParam = route.query.language as string | undefined
const channelIdParam = route.query.channelId as string | undefined
const state = usePublicationFormState(props.publication, languageParam)
const { schema } = usePublicationFormValidation(t)

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)
const showAdvancedFields = ref(false)
const linkedPublicationId = ref<string | undefined>(undefined)

const isEditMode = computed(() => !!props.publication?.id)
const hasMedia = computed(() => Array.isArray(props.publication?.media) && props.publication!.media.length > 0)
const isContentMissing = computed(() => isTextContentEmpty(state.content) && !hasMedia.value)

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state)

onMounted(async () => {
  if (props.projectId) {
    await Promise.all([
      fetchChannels({ projectId: props.projectId }),
      fetchPublicationsByProject(props.projectId, { limit: 50 })
    ])
    
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
  try {
    const data = event.data
    const commonData = {
      title: data.title || undefined,
      description: data.description || undefined,
      content: data.content || undefined,
      authorComment: data.authorComment || null,
      note: data.note || null,
      tags: data.tags || undefined,
      language: data.language,
      postType: data.postType,
      meta: data.meta || {},
      postDate: data.postDate ? new Date(data.postDate).toISOString() : undefined,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      sourceTexts: data.sourceTexts || [],
    }

    let publicationId = props.publication?.id

    if (isEditMode.value && publicationId) {
      await updatePublication(publicationId, {
        ...commonData,
        status: data.status,
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
        projectId: props.projectId,
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
      description: error.message || t('common.saveError'),
      color: 'error'
    })
  }
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

function handleDeleteSourceText(index: number) {
    if (!state.sourceTexts) return
    const newList = [...state.sourceTexts]
    newList.splice(index, 1)
    state.sourceTexts = newList
    if (state.sourceTexts.length === 0) {
        isSourceTextsOpen.value = false
    }
}

function handleDeleteAllSourceTexts() {
    state.sourceTexts = []
    isSourceTextsOpen.value = false
}
</script>

<template>
    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit" @error="handleError">
      
      <!-- Channels Selection Section -->
      <div v-if="!isEditMode">
        <UFormField name="channelIds" :label="t('channel.titlePlural')" :help="t('publication.channelsHelp')">
            <FormsPublicationChannelSelector 
              v-model="state.channelIds"
              :channels="channels"
              :current-language="state.language"
            />
        </UFormField>
      </div>

      <div :class="GRID_LAYOUTS.twoColumn">
        <!-- Status (Only when creating) -->
        <UFormField v-if="!isEditMode" name="status" :label="t('post.statusLabel')" required>
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
        <UFormField v-if="!isEditMode" name="language" :label="t('common.language')" required>
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
        <UFormField v-if="!isEditMode" name="postType" :label="t('post.postType')" required>
          <USelectMenu
            v-model="state.postType"
            :items="typeOptions"
            value-key="value"
            label-key="label"
            class="w-full"
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
      <div v-if="state.sourceTexts && state.sourceTexts.length > 0" class="mb-6 ml-1">
            <UButton
                variant="ghost"
                color="primary"
                size="sm"
                :icon="isSourceTextsOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="mb-2"
                @click="isSourceTextsOpen = !isSourceTextsOpen"
            >
                {{ isSourceTextsOpen ? t('sourceTexts.hide') : t('sourceTexts.view') }} ({{ state.sourceTexts.length }})
            </UButton>

            <div v-if="isSourceTextsOpen" class="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
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
                    <div class="flex justify-between items-start gap-3">
                        <div class="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300 leading-relaxed font-normal">{{ item.content }}</div>
                        <UButton
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            icon="i-heroicons-trash"
                            class="opacity-0 group-hover:opacity-100 transition-opacity"
                            @click="handleDeleteSourceText(index as number)"
                        />
                    </div>
                    <div v-if="item.source && item.source !== 'manual'" class="mt-2 text-xs text-gray-400 font-mono flex items-center gap-1">
                        <UIcon name="i-heroicons-link" class="w-3 h-3" />
                        {{ item.source }}
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
      <UFormField name="translationGroupId" :label="t('publication.linkTranslation')" :help="t('publication.linkTranslationHelp')">
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

        <UFormField name="note" :label="t('post.note')" :help="t('post.noteHint')">
          <UTextarea v-model="state.note" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" :placeholder="t('post.notePlaceholder')" />
        </UFormField>
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
</template>
