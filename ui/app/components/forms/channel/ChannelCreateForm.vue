<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { ChannelCreateInput } from '~/types/channels'

const { t } = useI18n()
const { projects, fetchProjects } = useProjects()
const { user } = useAuth()

const props = defineProps<{
  initialProjectId?: string
  showProjectSelect?: boolean
  id?: string
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

const isProjectLocked = computed(() => !props.showProjectSelect)

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
    if (isProjectLocked.value || !formState.projectId) {
      formState.projectId = newId
    }
  }
}, { immediate: true })

// Sync user language if available
watch(() => user.value?.language, (newLang) => {
  if (newLang && !formState.name && !formState.channelIdentifier) {
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
  return !!(
    formState.projectId && 
    formState.name && 
    formState.socialMedia && 
    formState.channelIdentifier
  )
})

const currentSocialMedia = computed(() => {
  return formState.socialMedia ? (formState.socialMedia as SocialMedia) : undefined
})

const formId = computed(() => props.id || 'channel-create-form')

const projectSelectRef = ref()
const nameInputRef = ref()

function focusFirstField(): void {
  const targets = [
    props.showProjectSelect ? projectSelectRef.value : null,
    nameInputRef.value,
  ].filter(Boolean)

  for (const target of targets) {
    const el = (target?.$el instanceof HTMLElement ? target.$el : target) as HTMLElement | null
    if (!el) continue

    const focusable = el.matches('input,textarea,select,button,[tabindex]:not([tabindex="-1"])')
      ? el
      : el.querySelector<HTMLElement>('input,textarea,select,button,[tabindex]:not([tabindex="-1"])')

    if (!focusable) continue

    try {
      focusable.focus({ preventScroll: true })
    } catch {
      focusable.focus()
    }

    return
  }
}

defineExpose({
  formState,
  isFormValid,
  submit: handleSubmit,
  focusFirstField,
})
</script>

<template>
  <form :id="formId" class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Project Selection (Optional) -->
    <UFormField v-if="props.showProjectSelect" :label="t('channel.project')" required>
      <USelectMenu
        ref="projectSelectRef"
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
      :current-social-media="currentSocialMedia || 'TELEGRAM'"
      :name-input-ref="nameInputRef"
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
