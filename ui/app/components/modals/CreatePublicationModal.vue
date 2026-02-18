<script setup lang="ts">
import type { PostType } from '~/types/posts'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'
import {
  getPostTypeOptionsForPlatforms,
  getSupportedPostTypesIntersection,
} from '~/utils/socialMediaPlatforms'

interface Props {
  projectId?: string
  preselectedLanguage?: string
  preselectedChannelId?: string
  preselectedPostType?: PostType
  preselectedChannelIds?: string[]
  allowProjectSelection?: boolean
  prefilledTitle?: string
  prefilledContent?: string
  prefilledMediaIds?: any[]
  prefilledTags?: string[]
  prefilledNote?: string
  prefilledContentItemIds?: string[]
  prefilledUnsplashId?: string
}

const props = withDefaults(defineProps<Props>(), {
  allowProjectSelection: false
})

const emit = defineEmits<{
  (e: 'success', publicationId: string): void
  (e: 'close'): void
}>()

const { t, locale } = useI18n()
const router = useRouter()
const { channels, fetchChannels, fetchChannel } = useChannels()
const { projects, fetchProjects } = useProjects()
const { createPublication, isLoading } = usePublications()
const { typeOptions } = usePosts()
const { user } = useAuth()
const { fetchByProject: fetchSignatures } = useAuthorSignatures()
const { templates: projectTemplates, fetchProjectTemplates } = useProjectTemplates()
const projectSignatures = ref<ProjectAuthorSignature[]>([])

const isOpen = defineModel<boolean>('open', { required: true })

const modalRootRef = ref<HTMLElement | null>(null)
const projectSelectRef = ref()
const languageSelectRef = ref()
const postTypeSelectRef = ref()

const focusCandidates = computed(() => {
  const candidates: Array<{ target: any }> = []

  if (!isProjectLocked.value) {
    candidates.push({ target: projectSelectRef })
  }



  candidates.push({ target: postTypeSelectRef })
  return candidates
})

useModalAutoFocus({
  open: isOpen,
  root: modalRootRef,
  candidates: focusCandidates,
})

const isProjectLocked = computed(() => {
  if (props.allowProjectSelection) return false
  return Boolean(props.projectId) || Boolean(props.preselectedChannelId)
})
const isChannelLocked = computed(() => Boolean(props.preselectedChannelId))
const isLanguageLocked = computed(() => {
  if (props.allowProjectSelection) return false
  return Boolean(props.preselectedChannelId) || Boolean(props.preselectedLanguage)
})

// Form data
const formData = reactive({
  projectId: props.projectId || '',
  language: props.preselectedLanguage || user.value?.language || locale.value,
  postType: props.preselectedPostType || 'POST' as PostType,
  channelIds: props.preselectedChannelIds || [] as string[],
  authorSignatureId: '',
  projectTemplateId: '',
  deleteOriginalContent: false,
})

const isApplyingAutoChannelSelection = ref(false)
const hasManualChannelSelection = ref(false)
const hasManualTemplateSelection = ref(false)
const hasManualSignatureSelection = ref(false)

watch(
  () => formData.channelIds,
  () => {
    if (isApplyingAutoChannelSelection.value) return
    hasManualChannelSelection.value = true
  },
  { deep: true },
)

watch(
  () => formData.projectTemplateId,
  () => {
    hasManualTemplateSelection.value = true
  },
)

watch(
  () => formData.authorSignatureId,
  () => {
    hasManualSignatureSelection.value = true
  },
)

const lastAppliedProjectId = ref<string | null>(props.projectId || null)

const isInitializedForOpen = ref(false)

// Load projects if needed
onMounted(async () => {
    if (projects.value.length === 0) {
        await fetchProjects()
    }
})

watch(isOpen, (open) => {
  if (open) {
    isInitializedForOpen.value = false

    lastAppliedProjectId.value = props.projectId || null

    if (props.projectId) {
      formData.projectId = props.projectId
    }
  }
})

