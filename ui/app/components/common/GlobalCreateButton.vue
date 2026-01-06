<script setup lang="ts">
import type { PostType } from '~/types/posts'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

// Modals state
const isPublicationModalOpen = ref(false)
const isProjectModalOpen = ref(false)
const isChannelModalOpen = ref(false)

// Dropdown items
const items = computed(() => [
  [{
    label: t('publication.create'),
    icon: 'i-heroicons-document-text',
    click: () => {
      isPublicationModalOpen.value = true
    }
  }],
  [{
    label: t('project.createProject'),
    icon: 'i-heroicons-briefcase',
    click: () => {
      isProjectModalOpen.value = true
    }
  }, {
    label: t('channel.createChannel'),
    icon: 'i-heroicons-hashtag',
    click: () => {
      isChannelModalOpen.value = true
    }
  }]
])

// Quick create publication (default action)
function quickCreatePublication() {
  isPublicationModalOpen.value = true
}

// Handle successful creation
function handleProjectCreated(projectId: string) {
  isProjectModalOpen.value = false
  router.push(`/projects/${projectId}`)
}

function handleChannelCreated(channelId: string, projectId: string) {
  isChannelModalOpen.value = false
  router.push(`/projects/${projectId}/channels/${channelId}`)
}

// Publication creation
const { projects, fetchProjects } = useProjects()
const { createPublication, isLoading: isCreatingPublication } = usePublications()
const { channels, fetchChannels } = useChannels()
const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()

const publicationForm = reactive({
  projectId: '',
  language: 'ru-RU',
  postType: 'POST' as PostType,
  channelIds: [] as string[]
})

// Load data when publication modal opens
watch(isPublicationModalOpen, async (open) => {
  if (open) {
    await fetchProjects()
    publicationForm.projectId = projects.value[0]?.id || ''
    if (publicationForm.projectId) {
      await fetchChannels({ projectId: publicationForm.projectId })
    }
  }
})

// Watch project changes to reload channels
watch(() => publicationForm.projectId, async (projectId) => {
  if (projectId) {
    await fetchChannels({ projectId })
    // Auto-select matching channels
    publicationForm.channelIds = channels.value
      .filter(ch => ch.language === publicationForm.language)
      .map(ch => ch.id)
  }
})

// Watch language changes
watch(() => publicationForm.language, (newLang) => {
  const matchingChannels = channels.value
    .filter(ch => ch.language === newLang)
    .map(ch => ch.id)
  
  if (matchingChannels.length > 0) {
    publicationForm.channelIds = matchingChannels
  }
})

const projectOptions = computed(() => 
  projects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
)

const channelOptions = computed(() => {
  return channels.value.map((channel) => ({
    value: channel.id,
    label: channel.name,
    socialMedia: channel.socialMedia,
    language: channel.language,
  }))
})

function toggleChannel(channelId: string) {
  const index = publicationForm.channelIds.indexOf(channelId)
  if (index === -1) {
    publicationForm.channelIds.push(channelId)
  } else {
    publicationForm.channelIds.splice(index, 1)
  }
}

async function handleCreatePublication() {
  if (!publicationForm.projectId) return

  try {
    const createData = {
      projectId: publicationForm.projectId,
      language: publicationForm.language,
      postType: publicationForm.postType,
      channelIds: publicationForm.channelIds,
      content: '',
    }

    const publication = await createPublication(createData)

    if (publication) {
      toast.add({
        title: t('common.success'),
        description: t('publication.createSuccess', 'Publication created'),
        color: 'success'
      })
      
      isPublicationModalOpen.value = false
      router.push(`/projects/${publicationForm.projectId}/publications/${publication.id}?new=true`)
    }
  } catch (error) {
    console.error('Failed to create publication:', error)
    toast.add({
      title: t('common.error'),
      description: t('publication.createError', 'Failed to create publication'),
      color: 'error',
    })
  }
}

function closePublicationModal() {
  isPublicationModalOpen.value = false
}
</script>

<template>
  <div class="flex items-center">
    <UButtonGroup>
      <!-- Quick create button -->
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        @click="quickCreatePublication"
      >
        {{ t('publication.title') }}
      </UButton>

      <!-- Dropdown menu -->
      <UDropdown :items="items" :popper="{ placement: 'bottom-end' }">
        <UButton
          icon="i-heroicons-chevron-down"
          color="primary"
          square
        />
      </UDropdown>
    </UButtonGroup>

    <!-- Create Publication Modal -->
    <UModal v-model:open="isPublicationModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('publication.create') }}
            </h2>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              size="sm"
              @click="closePublicationModal"
            />
          </div>

          <form class="space-y-6" @submit.prevent="handleCreatePublication">
            <!-- Project -->
            <UFormField :label="t('project.title')" required>
              <USelectMenu
                v-model="publicationForm.projectId"
                :items="projectOptions"
                value-key="value"
                label-key="label"
                class="w-full"
              >
                <template #leading>
                  <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
                </template>
              </USelectMenu>
            </UFormField>

            <!-- Language -->
            <UFormField :label="t('common.language')" required>
              <USelectMenu
                v-model="publicationForm.language"
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
            <UFormField :label="t('publication.createModal.selectPostType', 'Post Type')" required>
              <USelectMenu
                v-model="publicationForm.postType"
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
                      :model-value="publicationForm.channelIds.includes(channel.value)"
                      class="pointer-events-none"
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
                      v-if="channel.language !== publicationForm.language"
                      :text="t('publication.languageMismatch', 'Language mismatch!')"
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
                :disabled="isCreatingPublication"
                @click="closePublicationModal"
              >
                {{ t('common.cancel') }}
              </UButton>
              <UButton
                type="submit"
                color="primary"
                :loading="isCreatingPublication"
                :disabled="!publicationForm.projectId"
              >
                {{ t('common.create') }}
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Create Project Modal -->
    <ModalsCreateProjectModal
      v-model:open="isProjectModalOpen"
      @created="handleProjectCreated"
    />

    <!-- Create Channel Modal -->
    <ModalsCreateChannelModal
      v-model:open="isChannelModalOpen"
      @created="handleChannelCreated"
    />
  </div>
</template>

