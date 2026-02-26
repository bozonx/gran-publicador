<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { ChannelCreateInput } from '~/types/channels'
import { getPlatformConfig } from '@gran/shared/social-media-platforms'

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
  note: '',
  isActive: true,
  credentials: {
    telegramChannelId: '',
    telegramBotToken: '',
    vkAccessToken: '',
    apiKey: '',
  },
})

const isProjectLocked = computed(() => !props.showProjectSelect)



// Initialize projects if needed
onMounted(async () => {
  if (props.showProjectSelect && projects.value.length === 0) {
    await fetchProjects()
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

  const config = getPlatformConfig(newSocialMedia as SocialMedia)
  const allowedKeys = new Set((config?.credentials ?? []).map((f) => f.key))

  for (const key of Object.keys(formState.credentials)) {
    if (!allowedKeys.has(key)) {
      ;(formState.credentials as any)[key] = ''
    }
  }
})

function getCredentials(): ChannelCreateInput['credentials'] | undefined {
  if (!formState.socialMedia) return undefined
  const config = getPlatformConfig(formState.socialMedia as SocialMedia)
  if (!config || config.credentials.length === 0) return undefined

  const credentials: Record<string, any> = {}
  for (const field of config.credentials) {
    credentials[field.key] = (formState.credentials as any)[field.key]
  }
  return credentials
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
    note: formState.note || undefined,
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

    const focusable = el.matches('input,textarea,select,button,[collectionindex]:not([collectionindex="-1"])')
      ? el
      : el.querySelector<HTMLElement>('input,textarea,select,button,[collectionindex]:not([collectionindex="-1"])')

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
      <CommonProjectSelect
        ref="projectSelectRef"
        v-model="formState.projectId"
        class="w-full"
        searchable
      />
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
