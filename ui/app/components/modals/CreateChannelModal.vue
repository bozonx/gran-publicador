<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { ChannelCreateInput } from '~/types/channels'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'created', channelId: string, projectId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  initialProjectId?: string
  showProjectSelect?: boolean
}>()

const { createChannel, isLoading } = useChannels()

const createFormRef = ref()

const modalRootRef = ref<HTMLElement | null>(null)

useModalAutoFocus({
  open: isOpen,
  root: modalRootRef,
  candidates: [{ target: createFormRef }],
})

async function handleCreate(data: ChannelCreateInput) {
  try {
    const channel = await createChannel(data)

    if (channel) {
      isOpen.value = false
      emit('created', channel.id, data.projectId)
    }
  } catch (error: any) {
    // Error handled by useChannels
  }
}

function handleClose() {
  isOpen.value = false
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('channel.createChannel')" :ui="{ content: 'sm:max-w-2xl' }">
    <div ref="modalRootRef">
      <FormsChannelCreateForm
        id="create-channel-form"
        ref="createFormRef"
        :initial-project-id="props.initialProjectId"
        :show-project-select="props.showProjectSelect ?? !props.initialProjectId"
        @submit="handleCreate"
      />
    </div>

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
        :disabled="!createFormRef?.isFormValid" 
        form="create-channel-form"
        type="submit"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
