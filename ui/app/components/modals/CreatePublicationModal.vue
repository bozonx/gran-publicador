<script setup lang="ts">
import type { PostType } from '~/types/posts'

interface Props {
  projectId: string
  preselectedLanguage?: string
  preselectedChannelId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'success', publicationId: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const router = useRouter()
const { languageOptions } = useLanguages()
const { channels, fetchChannels } = useChannels()
const { createPublication, isLoading } = usePublications()
const { typeOptions } = usePosts()

const isOpen = defineModel<boolean>('open', { required: true })

// Form data
const formData = reactive({
  language: props.preselectedLanguage || 'ru-RU',
  postType: 'POST' as PostType,
  channelIds: [] as string[],
})

// Watch for project ID to load channels
watch(() => props.projectId, async (newProjectId) => {
  if (newProjectId) {
    await fetchChannels({ projectId: newProjectId })
  }
}, { immediate: true })

// Initialize form when modal opens or props change
watch([isOpen, () => props.preselectedLanguage, () => props.preselectedChannelId, () => channels.value.length], ([open]) => {
  if (open && channels.value.length > 0) {
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
  }
}, { immediate: true })

// Watch language changes to auto-select matching channels
watch(() => formData.language, (newLang) => {
    // Avoid auto-selecting if we are in "single channel" mode from props
    if (props.preselectedChannelId) {
        const channel = channels.value.find(ch => ch.id === props.preselectedChannelId)
        if (channel && channel.language === newLang) return
    }

    const matchingChannels = channels.value
      .filter(ch => ch.language === newLang)
      .map(ch => ch.id)
    
    if (matchingChannels.length > 0) {
        formData.channelIds = matchingChannels
    }
})

// Channel options
const channelOptions = computed(() => {
  return channels.value.map((channel) => ({
    value: channel.id,
    label: channel.name,
    socialMedia: channel.socialMedia,
    language: channel.language,
  }))
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
    const createData = {
      projectId: props.projectId,
      language: formData.language,
      postType: formData.postType,
      channelIds: formData.channelIds,
      content: '', // Empty content, will be filled later
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
    <!-- Form -->
    <form id="create-publication-form" class="space-y-6" @submit.prevent="handleCreate">
      <!-- Language -->
      <UFormField
        :label="t('common.language')"
        required
      >
        <USelectMenu
          v-model="formData.language"
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

      <!-- Post Type -->
      <UFormField
        :label="t('publication.createModal.selectPostType', 'Post Type')"
        required
      >
        <USelectMenu
          v-model="formData.postType"
          :items="typeOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>

      <!-- Channels -->
      <UFormField
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
              <span class="text-xxs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded flex items-center gap-1 font-mono uppercase">
                <UIcon name="i-heroicons-language" class="w-3 h-3" />
                {{ channel.language }}
              </span>
              <UTooltip
                v-if="channel.language !== formData.language"
                :text="t('publication.languageMismatch', 'Language mismatch! Publication is ' + formData.language)"
              >
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-amber-500" />
              </UTooltip>
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
        form="create-publication-form"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
