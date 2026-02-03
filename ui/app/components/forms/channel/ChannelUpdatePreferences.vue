<script setup lang="ts">
import { z } from 'zod'
import { createChannelBaseObject } from '~/utils/schemas/channel'
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

const state = reactive({
  preferences: {
    staleChannelsDays: props.channel.preferences?.staleChannelsDays,
  }
})

const schema = computed(() => {
    const full = createChannelBaseObject(t);
    return full.pick({ preferences: true })
})

const isDirty = computed(() => {
    return state.preferences.staleChannelsDays !== props.channel.preferences?.staleChannelsDays
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

// Auto-save setup
const { saveStatus, saveError } = useAutosave({
  data: toRef(() => state),
  saveFn: async () => {
    if (!props.autosave) return
    const updateData = {
        preferences: {
            // Merge with existing preferences to avoid data loss
            ...(props.channel.preferences || {}),
            staleChannelsDays: state.preferences.staleChannelsDays,
        }
    }
    await performUpdate(updateData, true)
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = {
        preferences: {
            // Merge with existing preferences to avoid data loss
            ...(props.channel.preferences || {}),
            staleChannelsDays: event.data.preferences.staleChannelsDays,
        }
    }

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
      <FormsChannelPartsChannelPreferencesFields :state="state" hide-header />
    </div>

    <div class="mt-6 flex justify-end">
      <UiAutosaveStatus 
        v-if="autosave" 
        :status="saveStatus" 
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
