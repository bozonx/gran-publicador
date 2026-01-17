<script setup lang="ts">
import { z } from 'zod'
import { createChannelSchema } from '~/utils/schemas/channel'
import type { ChannelWithProject } from '~/types/channels'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

interface Props {
  channel: ChannelWithProject
  projectId: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel, isLoading } = useChannels()
const { projects, fetchProjects } = useProjects()

// State
const state = reactive({
  name: props.channel.name,
  description: props.channel.description || '',
  socialMedia: props.channel.socialMedia,
  channelIdentifier: props.channel.channelIdentifier,
  language: props.channel.language,
  projectId: props.channel.projectId,
  tags: props.channel.tags || '',
})

// Schema - extract only relevant parts or use full schema?
// If we use full schema, other fields might be missing in state and cause validation error if required.
// We should construct a partial schema.
const schema = computed(() => {
    const fullSchema = createChannelSchema({ t } as any);
    // Pick only general fields
    return fullSchema.pick({
        name: true,
        description: true,
        channelIdentifier: true,
        language: true, 
        socialMedia: true, 
        tags: true,
        // projectId is not in schema? Checked createChannelSchema, it wasn't there explicitly?
        // Checked file content again: createChannelSchema didn't have projectId? 
        // Ah, projectId was passed in create data but maybe not validated in Zod?
        // Double check schema file content.
    })
})

const isDirty = computed(() => {
    return state.name !== props.channel.name ||
           state.description !== (props.channel.description || '') ||
           state.channelIdentifier !== props.channel.channelIdentifier ||
           state.tags !== (props.channel.tags || '')
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = {
      name: event.data.name,
      description: event.data.description || null,
      channelIdentifier: event.data.channelIdentifier,
      tags: event.data.tags || null,
    }

    const result = await updateChannel(props.channel.id, updateData)
    if (result) {
        emit('success', result)
        toast.add({
            title: t('common.success'), 
            description: t('common.saved'), 
            color: 'success'
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

// Fetch projects
onMounted(() => {
    if (projects.value.length === 0) fetchProjects()
})

const currentProjectName = computed(() => {
  if (props.channel?.project?.name) return props.channel.project.name
  const project = projects.value.find(p => p.id === props.channel.projectId)
  return project?.name
})
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="handleSubmit">
    <div :class="FORM_SPACING.fields">
      <FormsChannelPartsChannelGeneralFields
        :state="state"
        :is-edit-mode="true"
        :channel="channel"
        :current-project-name="currentProjectName"
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