watch(() => props.projectId, (newProjectId) => {
  if (!isOpen.value) return
  if (!newProjectId) return

  if (isProjectLocked.value) {
    formData.projectId = newProjectId
    lastAppliedProjectId.value = newProjectId
    return
  }

  if (!formData.projectId || formData.projectId === lastAppliedProjectId.value) {
    formData.projectId = newProjectId
    lastAppliedProjectId.value = newProjectId
  }
}, { immediate: true })



// Watch for project ID to load channels
watch(
  () => formData.projectId,
  async (newProjectId, oldProjectId, onInvalidate) => {
    let cancelled = false
    onInvalidate(() => {
      cancelled = true
    })

    if (newProjectId && newProjectId !== oldProjectId) {
      isApplyingAutoChannelSelection.value = true
      formData.channelIds = []
      isApplyingAutoChannelSelection.value = false

      if (!props.preselectedChannelId) {
        formData.authorSignatureId = ''
        formData.projectTemplateId = ''
        hasManualSignatureSelection.value = false
        hasManualTemplateSelection.value = false
      }

      hasManualChannelSelection.value = Boolean(props.preselectedChannelId || props.preselectedChannelIds?.length)
    }

    if (newProjectId) {
      const [, fetchedSigs] = (await Promise.all([
        fetchChannels({ projectId: newProjectId }),
        fetchSignatures(newProjectId),
        fetchProjectTemplates(newProjectId),
      ])) as [unknown, ProjectAuthorSignature[], unknown]

      if (cancelled) return

      projectSignatures.value = fetchedSigs

      const userId = user.value?.id
      const availableSignatureIds = new Set(fetchedSigs.map(s => s.id))
      if (formData.authorSignatureId && !availableSignatureIds.has(formData.authorSignatureId)) {
        formData.authorSignatureId = ''
        hasManualSignatureSelection.value = false
      }
      if (!hasManualSignatureSelection.value && userId) {
        const userSigs = fetchedSigs.filter(s => s.userId === userId)
        const first = userSigs[0]
        if (first) formData.authorSignatureId = first.id
      }

      const availableTemplateIds = new Set(projectTemplates.value.map(t => t.id))
      if (formData.projectTemplateId && !availableTemplateIds.has(formData.projectTemplateId)) {
        formData.projectTemplateId = ''
        hasManualTemplateSelection.value = false
      }

      if (!hasManualTemplateSelection.value) {
        const def = filteredProjectTemplates.value[0]
        if (def) formData.projectTemplateId = def.id
      }

      if (!props.preselectedChannelId) {
        const shouldAutoSelectChannels =
          !props.preselectedChannelIds?.length
          && (!hasManualChannelSelection.value || formData.channelIds.length === 0)

        if (shouldAutoSelectChannels) {
          const nextIds = channels.value
            .filter(ch => ch.language === formData.language)
            .map(ch => ch.id)

          const current = formData.channelIds
          if (current.length !== nextIds.length || current.some((id, idx) => id !== nextIds[idx])) {
            isApplyingAutoChannelSelection.value = true
            formData.channelIds = nextIds
            isApplyingAutoChannelSelection.value = false
          }
        }
      }
    } else {
      channels.value = []
      isApplyingAutoChannelSelection.value = true
      formData.channelIds = []
      isApplyingAutoChannelSelection.value = false
      formData.authorSignatureId = ''
      formData.projectTemplateId = ''
      hasManualChannelSelection.value = false
      hasManualSignatureSelection.value = false
      hasManualTemplateSelection.value = false
    }
  },
  { immediate: true },
)

// No longer need type watcher since type is gone

// Initialize form when modal opens or props change
watch([isOpen, () => props.preselectedLanguage, () => props.preselectedChannelId, () => channels.value.length], ([open]) => {
  if (!open) return
  if (isInitializedForOpen.value) return
  if (channels.value.length > 0) {
    const requestedChannelId = props.preselectedChannelId
    
    // Auto-select requested channel if available
    if (requestedChannelId) {
      const channel = channels.value.find(ch => ch.id === requestedChannelId)
      if (channel) {
        // Only override if data is missing or different
        if (formData.language !== channel.language) {
          formData.language = channel.language
        }
        
        // Ensure the array contains the ID
        if (!formData.channelIds.includes(requestedChannelId)) {
          formData.channelIds = [requestedChannelId]
        }
      }
    } 
    // Otherwise auto-select channels based on language if no specific channel requested
    else if (formData.channelIds.length === 0) {
      if (props.preselectedLanguage) {
        formData.language = props.preselectedLanguage
      }
      
      // Auto-select channels for the language
      const matchingChannels = channels.value
        .filter(ch => ch.language === formData.language)
        .map(ch => ch.id)
        
      if (matchingChannels.length > 0) {
        formData.channelIds = matchingChannels
      }
    }

    isInitializedForOpen.value = true
  }
}, { immediate: true })

