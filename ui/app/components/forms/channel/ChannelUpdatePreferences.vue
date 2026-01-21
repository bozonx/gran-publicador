<script setup lang="ts">
import { z } from 'zod'
import { createChannelBaseObject } from '~/utils/schemas/channel'
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

const state = reactive({
  preferences: {
    staleChannelsDays: channel.preferences?.staleChannelsDays,
  }
})

const schema = computed(() => {
    const full = createChannelBaseObject(t);
    return full.pick({ preferences: true })
})

const isDirty = computed(() => {
    return state.preferences.staleChannelsDays !== channel.preferences?.staleChannelsDays
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = {
        preferences: {
            // Merge with existing preferences to avoid data loss
            ...(channel.preferences || {}),
            staleChannelsDays: event.data.preferences.staleChannelsDays,
        }
    }

    const result = await updateChannel(channel.id, updateData)
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
      <FormsChannelPartsChannelPreferencesFields :state="state" />
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
