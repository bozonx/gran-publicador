<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { ChannelCreateInput } from '~/types/channels'

const { t } = useI18n()
const { projects, fetchProjects } = useProjects()
const { user } = useAuth()

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
  socialMedia: '' as SocialMedia | '',
  language: user.value?.language || 'en-US',
  channelIdentifier: '',
  description: '',
  isActive: true
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
    isActive: formState.isActive
  })
}

const isFormValid = computed(() => {
  return !!(formState.projectId && formState.name && formState.socialMedia && formState.channelIdentifier)
})

defineExpose({
  formState,
  isFormValid,
  submit: handleSubmit
})
</script>

<template>
  <form :id="$attrs.id as string || 'channel-create-form'" @submit.prevent="handleSubmit" class="space-y-6">
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
      :current-social-media="(formState.socialMedia as SocialMedia)"
    />

    <slot name="extra-fields" :state="formState" />
  </form>
</template>
