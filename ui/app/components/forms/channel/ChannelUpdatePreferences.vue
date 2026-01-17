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

const state = reactive({
  preferences: {
    staleChannelsDays: props.channel.preferences?.staleChannelsDays,
  }
})

const schema = computed(() => {
    const full = createChannelSchema({ t } as any);
    return full.pick({ preferences: true })
})

const isDirty = computed(() => {
    return state.preferences.staleChannelsDays !== props.channel.preferences?.staleChannelsDays
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = {
        preferences: {
            // Merge with existing preferences to avoid data loss?
            // Since we only edit staleChannelsDays here, we should be careful.
            // But updateChannel simply passes data to Prisma.
            // We should ideally fetch fresh channel or just send what we have.
            // Wait, if we send { preferences: { stale: 1 } }, does Prisma replacement?
            // Yes, Prisma JSON set usually replaces the whole object unless we use specific JSON ops which NestJS Prisma service might not do.
            // But here we are safe if we include footers? NO, we don't include footers here!
            // This is DANGEROUS duplication logic.
            // We MUST include other preference fields (like footers) if we are replacing the object.
            
            ...(props.channel.preferences || {}),
            staleChannelsDays: event.data.preferences.staleChannelsDays,
        }
    }

    const result = await updateChannel(props.channel.id, updateData)
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
