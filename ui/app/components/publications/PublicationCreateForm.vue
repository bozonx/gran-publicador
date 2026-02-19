<script setup lang="ts">
import type { PostType } from '~/types/posts'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import type { ProjectAuthorSignature } from '~/types/author-signatures'
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
  isProjectLocked?: boolean
  isChannelLocked?: boolean
  isLanguageLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowProjectSelection: false,
})

const emit = defineEmits<{
  (e: 'success', publicationId: string): void
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()
const { channels, fetchChannels } = useChannels()
const { projects, fetchProjects } = useProjects()
const { createPublication, isLoading } = usePublications()
const { user } = useAuth()
const { fetchByProject: fetchSignatures } = useAuthorSignatures()
const { templates: projectTemplates, fetchProjectTemplates } = useProjectTemplates()
const projectSignatures = ref<ProjectAuthorSignature[]>([])

const effectiveIsProjectLocked = computed(() => {
  if (props.isProjectLocked !== undefined) return props.isProjectLocked
  if (props.allowProjectSelection) return false
  return Boolean(props.projectId) || Boolean(props.preselectedChannelId)
})

const effectiveIsChannelLocked = computed(() => {
  if (props.isChannelLocked !== undefined) return props.isChannelLocked
  return Boolean(props.preselectedChannelId)
})

const effectiveIsLanguageLocked = computed(() => {
  if (props.isLanguageLocked !== undefined) return props.isLanguageLocked
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

const projectSelectRef = ref()
const languageSelectRef = ref()
const postTypeSelectRef = ref()

defineExpose({
  projectSelectRef,
  languageSelectRef,
  postTypeSelectRef,
})

watch(
  () => formData.channelIds,
  () => {
    if (isApplyingAutoChannelSelection.value) return
    hasManualChannelSelection.value = true
  },
  { deep: true },
)

watch(() => formData.projectTemplateId, () => { hasManualTemplateSelection.value = true })
watch(() => formData.authorSignatureId, () => { hasManualSignatureSelection.value = true })

const lastAppliedProjectId = ref<string | null>(props.projectId || null)

// Load projects if needed
onMounted(async () => {
    if (projects.value.length === 0) {
        await fetchProjects()
    }
})

watch(() => props.projectId, (newProjectId) => {
  if (!newProjectId) return
  if (effectiveIsProjectLocked.value) {
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
    onInvalidate(() => { cancelled = true })

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

const signatureOptions = computed(() => {
  const userLang = user.value?.language || 'en-US'
  const userId = user.value?.id
  const userSigs = projectSignatures.value.filter(sig => sig.userId === userId)
  return userSigs.map(sig => {
    const variant = sig.variants.find(v => v.language === userLang) || sig.variants[0]
    return { value: sig.id, label: variant?.content || sig.id }
  })
})

const selectedAuthorSignatures = computed(() => {
  if (!formData.authorSignatureId) return []
  return projectSignatures.value.filter(s => s.id === formData.authorSignatureId)
})

const filteredProjectTemplates = computed(() => {
  return projectTemplates.value.filter((tpl) => {
    const langMatch = !tpl.language || tpl.language === formData.language
    const typeMatch = !tpl.postType || tpl.postType === formData.postType
    return langMatch && typeMatch
  })
})

const templateOptions = computed(() => {
  return filteredProjectTemplates.value.map(tpl => ({ value: tpl.id, label: tpl.name }))
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
  if (formData.projectTemplateId && !filteredProjectTemplates.value.some(t => t.id === formData.projectTemplateId)) {
    const def = filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
    return
  }
  if (!formData.projectTemplateId && filteredProjectTemplates.value.length > 0) {
    const def = filteredProjectTemplates.value[0]
    formData.projectTemplateId = def?.id || ''
  }
})

async function handleCreate() {
  try {
    if (!canSubmit.value) {
      const toast = useToast()
      toast.add({
        title: t('common.error'),
        description: t('publication.createModal.templateRequired', 'You must select a publication template before creating a publication'),
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
      emit('success', publication.id)
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
</script>

<template>
  <form id="publication-create-form" class="space-y-6" @submit.prevent="handleCreate">
    <!-- Project Selection -->
    <UFormField
      v-if="!effectiveIsProjectLocked"
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
      v-if="!effectiveIsLanguageLocked"
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

    <!-- Advanced Configuration -->
    <div v-if="formData.projectId" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField :label="t('projectTemplates.title', 'Publication Template')">
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
          {{ t('projectTemplates.noTemplatesForLanguage', 'No templates available for this language.') }}
        </div>
      </UFormField>

      <UFormField v-if="signatureOptions.length > 0" :label="t('authorSignature.title', 'Author Signature')">
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

    <!-- Channels -->
    <UFormField
      v-if="formData.projectId && !effectiveIsChannelLocked"
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

    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="isLoading"
        @click="emit('cancel')"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="isLoading"
        :disabled="isLoading || !canSubmit"
      >
        {{ t('common.create') }}
      </UButton>
    </div>
  </form>
</template>
