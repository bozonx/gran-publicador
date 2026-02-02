<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import { FORM_STYLES } from '~/utils/design-tokens'


const { t, locale } = useI18n()
const toast = useToast()

const emit = defineEmits<{
  (e: 'created', channelId: string, projectId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  initialProjectId?: string
}>()

const { projects, fetchProjects } = useProjects()
const { createChannel, isLoading, getSocialMediaIcon } = useChannels()
const { user } = useAuth()


const formState = reactive({
  projectId: '',
  name: '',
  socialMedia: '' as SocialMedia | '',
  language: user.value?.language || 'en-US',
  channelIdentifier: '',
  description: ''
})

// Load projects when modal opens
watch(isOpen, async (open) => {
  if (open) {
    if (user.value?.language) {
      formState.language = user.value.language
    }
    await fetchProjects()
    resetForm()
  }
})

function resetForm() {
  formState.projectId = props.initialProjectId || projects.value[0]?.id || ''
  formState.name = ''
  formState.socialMedia = '' as SocialMedia | ''
  formState.language = user.value?.language || 'en-US'
  formState.channelIdentifier = ''
  formState.description = ''
}

// Watch for user language changes and sync if modal is closed or language is not set
watch(() => user.value?.language, (newVal) => {
    if (newVal) {
        formState.language = newVal
    }
}, { immediate: true })


// Social media options


// Project options
const projectOptions = computed(() => 
  projects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
)

async function handleCreate() {
  const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  
  if (!formState.projectId || !isUuid(formState.projectId)) {
    console.error('[CreateChannelModal] Cannot create channel: projectId is missing or not a valid UUID', formState.projectId)
    return
  }

  if (!formState.name || !formState.projectId || !formState.socialMedia) return

  try {
    const channel = await createChannel({
      projectId: formState.projectId,
      name: formState.name,
      socialMedia: formState.socialMedia as SocialMedia,
      language: formState.language,
      channelIdentifier: formState.channelIdentifier,
      description: formState.description || undefined
    })

    if (channel) {
      resetForm()
      isOpen.value = false
      emit('created', channel.id, formState.projectId)
    }
  } catch (error: any) {
    // Error handled by useChannels
  }
}

function handleClose() {
  resetForm()
  isOpen.value = false
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('channel.createChannel')" :ui="{ content: 'sm:max-w-2xl' }">
    <form id="create-channel-form" @submit.prevent="handleCreate" class="space-y-6">
      <!-- Project -->
      <UFormField :label="t('channel.project')" required>
        <USelectMenu
          v-model="formState.projectId"
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

      <FormsChannelPartsChannelGeneralFields
        :state="formState"
        :is-edit-mode="false"
        :show-project="false"
      />
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
        color="primary" 
        :loading="isLoading" 
        :disabled="!formState.name || !formState.projectId || !formState.socialMedia || !formState.channelIdentifier" 
        form="create-channel-form"
        type="submit"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
