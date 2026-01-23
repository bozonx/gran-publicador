<script setup lang="ts">
import { z } from 'zod'
import { createChannelBaseObject, channelRefinement } from '~/utils/schemas/channel'
import type { ChannelWithProject } from '~/types/channels'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FORM_SPACING } from '~/utils/design-tokens'

interface Props {
  channel: ChannelWithProject
  disabled?: boolean
}

const { channel, disabled = false } = defineProps<Props>()
const emit = defineEmits(['success'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel, isLoading } = useChannels()

// State
const state = reactive({
  socialMedia: channel.socialMedia,
  credentials: {
    chatId: channel.credentials?.chatId || channel.credentials?.telegramChannelId || '',
    botToken: channel.credentials?.botToken || channel.credentials?.telegramBotToken || '',
    accessToken: channel.credentials?.accessToken || channel.credentials?.vkAccessToken || '',
  }
})

const schema = computed(() => {
    // We need to pass t to schema
    const full = createChannelBaseObject(t);
    return full.pick({ socialMedia: true, credentials: true }).superRefine(channelRefinement(t))
})

const isDirty = computed(() => {
    return JSON.stringify(state.credentials) !== JSON.stringify({
        chatId: channel.credentials?.chatId || channel.credentials?.telegramChannelId || '',
        botToken: channel.credentials?.botToken || channel.credentials?.telegramBotToken || '',
        accessToken: channel.credentials?.accessToken || channel.credentials?.vkAccessToken || '',
    })
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    let credentials = {}
    if (channel.socialMedia === 'TELEGRAM') {
        credentials = {
            chatId: event.data.credentials.chatId,
            botToken: event.data.credentials.botToken,
        }
    } else if (channel.socialMedia === 'VK') {
        credentials = {
            accessToken: event.data.credentials.accessToken,
        }
    }

    const result = await updateChannel(channel.id, { credentials })
    if (result) {
        emit('success', result)
        toast.add({
            title: t('common.success'), description: t('common.saved'), color: 'success'
        })
    }
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: t('common.saveError'),
      color: 'error'
    })
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="handleSubmit">
    <div :class="FORM_SPACING.fields">
      <FormsChannelPartsChannelCredentialsFields
        :state="state"
        :current-social-media="channel.socialMedia"
      />
    </div>

    <UiFormActions
      :loading="isLoading"
      :is-dirty="isDirty"
      :disabled="disabled"
      :save-label="t('common.save')"
      hide-cancel
      show-border
      class="mt-6"
    />
  </UForm>
</template>
