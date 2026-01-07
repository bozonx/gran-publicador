<script setup lang="ts">
import { z } from 'zod'
import yaml from 'js-yaml'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { ChannelWithProject } from '~/composables/useChannels'
import { usePublications } from '~/composables/usePublications'
import { usePosts } from '~/composables/usePosts'
import SocialIcon from '~/components/common/SocialIcon.vue'
import { FORM_SPACING, FORM_STYLES, GRID_LAYOUTS } from '~/utils/design-tokens'
import { getUserSelectableStatuses } from '~/utils/publications'

import type { PostType, PublicationStatus } from '~/types/posts'

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

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { createPublication, updatePublication, createPostsFromPublication, isLoading, getStatusDisplayName, fetchPublicationsByProject, publications } = usePublications()
const { 
  channels, 
  fetchChannels, 
  isLoading: isChannelsLoading
} = useChannels()
const { typeOptions, statusOptions: allStatusOptions } = usePosts()

const POST_TYPE_VALUES = ['POST', 'ARTICLE', 'NEWS', 'VIDEO', 'SHORT', 'STORY'] as const
const STATUS_VALUES = ['DRAFT', 'READY', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'PARTIAL', 'FAILED', 'EXPIRED'] as const

// Get language and channelId from URL query parameters
const languageParam = computed(() => route.query.language as string | undefined)
const channelIdParam = computed(() => route.query.channelId as string | undefined)

// Form state
const state = reactive({
  title: props.publication?.title || '',
  content: props.publication?.content || '',
  tags: props.publication?.tags || '',
  postType: (props.publication?.postType || 'POST') as PostType,
  status: (props.publication?.status || 'DRAFT') as PublicationStatus,
  scheduledAt: props.publication?.scheduledAt ? new Date(props.publication.scheduledAt).toISOString().slice(0, 16) : '',
  language: props.publication?.language || languageParam.value || 'en-US',
  channelIds: props.publication?.posts?.map((p: any) => p.channelId) || [] as string[],
  translationGroupId: (props.publication?.translationGroupId || undefined) as string | undefined | null,
  meta: (() => {
    if (!props.publication?.meta) return ''
    try {
        const parsed = typeof props.publication.meta === 'string' 
            ? JSON.parse(props.publication.meta) 
            : props.publication.meta
            
        // If parsed is empty object, return empty string
        if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
            return ''
        }
        
        return yaml.dump(parsed)
    } catch (e) {
        return props.publication.meta
    }
  })(),
  description: props.publication?.description || '',
  authorComment: props.publication?.authorComment || '',
  note: props.publication?.note || '',
  postDate: props.publication?.postDate ? new Date(props.publication.postDate).toISOString().slice(0, 16) : '',
})

const linkedPublicationId = ref<string | undefined>(undefined)

const isEditMode = computed(() => !!props.publication?.id)
const showAdvancedFields = ref(false)

// Validation Schema
const schema = computed(() => z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.string().optional(),
  postType: z.enum(POST_TYPE_VALUES),
  status: z.enum(STATUS_VALUES),
  scheduledAt: z.string().optional(),
  language: z.string().min(1, t('validation.required')),
  channelIds: z.array(z.string()).optional(),
  translationGroupId: z.string().nullable().optional(),
  meta: z.string().refine((val) => {
    if (!val || val.trim() === '') return true
    try {
      const parsed = yaml.load(val)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    } catch {
      return false
    }
  }, t('validation.invalidYaml', 'Must be a valid YAML object (key-value pairs), not a list or value')),
  description: z.string().optional(),
  authorComment: z.string().optional(),
  note: z.string().optional(),
  postDate: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.status === 'SCHEDULED' && !val.scheduledAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t('validation.required'),
      path: ['scheduledAt']
    })
  }

  if ((val.status === 'READY' || val.scheduledAt) && (!val.content || val.content.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t('publication.validation.contentRequired'),
      path: ['content']
    })
  }
}))

type Schema = z.output<typeof schema.value>

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state)

// Fetch channels and publications on mount
onMounted(async () => {
  if (props.projectId) {
    await fetchChannels({ projectId: props.projectId })
    // Fetch recent publications to allow linking (limit 50 for now)
    await fetchPublicationsByProject(props.projectId, { limit: 50 })
    
    // Auto-select channel if channelId parameter is provided
    if (channelIdParam.value && !isEditMode.value) {
      const selectedChannel = channels.value.find(ch => ch.id === channelIdParam.value)
      if (selectedChannel) {
        state.channelIds = [channelIdParam.value]
        state.language = selectedChannel.language
      }
    }
    // Otherwise, auto-select channels matching the language parameter
    else if (languageParam.value && !isEditMode.value) {
      const matchingChannels = channels.value
        .filter(ch => ch.language === languageParam.value)
        .map(ch => ch.id)
      state.channelIds = matchingChannels
    }
    
    // Save original state after initialization
    nextTick(() => {
      saveOriginalState()
    })
  }
})

