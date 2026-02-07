<script setup lang="ts">
import { z } from 'zod'
import { createChannelBaseObject, channelRefinement } from '~/utils/schemas/channel'
import type { ChannelWithProject } from '~/types/channels'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FORM_SPACING } from '~/utils/design-tokens'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'

interface Props {
  channel: ChannelWithProject
  disabled?: boolean
  autosave?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    autosave: false
})
const emit = defineEmits(['success'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel, isLoading } = useChannels()

// State
const state = reactive({
  socialMedia: props.channel.socialMedia,
  credentials: {
     telegramChannelId: props.channel.credentials?.telegramChannelId || props.channel.credentials?.chatId || '',
     telegramBotToken: props.channel.credentials?.telegramBotToken || props.channel.credentials?.botToken || '',
     vkAccessToken: props.channel.credentials?.vkAccessToken || props.channel.credentials?.accessToken || '',
  }
})

const schema = computed(() => {
    // We need to pass t to schema
    const full = createChannelBaseObject(t);
    return full.pick({ socialMedia: true, credentials: true }).superRefine(channelRefinement(t))
})

const isDirty = computed(() => {
    return JSON.stringify(state.credentials) !== JSON.stringify({
        telegramChannelId: props.channel.credentials?.telegramChannelId || props.channel.credentials?.chatId || '',
        telegramBotToken: props.channel.credentials?.telegramBotToken || props.channel.credentials?.botToken || '',
        vkAccessToken: props.channel.credentials?.vkAccessToken || props.channel.credentials?.accessToken || '',
    })
})

async function performUpdate(data: any, silent: boolean = false) {
    const result = await updateChannel(props.channel.id, data)
    if (result) {
        emit('success', result)
        if (!silent) {
            toast.add({
                title: t('common.success'), description: t('common.saved'), color: 'success'
            })
        }
    }
    return result
}

function prepareUpdateData(formData: any) {
    let credentials = {}
    if (props.channel.socialMedia === 'TELEGRAM') {
        credentials = {
            telegramChannelId: formData.credentials.telegramChannelId,
            telegramBotToken: formData.credentials.telegramBotToken,
        }
    } else if (props.channel.socialMedia === 'VK') {
        credentials = {
            vkAccessToken: formData.credentials.vkAccessToken,
        }
    }
    return { credentials }
}

// Auto-save setup
const { saveStatus, saveError, isIndicatorVisible, indicatorStatus } = useAutosave({
  data: toRef(() => state),
  saveFn: async () => {
    if (!props.autosave) return { saved: false, skipped: true }
    
    // Simple validation: check if relevant credentials are not empty
    const updateData = prepareUpdateData(state)
    const creds = updateData.credentials as any
    const isEmpty = props.channel.socialMedia === 'TELEGRAM' 
        ? (!creds.telegramBotToken || !creds.telegramChannelId)
        : (props.channel.socialMedia === 'VK' ? !creds.vkAccessToken : false)

    if (isEmpty) return { saved: false, skipped: true }

    await performUpdate(updateData, true)
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = prepareUpdateData(event.data)
    await performUpdate(updateData, false)
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
        :current-social-media="props.channel.socialMedia"
        hide-header
      />
    </div>

    <div class="mt-6 flex justify-end">
      <UiSaveStatusIndicator 
        v-if="autosave" 
        :status="indicatorStatus" 
        :visible="isIndicatorVisible"
        :error="saveError" 
      />
      <UiFormActions
        v-else
        :loading="isLoading"
        :is-dirty="isDirty"
        :disabled="disabled"
        :save-label="t('common.save')"
        hide-cancel
        show-border
        class="w-full"
      />
    </div>
  </UForm>
</template>
