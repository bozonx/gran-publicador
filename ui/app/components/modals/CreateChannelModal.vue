<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import { FORM_STYLES } from '~/utils/design-tokens'

const { t } = useI18n()
const toast = useToast()

const emit = defineEmits<{
  (e: 'created', channelId: string, projectId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { projects, fetchProjects } = useProjects()
const { createChannel, isLoading } = useChannels()
const { languageOptions } = useLanguages()

const formState = reactive({
  projectId: '',
  name: '',
  socialMedia: '' as SocialMedia | '',
  language: 'ru-RU',
  channelIdentifier: '',
  description: ''
})

// Load projects when modal opens
watch(isOpen, async (open) => {
  if (open) {
    await fetchProjects()
    resetForm()
  }
})

function resetForm() {
  formState.projectId = projects.value[0]?.id || ''
  formState.name = ''
  formState.socialMedia = '' as SocialMedia | ''
  formState.language = 'ru-RU'
  formState.channelIdentifier = ''
  formState.description = ''
}

// Social media options
const socialMediaOptions = computed(() => [
  { value: 'TELEGRAM', label: t('socialMedia.telegram'), icon: 'i-heroicons-paper-airplane' },
  { value: 'VK', label: t('socialMedia.vk'), icon: 'i-heroicons-share' },
  { value: 'YOUTUBE', label: t('socialMedia.youtube'), icon: 'i-heroicons-video-camera' },
  { value: 'INSTAGRAM', label: t('socialMedia.instagram'), icon: 'i-heroicons-camera' },
  { value: 'TIKTOK', label: t('socialMedia.tiktok'), icon: 'i-heroicons-musical-note' },
  { value: 'X', label: t('socialMedia.x'), icon: 'i-heroicons-at-symbol' },
  { value: 'FACEBOOK', label: t('socialMedia.facebook'), icon: 'i-heroicons-user-group' },
  { value: 'LINKEDIN', label: t('socialMedia.linkedin'), icon: 'i-heroicons-briefcase' },
  { value: 'SITE', label: t('socialMedia.site'), icon: 'i-heroicons-globe-alt' }
])

// Project options
const projectOptions = computed(() => 
  projects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
)

async function handleCreate() {
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
  <AppModal v-model:open="isOpen" :title="t('channel.createChannel')">
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

      <!-- Name -->
      <UFormField :label="t('channel.name')" required>
        <UInput 
          v-model="formState.name" 
          :placeholder="t('channel.namePlaceholder')" 
          class="w-full" 
          size="lg" 
        />
      </UFormField>

      <!-- Social Media -->
      <UFormField :label="t('channel.socialMedia')" required>
        <USelectMenu
          v-model="formState.socialMedia"
          :items="socialMediaOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        >
          <template #leading>
            <UIcon name="i-heroicons-share" class="w-4 h-4" />
          </template>
        </USelectMenu>
      </UFormField>

      <!-- Language -->
      <UFormField :label="t('channel.language')" required>
        <USelectMenu
          v-model="formState.language"
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

      <!-- Description -->
      <UFormField :label="t('channel.description')" :help="t('common.optional')">
        <UTextarea 
          v-model="formState.description" 
          :placeholder="t('channel.descriptionPlaceholder')" 
          :rows="FORM_STYLES.textareaRows" 
          autoresize
          class="w-full" 
        />
      </UFormField>

      <!-- Channel Identifier -->
      <UFormField :label="t('channel.identifier')" required :help="t('channel.identifierHelp')">
         <UInput 
          v-model="formState.channelIdentifier" 
          :placeholder="t('channel.identifierPlaceholder')" 
          class="w-full" 
        />
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
        color="primary" 
        :loading="isLoading" 
        :disabled="!formState.name || !formState.projectId || !formState.socialMedia || !formState.channelIdentifier" 
        form="create-channel-form"
        type="submit"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </AppModal>
</template>
