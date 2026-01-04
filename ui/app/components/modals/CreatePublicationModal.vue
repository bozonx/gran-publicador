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

// Load channels on mount
onMounted(async () => {
  if (props.projectId) {
    await fetchChannels(props.projectId)
  }
})

// Initialize form when modal opens or props change
watch([isOpen, () => props.preselectedLanguage, () => props.preselectedChannelId], ([open]) => {
  if (open && channels.value.length > 0) {
    // Set language
    if (props.preselectedChannelId) {
      const channel = channels.value.find(ch => ch.id === props.preselectedChannelId)
      if (channel) {
        formData.language = channel.language
        formData.channelIds = [props.preselectedChannelId]
      }
    } else {
      if (props.preselectedLanguage) {
        formData.language = props.preselectedLanguage
      }
      
      // Auto-select channels for the language
      formData.channelIds = channels.value
        .filter(ch => ch.language === formData.language)
        .map(ch => ch.id)
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
      
      // Navigate to edit page with query param to expand form
      router.push(`/projects/${props.projectId}/publications/${publication.id}?new=true`)
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
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ t('publication.createModal.title', 'Create Publication') }}
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            size="sm"
            @click="handleClose"
          />
        </div>

        <!-- Form -->
        <form class="space-y-6" @submit.prevent="handleCreate">
          <!-- Language -->
          <UFormField
            :label="t('publication.createModal.selectLanguage', 'Language')"
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
            :label="t('publication.createModal.selectChannels', 'Channels (Optional)')"
            :help="t('publication.createModal.channelsHelp', 'Select channels to create posts immediately')"
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

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="isLoading"
              @click="handleClose"
            >
              {{ t('publication.createModal.cancelButton', 'Cancel') }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isLoading"
            >
              {{ t('publication.createModal.createButton', 'Create') }}
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