// Watch for publication changes and update form state
watch(() => props.publication, (newPub) => {
  if (newPub) {
    state.title = newPub.title || ''
    state.content = newPub.content || ''
    state.tags = newPub.tags || ''
    state.postType = (newPub.postType || 'POST') as PostType
    state.status = (newPub.status || 'DRAFT') as PublicationStatus
    state.language = newPub.language || 'en-US'
    state.channelIds = newPub.posts?.map((p: any) => p.channelId) || []
    state.translationGroupId = newPub.translationGroupId || undefined
    state.meta = (() => {
        if (!newPub.meta) return ''
        try {
            const parsed = typeof newPub.meta === 'string' 
                ? JSON.parse(newPub.meta) 
                : newPub.meta
                
            // If parsed is empty object, return empty string
            if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
                return ''
            }

            return yaml.dump(parsed)
        } catch (e) {
            return newPub.meta
        }
    })()
    state.description = newPub.description || ''
    state.authorComment = newPub.authorComment || ''
    state.note = newPub.note || ''
    state.postDate = newPub.postDate ? new Date(newPub.postDate).toISOString().slice(0, 16) : ''
    state.scheduledAt = newPub.scheduledAt ? new Date(newPub.scheduledAt).toISOString().slice(0, 16) : ''
    
    nextTick(() => {
      saveOriginalState()
    })
  }
}, { immediate: true })

// Publications available for linking (exclude current and filter by type)
const availablePublications = computed(() => {
    return publications.value
        .filter(p => p.id !== props.publication?.id)
        .filter(p => p.postType === state.postType) // Filter by type
        .map(p => ({
            value: p.id,
            label: p.title ? `${p.title} (${p.language})` : `Untitled (${p.language}) - ${new Date(p.createdAt).toLocaleDateString()}`,
            translationGroupId: p.translationGroupId,
            language: p.language
        }))
})

// Handle translation group selection
function handleTranslationLink(publicationId: string) {
    linkedPublicationId.value = publicationId
    state.translationGroupId = undefined // Clear raw ID if linking to new generic pub
}

// Handle unlinking
function handleUnlink() {
    state.translationGroupId = null // Set to null to unlink
    linkedPublicationId.value = undefined
}

// Channel options for select
const channelOptions = computed(() => {
  return channels.value.map((channel: ChannelWithProject) => ({
    value: channel.id,
    label: channel.name,
    socialMedia: channel.socialMedia,
    language: channel.language,
  }))
})

// Status options
const displayStatusOptions = computed(() => {
    const options = [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') }
    ]
    
    // If we are in edit mode and the status is some system status, add it as a 3rd option
    if (isEditMode.value && state.status !== 'DRAFT' && state.status !== 'READY') {
        const fullOption = statusOptions.value.find(s => s.value === state.status)
        options.push({
            value: state.status,
            label: fullOption?.label || state.status,
            isSystem: true
        } as any)
    }
    
    return options
})

const isScheduledStatus = computed(() => state.status === 'SCHEDULED')

const { languageOptions } = useLanguages()

/**
 * Handle form submission
 */
