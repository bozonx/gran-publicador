<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { useChannels } from '~/composables/useChannels'

interface Props {
  modelValue: string[]
  projectId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:projectId': [value: string | null]
}>()

const { t } = useI18n()
const { projects, fetchProjects } = useProjects()
const { channels, fetchChannels } = useChannels()

onMounted(async () => {
  await Promise.all([
    fetchProjects(true),
    fetchChannels()
  ])
})

const activeProjectsOptions = computed(() => 
  projects.value
    .filter(p => !p.archivedAt)
    .map(p => ({ value: p.id, label: p.name }))
)

const projectChannelsOptions = computed(() => {
  if (!props.projectId) return []
  return channels.value
    .filter(c => c.projectId === props.projectId && !c.archivedAt)
    .map(c => ({ value: c.id, label: c.name }))
})

const currentProjectId = computed({
  get: () => props.projectId,
  set: (val) => {
    emit('update:projectId', val)
    // When project changes, clear channel selection if they don't belong to the new project
    emit('update:modelValue', [])
  }
})

const selectedChannelIds = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Project Selection -->
    <UFormField :label="t('project.title')" :help="t('publication.projectSelectorHelp')">
      <USelectMenu
        :model-value="currentProjectId as string | undefined"
        @update:model-value="currentProjectId = $event"
        :items="activeProjectsOptions"
        value-key="value"
        label-key="label"
        class="w-full"
        :placeholder="t('publication.select_project')"
      >
        <template #leading>
          <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
        </template>
      </USelectMenu>
    </UFormField>

    <!-- Channels Selection -->
    <UFormField 
      v-if="currentProjectId" 
      :label="t('channel.titlePlural')" 
      :help="t('publication.channelsSelectorHelp')"
    >
      <USelectMenu
        v-model="selectedChannelIds"
        :items="projectChannelsOptions"
        value-key="value"
        label-key="label"
        multiple
        class="w-full"
        :placeholder="t('publication.select_channels')"
      >
        <template #default>
          <span v-if="selectedChannelIds.length">
            {{ t('common.selected', { count: selectedChannelIds.length }) }}
          </span>
          <span v-else>{{ t('publication.select_channels') }}</span>
        </template>
      </USelectMenu>
    </UFormField>
    
    <UAlert
      v-else
      color="info"
      variant="soft"
      icon="i-heroicons-information-circle"
      :title="t('publication.select_project_first')"
    />
  </div>
</template>
