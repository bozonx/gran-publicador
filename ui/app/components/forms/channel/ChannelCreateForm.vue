<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { ChannelCreateInput } from '~/types/channels'

const { t } = useI18n()
const { projects, fetchProjects } = useProjects()
const { user } = useAuth()

const attrs = useAttrs()

const props = defineProps<{
  initialProjectId?: string
  showProjectSelect?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', data: ChannelCreateInput): void
  (e: 'cancel'): void
}>()

const formState = reactive({
  projectId: props.initialProjectId || '',
  name: '',
  socialMedia: 'TELEGRAM' as SocialMedia | '',
  language: user.value?.language || 'en-US',
  channelIdentifier: '',
  description: '',
  isActive: true,
  credentials: {
    telegramChannelId: '',
    telegramBotToken: '',
    vkAccessToken: '',
  },
})

// Options for project selection
const projectOptions = computed(() => 
  projects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
)

// Initialize projects if needed
onMounted(async () => {
  if (props.showProjectSelect && projects.value.length === 0) {
    await fetchProjects()
  }
  
  if (!formState.projectId && projects.value.length > 0 && projects.value[0]) {
    formState.projectId = projects.value[0].id
  }
})

// Watch for initialProjectId changes
watch(() => props.initialProjectId, (newId) => {
  if (newId) {
    formState.projectId = newId
  }
}, { immediate: true })

// Sync user language if available
watch(() => user.value?.language, (newLang) => {
  if (newLang && !formState.name) { // Only sync if form hasn't been edited much
    formState.language = newLang
  }
}, { immediate: true })

watch(() => formState.socialMedia, (newSocialMedia) => {
  if (!newSocialMedia) return

  if (newSocialMedia !== 'TELEGRAM') {
    formState.credentials.telegramChannelId = ''
    formState.credentials.telegramBotToken = ''
  }

  if (newSocialMedia !== 'VK') {
    formState.credentials.vkAccessToken = ''
  }
})

function getCredentials(): ChannelCreateInput['credentials'] | undefined {
  if (formState.socialMedia === 'TELEGRAM') {
    return {
      telegramChannelId: formState.credentials.telegramChannelId,
      telegramBotToken: formState.credentials.telegramBotToken,
    }
  }

  if (formState.socialMedia === 'VK') {
    return {
      vkAccessToken: formState.credentials.vkAccessToken,
    }
  }

  return undefined
}

function handleSubmit() {
  if (!formState.projectId || !formState.name || !formState.socialMedia || !formState.channelIdentifier) {
    return
  }

  emit('submit', {
    projectId: formState.projectId,
    name: formState.name,
    socialMedia: formState.socialMedia as SocialMedia,
    language: formState.language,
    channelIdentifier: formState.channelIdentifier,
    description: formState.description || undefined,
    isActive: formState.isActive,
    credentials: getCredentials(),
  })
}

const isFormValid = computed(() => {
  if (!(formState.projectId && formState.name && formState.socialMedia && formState.channelIdentifier)) {
    return false
  }

  if (formState.socialMedia === 'TELEGRAM') {
    return !!(formState.credentials.telegramChannelId && formState.credentials.telegramBotToken)
  }

  if (formState.socialMedia === 'VK') {
    return !!formState.credentials.vkAccessToken
  }

  return true
})

const currentSocialMedia = computed(() => {
  return formState.socialMedia ? (formState.socialMedia as SocialMedia) : undefined
})

const formId = computed(() => {
  const id = attrs.id
  return typeof id === 'string' && id.length > 0 ? id : 'channel-create-form'
})

defineExpose({
  formState,
  isFormValid,
  submit: handleSubmit
})
</script>

<template>
  <form :id="formId" @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Project Selection (Optional) -->
    <UFormField v-if="showProjectSelect" :label="t('channel.project')" required>
      <USelectMenu
        v-model="formState.projectId"
        :items="projectOptions"
        value-key="value"
        label-key="label"
        class="w-full"
        searchable
      >
        <template #leading>
          <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
        </template>
      </USelectMenu>
    </UFormField>

    <!-- General Fields -->
    <FormsChannelPartsChannelGeneralFields
      :state="formState"
      :is-edit-mode="false"
      :show-project="false"
      :current-social-media="formState.socialMedia || 'TELEGRAM'"
    />

    <FormsChannelPartsChannelCredentialsFields
      :state="formState"
      :current-social-media="currentSocialMedia"
    />

    <!-- Debug Text (Temporary) -->
    <!-- <div v-if="!formState.name">Form loaded</div> -->

    <slot name="extra-fields" :state="formState" />
  </form>
</template>