async function handleSubmit(event: FormSubmitEvent<Schema>) {
  try {
    if (isEditMode.value && props.publication) {
      // Update existing publication
      const updateData: any = {
          title: event.data.title || undefined,
          description: event.data.description || undefined,
          content: event.data.content || undefined,
          authorComment: event.data.authorComment || null,
          note: event.data.note || null,
          tags: event.data.tags || undefined,
          status: event.data.status,
          language: event.data.language,
          linkToPublicationId: linkedPublicationId.value || undefined, // Send linkToPublicationId
          // Explicitly send translationGroupId if it was cleared (set to null)
          translationGroupId: state.translationGroupId === null ? null : undefined,
          postType: event.data.postType,
          meta: (() => { 
            try { 
                if (!event.data.meta || event.data.meta.trim() === '') return {} // Return empty object for empty string
                const parsed = yaml.load(event.data.meta)
                return parsed === null ? {} : parsed // Return empty object for null
            } catch { return {} } 
          })(),
          postDate: event.data.postDate ? new Date(event.data.postDate).toISOString() : undefined,
          scheduledAt: event.data.scheduledAt ? new Date(event.data.scheduledAt).toISOString() : undefined,
      }
      
      // Update the publication itself
      await updatePublication(props.publication.id, updateData)
      
      // Handle post creation for newly selected channels
      const originalChannelIds = props.publication.posts?.map((p: any) => p.channelId) || []
      const newChannelIds = state.channelIds.filter(id => !originalChannelIds.includes(id))
      
      if (newChannelIds.length > 0) {
          await createPostsFromPublication(
              props.publication.id, 
              newChannelIds, 
              event.data.status === 'SCHEDULED' ? event.data.scheduledAt : undefined
          )
      }

      formActionsRef.value?.showSuccess()
      emit('success', props.publication.id)
      // Update original state after successful save
      saveOriginalState()

    } else {
      // Create new publication
      const createData: any = {
        projectId: props.projectId,
        title: event.data.title || undefined,
        description: event.data.description || undefined,
        content: event.data.content || undefined,
        authorComment: event.data.authorComment || null,
        note: event.data.note || null,
        tags: event.data.tags || undefined,
        // Master status logic: if scheduled and has channels -> scheduled, else draft
        status: event.data.status === 'SCHEDULED' && state.channelIds.length === 0 ? 'DRAFT' : event.data.status,
        language: event.data.language,
        linkToPublicationId: linkedPublicationId.value || undefined,
        postType: event.data.postType,
        meta: (() => { 
            try { 
                if (!event.data.meta || event.data.meta.trim() === '') return {} // Return empty object for empty string
                const parsed = yaml.load(event.data.meta)
                return parsed === null ? {} : parsed // Return empty object for null
            } catch { return {} } 
        })(),
        postDate: event.data.postDate ? new Date(event.data.postDate).toISOString() : undefined,
        scheduledAt: event.data.scheduledAt ? new Date(event.data.scheduledAt).toISOString() : undefined,
      }

      const publication = await createPublication(createData)
      
      if (publication) {
        // If channels are selected, distribute posts
        if (state.channelIds.length > 0) {
          await createPostsFromPublication(
              publication.id, 
              state.channelIds, 
              event.data.status === 'SCHEDULED' ? event.data.scheduledAt : undefined
          )
        }
        
        formActionsRef.value?.showSuccess()
        emit('success', publication.id)
        // Update original state after successful save
        saveOriginalState()
      } else {
        throw new Error('Failed to create publication')
      }
    }
  } catch (error) {
    console.error(error)
    formActionsRef.value?.showError()
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error',
      duration: 5000
    })
  }
}

function handleCancel() {
  emit('cancel')
}

function handleReset() {
  resetToOriginal()
}

function handleError(event: any) {
    console.error('Form validation errors:', event.errors)
    
    // Expand advanced section if errors are there
    const advancedFields = ['description', 'authorComment', 'note', 'postDate', 'meta']
    const hasAdvancedErrors = event.errors.some((e: any) => advancedFields.includes(e.path))
    
    if (hasAdvancedErrors) {
        showAdvancedFields.value = true
    }

    toast.add({
        title: t('common.error'),
        description: t('validation.checkFormErrors', 'Please check the form for errors'),
        color: 'error'
    })
    
    formActionsRef.value?.showError()
}

function toggleChannel(channelId: string) {
    const index = state.channelIds.indexOf(channelId)
    if (index === -1) {
        state.channelIds.push(channelId)
    } else {
        state.channelIds.splice(index, 1)
    }
}
</script>

