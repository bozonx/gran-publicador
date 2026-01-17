<script setup lang="ts">
import { z } from 'zod'
import { createChannelSchema } from '~/utils/schemas/channel'
import type { ChannelWithProject } from '~/types/channels'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FORM_SPACING } from '~/utils/design-tokens'

interface Props {
  channel: ChannelWithProject
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['success'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel, isLoading } = useChannels()

// State
const state = reactive({
  socialMedia: props.channel.socialMedia,
  credentials: {
    telegramChannelId: props.channel.credentials?.telegramChannelId || '',
    telegramBotToken: props.channel.credentials?.telegramBotToken || '',
    vkAccessToken: props.channel.credentials?.vkAccessToken || '',
  }
})

const schema = computed(() => {
    // We need to pass t to schema
    const full = createChannelSchema({ t } as any);
    return full.pick({ socialMedia: true, credentials: true }).superRefine((val, ctx) => {
        // Copy refine logic or reuse?
        // Reuse is hard because superRefine is attached to object.
        // We can just manually add it here or duplicate logic.
        // Duplication is 5 lines.
        if (val.socialMedia === 'TELEGRAM') {
            if (!val.credentials.telegramChannelId) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('validation.required'), path: ['credentials', 'telegramChannelId']})
            }
            if (!val.credentials.telegramBotToken) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('validation.required'), path: ['credentials', 'telegramBotToken']})
            }
        } else if (val.socialMedia === 'VK') {
            if (!val.credentials.vkAccessToken) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('validation.required'), path: ['credentials', 'vkAccessToken']})
            }
        }
    })
})

const isDirty = computed(() => {
    return JSON.stringify(state.credentials) !== JSON.stringify({
        telegramChannelId: props.channel.credentials?.telegramChannelId || '',
        telegramBotToken: props.channel.credentials?.telegramBotToken || '',
        vkAccessToken: props.channel.credentials?.vkAccessToken || '',
    })
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    let credentials = {}
    if (props.channel.socialMedia === 'TELEGRAM') {
        credentials = {
            telegramChannelId: event.data.credentials.telegramChannelId,
            telegramBotToken: event.data.credentials.telegramBotToken,
        }
    } else if (props.channel.socialMedia === 'VK') {
        credentials = {
            vkAccessToken: event.data.credentials.vkAccessToken,
        }
    }

    const result = await updateChannel(props.channel.id, { credentials })
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
