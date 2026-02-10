<script setup lang="ts">
import type { PostType } from '~/types/posts'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'

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
  prefilledTags?: string
  prefilledNote?: string
  prefilledContentItemIds?: string[]
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
})

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

const activeProjects = computed(() => {
    return projects.value
        .filter(p => !p.archivedAt)
        .map(p => ({
            value: p.id,
            label: p.name
        }))
})

// Watch for project ID to load channels
watch(() => formData.projectId, async (newProjectId) => {
  if (newProjectId) {
    await Promise.all([
      fetchChannels({ projectId: newProjectId }),
      fetchSignatures(newProjectId).then(sigs => { 
        projectSignatures.value = sigs 
        // Auto-select signature
        const project = projects.value.find(p => p.id === newProjectId)
        const userId = user.value?.id
        const userPrefs = project?.preferences as any
        if (userId && userPrefs?.defaultSignatures?.[userId]) {
            formData.authorSignatureId = userPrefs.defaultSignatures[userId]
        } else if (sigs.length > 0) {
            const userSigs = sigs.filter(s => s.userId === userId)
            if (userSigs.length > 0 && userSigs[0]) formData.authorSignatureId = userSigs[0].id
        }
      }),
      fetchProjectTemplates(newProjectId).then(tpls => {
        // Auto-select default template
        if (tpls.length > 0) {
          const def = tpls.find(t => t.isDefault) || tpls[0]
          if (def) formData.projectTemplateId = def.id
        }
      }),
    ])

    if (!props.preselectedChannelId) {
      if (!props.preselectedChannelIds?.length && formData.channelIds.length === 0) {
        formData.channelIds = channels.value
          .filter(ch => ch.language === formData.language)
          .map(ch => ch.id)
      }
    }
  } else {
    channels.value = []
    formData.channelIds = []
  }
}, { immediate: true })

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

// Watch language changes: clear mismatched channels and auto-select matching ones
watch(() => formData.language, (newLang) => {
    // Remove channels that don't match the new language
    const matchingIds = new Set(
      channels.value.filter(ch => ch.language === newLang).map(ch => ch.id)
    )
    formData.channelIds = formData.channelIds.filter(id => matchingIds.has(id))

    // Auto-select all matching channels if none selected
    if (formData.channelIds.length === 0 && !props.preselectedChannelId) {
      formData.channelIds = [...matchingIds]
    }
})

// Channel options — strictly filtered by publication language
const channelOptions = computed(() => {
  return channels.value
    .filter(channel => channel.language === formData.language)
    .map((channel) => ({
      value: channel.id,
      label: channel.name,
      socialMedia: channel.socialMedia,
      language: channel.language,
    }))
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

// Filter templates by publication language
const filteredProjectTemplates = computed(() => {
  return projectTemplates.value.filter((tpl) => {
    return !tpl.language || tpl.language === formData.language
  })
})

// Template selector options
const templateOptions = computed(() => {
  return filteredProjectTemplates.value.map(tpl => ({
    value: tpl.id,
    label: tpl.name + (tpl.isDefault ? ` (${t('common.default')})` : ''),
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
  () => formData.projectId,
  () => projectTemplates.value.length,
], () => {
  if (!formData.projectId) return

  if (
    formData.projectTemplateId
    && !filteredProjectTemplates.value.some(t => t.id === formData.projectTemplateId)
  ) {
    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
    return
  }

  if (!formData.projectTemplateId && filteredProjectTemplates.value.length > 0) {
    const def = filteredProjectTemplates.value.find(t => t.isDefault) || filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
  }
})

// Toggle channel selection
function toggleChannel(channelId: string) {
  const index = formData.channelIds.indexOf(channelId)
  if (index === -1) {
    formData.channelIds.push(channelId)
  } else {
    formData.channelIds.splice(index, 1)
  }
}

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
      tags: props.prefilledTags || '',
      note: props.prefilledNote || '',
      contentItemIds: props.prefilledContentItemIds || [],
      authorSignatureId: formData.authorSignatureId || undefined,
      projectTemplateId: formData.projectTemplateId || undefined,
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
        <USelectMenu
          ref="projectSelectRef"
          v-model="formData.projectId"
          :items="activeProjects"
          value-key="value"
          label-key="label"
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
        <FormsLanguageButtonGroup
          v-model="formData.language"
          :channels="channels"
        />
      </UFormField>

      <!-- Post Type -->
      <UFormField
        :label="t('publication.createModal.selectPostType', 'Post Type')"
        required
      >
        <PublicationsPublicationTypeSelect
          v-model="formData.postType"
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
        <div v-if="channelOptions.length > 0" class="grid grid-cols-1 gap-3 mt-2">
          <div
            v-for="channel in channelOptions"
            :key="channel.value"
            class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
            @click="toggleChannel(channel.value)"
          >
            <div class="flex items-center gap-2">
              <UCheckbox
                :model-value="formData.channelIds.includes(channel.value)"
                class="pointer-events-none"
                @update:model-value="toggleChannel(channel.value)"
              />
              <span class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-48">
                {{ channel.label }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 ml-2">
              <UTooltip :text="channel.socialMedia">
                <CommonSocialIcon :platform="channel.socialMedia" size="sm" />
              </UTooltip>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic mt-2">
          {{ t('publication.noChannels', 'No channels available. Create a channel first to publish.') }}
        </div>
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
