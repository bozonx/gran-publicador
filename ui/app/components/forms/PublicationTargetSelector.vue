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

onMounted(async () => {
  await fetchProjects(true)
})




const currentProjectId = computed({
  get: () => props.projectId,
  set: (val) => {
    emit('update:projectId', val)
    // When project changes, clear channel selection if they don't belong to the new project
    emit('update:modelValue', [])
  }
})

const currentProjectIdValue = computed(() => currentProjectId.value || undefined)

const selectedChannelIds = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Project Selection -->
    <UFormField :label="t('project.title')" :help="t('publication.projectSelectorHelp')">
      <CommonProjectSelect
        :model-value="currentProjectIdValue"
        class="w-full"
        @update:model-value="currentProjectId = $event"
      />
    </UFormField>

    <!-- Channels Selection -->
    <UFormField 
      v-if="currentProjectId" 
      :label="t('channel.titlePlural')" 
      :help="t('publication.channelsSelectorHelp')"
    >
      <CommonChannelSelect
        v-model="selectedChannelIds"
        :project-id="currentProjectId"
        multiple
      />
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