watch([isOpen, () => props.preselectedChannelId], async ([open, preselectedChannelId]) => {
  if (!open) return
  if (!preselectedChannelId) return

  const channel = await fetchChannel(preselectedChannelId)
  if (!channel) return

  formData.projectId = channel.projectId
  formData.language = channel.language
  formData.channelIds = [preselectedChannelId]
})

// Watch language changes: always select all channels matching the new language
watch(() => formData.language, (newLang) => {
  if (props.preselectedChannelId) return

  const nextIds = channels.value
    .filter(ch => ch.language === newLang)
    .map(ch => ch.id)

  isApplyingAutoChannelSelection.value = true
  formData.channelIds = nextIds
  hasManualChannelSelection.value = false
  isApplyingAutoChannelSelection.value = false
})


const selectedPlatforms = computed(() => {
  const map = new Map(channels.value.map(ch => [ch.id, ch.socialMedia]))
  return formData.channelIds.map(id => map.get(id)).filter(Boolean) as any[]
})

const postTypeOptions = computed(() => {
  return getPostTypeOptionsForPlatforms({
    t,
    platforms: selectedPlatforms.value,
  })
})

watch([selectedPlatforms, () => formData.postType], () => {
  const supported = getSupportedPostTypesIntersection(selectedPlatforms.value)
  if (supported.length === 0) return
  if (!supported.includes(formData.postType as any)) {
    formData.postType = supported[0] as any
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

// Selected author signatures for channel warnings
const selectedAuthorSignatures = computed(() => {
  if (!formData.authorSignatureId) return []
  return projectSignatures.value.filter(s => s.id === formData.authorSignatureId)
})

// Filter templates by publication language and post type
const filteredProjectTemplates = computed(() => {
  return projectTemplates.value.filter((tpl) => {
    const langMatch = !tpl.language || tpl.language === formData.language
    const typeMatch = !tpl.postType || tpl.postType === formData.postType
    return langMatch && typeMatch
  })
})

// Template selector options
const templateOptions = computed(() => {
  return filteredProjectTemplates.value.map(tpl => ({
    value: tpl.id,
    label: tpl.name,
  }))
})

const hasTemplateOptions = computed(() => templateOptions.value.length > 0)

const canSubmit = computed(() => {
  if (!formData.projectId) return false
  if (!hasTemplateOptions.value) return false
  return Boolean(formData.projectTemplateId)
})

watch([
  () => formData.language,
  () => formData.postType,
  () => formData.projectId,
  () => projectTemplates.value.length,
], () => {
  if (!formData.projectId) return

  if (
    formData.projectTemplateId
    && !filteredProjectTemplates.value.some(t => t.id === formData.projectTemplateId)
  ) {
    const def = filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
    return
  }

  if (!formData.projectTemplateId && filteredProjectTemplates.value.length > 0) {
    const def = filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
  }
})


// Handle form submission
async function handleCreate() {
  try {
    if (!canSubmit.value) {
      const toast = useToast()
      toast.add({
        title: t('common.error'),
        description: t(
          'publication.createModal.templateRequired',
          'You must select a publication template before creating a publication',
        ),
        color: 'error',
      })
      return
    }

    const createData = {
      projectId: formData.projectId,
      language: formData.language,
      postType: formData.postType,
      channelIds: formData.channelIds,
      title: props.prefilledTitle || '',
      content: props.prefilledContent || '',
      existingMediaIds: props.prefilledMediaIds || [],
      tags: props.prefilledTags || [],
      note: props.prefilledNote || '',
      contentItemIds: props.prefilledContentItemIds || [],
      unsplashId: props.prefilledUnsplashId || undefined,
      authorSignatureId: formData.authorSignatureId || undefined,
      projectTemplateId: formData.projectTemplateId || undefined,
      deleteOriginalContent: formData.deleteOriginalContent,
    }

    const publication = await createPublication(createData)

    if (publication) {
      isOpen.value = false
      emit('success', publication.id)
      
      // Navigate to edit page
      router.push(`/publications/${publication.id}/edit`)
    }
  } catch (error) {
    console.error('Failed to create publication:', error)
    const toast = useToast()
    toast.add({
      title: t('common.error'),
      description: t('publication.createError', 'Failed to create publication'),
      color: 'error',
    })
  }
}

function handleClose() {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('publication.create')">
    <div ref="modalRootRef">
    <!-- Form -->
    <form id="create-publication-form" class="space-y-6" @submit.prevent="handleCreate">
      <!-- Publication Type Toggle -->


      <!-- Project Selection (only if project type selected) -->
      <UFormField
        v-if="!isProjectLocked"
        :label="t('project.title')"
        required
      >
        <CommonProjectSelect
          ref="projectSelectRef"
          v-model="formData.projectId"
          class="w-full"
          searchable
          :placeholder="t('project.namePlaceholder')"
        />
      </UFormField>

      <!-- Language -->
      <UFormField
        v-if="!isLanguageLocked"
        :label="t('common.language')"
        required
      >
        <CommonLanguageSelect
          v-model="formData.language"
          mode="all"
          searchable
          class="w-full"
        />
      </UFormField>

      <!-- Post Type -->
      <UFormField
        :label="t('publication.createModal.selectPostType', 'Post Type')"
        required
      >
        <PublicationsPublicationTypeSelect
          v-model="formData.postType"
          :items="postTypeOptions"
        />
      </UFormField>

      <!-- Advanced Configuration (Templates & Signatures) -->
      <div v-if="formData.projectId" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Publication Template Selection -->
        <UFormField
          :label="t('projectTemplates.title', 'Publication Template')"
        >
          <USelectMenu
            v-model="formData.projectTemplateId"
            :items="templateOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-squares-plus"
            :disabled="!hasTemplateOptions"
          />
          <div v-if="!hasTemplateOptions" class="text-sm text-gray-500 dark:text-gray-400 italic mt-2">
            {{ t('projectTemplates.noTemplatesForLanguage', 'No templates available for this language. Create a template or remove language restriction.') }}
          </div>
        </UFormField>

        <!-- Author Signature Selection -->
        <UFormField
          v-if="signatureOptions.length > 0"
          :label="t('authorSignature.title', 'Author Signature')"
        >
          <USelectMenu
            v-model="formData.authorSignatureId"
            :items="[{ value: null, label: t('common.none', 'None') }, ...signatureOptions]"
            value-key="value"
            label-key="label"
            class="w-full"
            icon="i-heroicons-pencil-square"
          />
        </UFormField>
      </div>

      <!-- Channels (only if project selected) -->
      <UFormField
        v-if="formData.projectId && !isChannelLocked"
        :label="t('publication.selectChannels')"
        :help="t('publication.channelsHelp')"
      >
        <CommonChannelCheckboxList
          v-model="formData.channelIds"
          :project-id="formData.projectId"
          :language="formData.language"
          :channels="channels"
          :selected-template-id="formData.projectTemplateId"
          :author-signatures="selectedAuthorSignatures"
        />
      </UFormField>
      
      <!-- Delete Original Content Option -->
      <UFormField
        v-if="props.prefilledContentItemIds && props.prefilledContentItemIds.length > 0"
        :help="t('publication.createModal.deleteOriginalContentHelp')"
      >
        <UCheckbox
          v-model="formData.deleteOriginalContent"
          :label="t('publication.createModal.deleteOriginalContent')"
        />
      </UFormField>
    </form>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="isLoading"
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="isLoading"
        :disabled="isLoading || !canSubmit"
        form="create-publication-form"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
