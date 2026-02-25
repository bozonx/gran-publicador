<script setup lang="ts">
import { z } from 'zod'
import { createChannelBaseObject } from '~/utils/schemas/channel'
import type { ChannelWithProject } from '~/types/channels'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { formatTagsCsv, parseTags } from '~/utils/tags'

interface Props {
  channel: ChannelWithProject
  projectId: string
  disabled?: boolean
  autosave?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    autosave: false
})
const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel, isLoading } = useChannels()
const { projects, fetchProjects } = useProjects()

// State
const state = reactive({
  name: props.channel.name,
  note: props.channel.note || '',
  socialMedia: props.channel.socialMedia,
  channelIdentifier: props.channel.channelIdentifier,
  language: props.channel.language,
  projectId: props.channel.projectId,
  tags: props.channel.tags || '',
})

// Schema
const schema = computed(() => {
    const fullSchema = createChannelBaseObject(t);
    return fullSchema.pick({
        name: true,
        note: true,
        channelIdentifier: true,
        language: true, 
        socialMedia: true, 
        tags: true,
    })
})

const tagsModel = computed<string[]>({
  get: () => parseTags(state.tags),
  set: (value) => {
    state.tags = formatTagsCsv(value)
  },
})

const isDirty = computed(() => {
    return state.name !== props.channel.name ||
           state.note !== (props.channel.note || '') ||
           state.channelIdentifier !== props.channel.channelIdentifier ||
           state.tags !== (props.channel.tags || '')
})

async function performUpdate(data: any, silent: boolean = false) {
    const result = await updateChannel(props.channel.id, data)
    if (result) {
        emit('success', result)
        if (!silent) {
            toast.add({
                title: t('common.success'), 
                description: t('common.saved'), 
                color: 'success'
            })
        }
    }
    return result
}

// Auto-save setup
const { saveStatus, saveError, isIndicatorVisible, indicatorStatus, retrySave } = useAutosave({
  data: toRef(() => state),
  saveFn: async () => {
    if (!props.autosave) return { saved: false, skipped: true }
    
    // Simple validation for autosave
    if (!state.name) return { saved: false, skipped: true }

    const updateData = {
      name: state.name,
      note: state.note || null,
      channelIdentifier: state.channelIdentifier,
      tags: state.tags || null,
      version: props.channel.version,
    }
    await performUpdate(updateData, true)
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

async function handleSubmit(event: FormSubmitEvent<any>) {
  try {
    const updateData = {
      name: event.data.name,
      note: event.data.note || null,
      channelIdentifier: event.data.channelIdentifier,
      tags: event.data.tags || null,
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
        :project-id="projectId"
        :current-project-name="currentProjectName"
        :current-social-media="channel.socialMedia"
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