<template>
    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit" @error="handleError">
      
      <!-- Channels (Multi-select) -->
      <div v-if="!isEditMode">
        <UFormField name="channelIds" :label="t('channel.titlePlural', 'Channels')" :help="t('publication.channelsHelp', 'Select channels to create posts immediately')">
            <div v-if="channelOptions.length > 0" :class="[GRID_LAYOUTS.channelGrid, 'mt-2']">
                <div 
                    v-for="channel in channelOptions" 
                    :key="channel.value" 
                    class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    @click="toggleChannel(channel.value)"
                >
                    <div class="flex items-center gap-2">
                        <UCheckbox 
                            :model-value="state.channelIds.includes(channel.value)"
                            @update:model-value="toggleChannel(channel.value)"
                            class="pointer-events-none" 
                        />
                        <span class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-32">
                            {{ channel.label }}
                        </span>
                    </div>
                    
                    <div class="flex items-center gap-1.5 shrink-0 ml-2">
                        <span class="text-xxs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded flex items-center gap-1 font-mono uppercase">
                            <UIcon name="i-heroicons-language" class="w-3 h-3" />
                            {{ channel.language }}
                        </span>
                        <UTooltip v-if="channel.language !== state.language" :text="t('publication.languageMismatch', 'Language mismatch! Publication is ' + state.language)">
                            <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-amber-500" />
                        </UTooltip>
                        <UTooltip :text="channel.socialMedia">
                            <SocialIcon :platform="channel.socialMedia" size="sm" />
                        </UTooltip>
                    </div>
                </div>
            </div>
            <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
                {{ t('publication.noChannels', 'No channels available. Create a channel first to publish.') }}
            </div>
        </UFormField>
      </div>

      <div :class="GRID_LAYOUTS.twoColumn">
          <!-- Status (Only when creating or read-only badge for scheduled) -->
          <UFormField v-if="!isEditMode || isScheduledStatus" name="status" :label="t('post.status')" required>
             <div v-if="isScheduledStatus" class="flex items-center gap-2">
                 <UTooltip :text="t('publication.status.scheduledAutomatic')">
                     <UBadge 
                         color="warning" 
                         variant="solid" 
                         size="lg"
                         class="gap-1 px-3"
                     >
                         <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                         {{ t('publicationStatus.scheduled') }}
                     </UBadge>
                 </UTooltip>
             </div>
             <div v-else>
               <div class="flex items-center gap-2">
                 <UButtonGroup orientation="horizontal" size="sm" class="shadow-sm">
                     <UButton
                       v-for="option in displayStatusOptions"
                       :key="option.value"
                       :label="option.label"
                       :color="state.status === option.value ? ((option as any).isSystem ? 'warning' : 'primary') : 'neutral'"
                       :variant="state.status === option.value ? 'solid' : 'soft'"
                       :disabled="(option.value === 'READY' && (!state.content || state.content.trim() === '') && state.status === 'DRAFT') || ((option as any).isSystem && state.status === option.value)"
                       class="rounded-none! first:rounded-s-lg! last:rounded-e-lg!"
                       @click="state.status = option.value as any"
                     />
                 </UButtonGroup>
                 
                 <UPopover :popper="{ placement: 'top' }">
                    <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                    <template #content>
                        <div class="p-3 max-w-xs text-xs whitespace-pre-line">
                            {{ t('publication.changeStatusWarningReset') }}
                        </div>
                    </template>
                 </UPopover>
               </div>
             </div>
          </UFormField>

           <!-- Scheduling -->
         <UFormField v-if="(state.status === 'SCHEDULED' || isScheduledStatus) && !isEditMode" name="scheduledAt" :label="t('post.scheduledAt')" required>
             <UInput v-model="state.scheduledAt" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
         </UFormField>

        <!-- Language -->
        <UFormField v-if="!isEditMode" name="language" :label="t('common.language', 'Language')" required>
            <USelectMenu
                v-model="state.language"
                :items="languageOptions"
                value-key="value"
                label-key="label"
                class="w-full"
            >
                <template #leading>
                    <UIcon name="i-heroicons-language" class="w-4 h-4" />
                </template>
            </USelectMenu>
        </UFormField>

         <UFormField v-if="!isEditMode" name="postType" :label="t('post.postType', 'Post Type')" required>
            <USelectMenu
                v-model="state.postType"
                :items="typeOptions"
                value-key="value"
                label-key="label"
                class="w-full"
            />
         </UFormField>
      </div>

      <!-- Title (optional) -->
      <UFormField name="title" :help="t('common.optional')">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('post.postTitle') }}</span>
            <UPopover :popper="{ placement: 'top' }">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
              <template #content>
                <div class="p-4 max-w-xs">
                  <p class="text-sm whitespace-pre-line">{{ t('post.postTitleTooltip') }}</p>
                </div>
              </template>
            </UPopover>
          </div>
        </template>
        <UInput
          v-model="state.title"
          :placeholder="t('post.titlePlaceholder', 'Enter title')"
          :size="FORM_STYLES.inputSizeLarge"
          :class="FORM_STYLES.fieldFullWidth"
          type="text"
          @keydown.enter.prevent
        />
      </UFormField>

      <!-- Content - Tiptap Editor -->
      <UFormField name="content">
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('post.content') }}</span>
            <UPopover :popper="{ placement: 'top' }">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
              <template #content>
                <div class="p-4 max-w-xs">
                  <p class="text-sm whitespace-pre-line">{{ t('post.contentTooltip') }}</p>
                </div>
              </template>
            </UPopover>
          </div>
        </template>
        
        <UAlert
          v-if="!state.content || state.content.trim() === ''"
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          :title="t('publication.validation.contentRequired')"
          class="mb-3"
        />

        <EditorTiptapEditor
          v-model="state.content"
          :placeholder="t('post.contentPlaceholder', 'Write your content here...')"
          :min-height="250"
        />
      </UFormField>
      
      <!-- Tags -->
       <UFormField name="tags" :label="t('post.tags')" :help="t('post.tagsHint')">
        <UInput
            v-model="state.tags"
            :placeholder="t('post.tagsPlaceholder', 'tag1, tag2, tag3')"
            :class="FORM_STYLES.fieldFullWidth"
            icon="i-heroicons-hashtag"
            @keydown.enter.prevent
        />
      </UFormField>

      <!-- Translation Group (Link to another publication) - Moved out of Advanced -->
      <UFormField name="translationGroupId" :label="t('publication.linkTranslation', 'Link as Translation of')" :help="t('publication.linkTranslationHelp', 'Select a publication to link this one as a translation version.')">
        <div class="flex gap-2">
            <USelectMenu
                :model-value="linkedPublicationId"
                :items="availablePublications"
                value-key="value"
                label-key="label"
                searchable
                :placeholder="state.translationGroupId ? t('publication.linked', 'Linked to a group') : t('publication.selectToLink', 'Select to link...')"
                class="flex-1"
                @update:model-value="handleTranslationLink"
            >
            </USelectMenu>
             <UTooltip v-if="state.translationGroupId || linkedPublicationId" :text="t('publication.unlink', 'Unlink from group')">
                <UButton
                    icon="i-heroicons-link-slash"
                    color="neutral"
                    variant="soft"
                    @click="handleUnlink"
                />
            </UTooltip>
        </div>
        
        <!-- Display Current Translations -->
        <div v-if="props.publication && props.publication.translations && props.publication.translations.length > 0" class="mt-2 text-sm text-gray-500">
            <span class="font-medium mr-1">{{ t('publication.currentTranslations', 'In this group:') }}</span>
            <div class="flex flex-wrap gap-1 mt-1">
                <UBadge 
                    v-for="trans in props.publication.translations" 
                    :key="trans.id"
                    variant="soft" 
                    color="neutral"
                    size="sm"
                    class="font-mono"
                >
                    {{ trans.language }} <span v-if="trans.title" class="ml-1 opacity-70">- {{ trans.title }}</span>
                </UBadge>
                 <UBadge 
                    variant="soft" 
                    color="primary"
                    size="sm"
                    class="font-mono"
                >
                    {{ state.language }} (Current)
                </UBadge>
            </div>
        </div>
      </UFormField>

       <!-- Advanced fields -->
      <UiFormAdvancedSection v-model="showAdvancedFields">
        <!-- Description -->
        <UFormField name="description" :help="t('post.descriptionPlaceholder')">
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('post.description') }}</span>
              <UPopover :popper="{ placement: 'top' }">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                <template #content>
                  <div class="p-4 max-w-xs">
                    <p class="text-sm whitespace-pre-line">{{ t('post.descriptionTooltip') }}</p>
                  </div>
                </template>
              </UPopover>
            </div>
          </template>
           <UTextarea v-model="state.description" :rows="FORM_STYLES.textareaRows" autoresize class="w-full" />
        </UFormField>

        <!-- Author Comment -->
        <UFormField name="authorComment" :label="t('post.authorComment')" :help="t('post.authorCommentHint')">
           <UTextarea 
             v-model="state.authorComment" 
             :rows="FORM_STYLES.textareaRows" 
             autoresize
             class="w-full"
             :placeholder="t('post.authorCommentPlaceholder')"
           />
        </UFormField>

        <!-- Post Date -->
        <UFormField name="postDate" :label="t('post.postDate')" :help="t('post.postDateHint')">
          <UInput v-model="state.postDate" type="datetime-local" :class="FORM_STYLES.fieldFullWidth" icon="i-heroicons-calendar" />
        </UFormField>

        <!-- Meta -->
        <UFormField name="meta" label="Meta (YAML)" help="Additional metadata in YAML format">
           <UTextarea v-model="state.meta" :rows="8" autoresize class="w-full font-mono" />
        </UFormField>

        <!-- Note (Internal) -->
        <UFormField name="note" :label="t('post.note')" :help="t('post.noteHint')">
           <UTextarea 
             v-model="state.note" 
             :rows="FORM_STYLES.textareaRows" 
             autoresize
             class="w-full"
             :placeholder="t('post.notePlaceholder')"
           />
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
