<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
}>()

const { t } = useI18n()
const { formatDateShort } = useFormatters()

// Errors category (critical issues)
const errorsCount = computed(() => {
  return (props.project.failedPostsCount || 0)
})

// Warnings category (non-critical issues)
const warningsCount = computed(() => {
  let count = 0
  count += (props.project.problemPublicationsCount || 0)
  count += (props.project.staleChannelsCount || 0)
  
  // Check if no posts for more than 3 days
  if (props.project.lastPublicationAt) {
    const lastDate = new Date(props.project.lastPublicationAt).getTime()
    const now = new Date().getTime()
    const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24)
    if (diffDays > 3) count += 1
  }
  
  return count
})

// Tooltip text for errors
const errorsTooltip = computed(() => {
  const parts: string[] = []
  if (props.project.failedPostsCount) {
    parts.push(t('channel.failedPosts'))
  }
  return parts.join(', ')
})

// Tooltip text for warnings
const warningsTooltip = computed(() => {
  const parts: string[] = []
  if (props.project.problemPublicationsCount) {
    parts.push(t('problems.project.problemPublications', { count: props.project.problemPublicationsCount }))
  }
  if (props.project.staleChannelsCount) {
    parts.push(`${props.project.staleChannelsCount} ${t('common.stale').toLowerCase()}`)
  }
  if (props.project.lastPublicationAt) {
    const lastDate = new Date(props.project.lastPublicationAt).getTime()
    const now = new Date().getTime()
    const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24)
    if (diffDays > 3) {
      parts.push(t('project.noRecentPostsWarning'))
    }
  }
  return parts.join(', ')
})
</script>

<template>
  <div
    class="app-card app-card-hover p-5 cursor-pointer flex flex-col h-full relative"
    :class="{ 'opacity-75 grayscale': project.archivedAt }"
    @click="navigateTo(`/projects/${project.id}`)"
  >
    <!-- Header: Name + Role -->
    <CommonEntityCardHeader
      :title="project.name"
      :badge="project.role ? t(`roles.${project.role}`) : undefined"
      :badge-color="project.role ? getRoleBadgeColor(project.role) : undefined"
    >
      <template #actions>
        <!-- Mini Error Badge -->
        <UTooltip v-if="errorsCount > 0" :text="errorsTooltip">
          <UBadge 
            color="error" 
            variant="soft" 
            size="xs"
          >
            <span class="flex items-center gap-0.5">
              <UIcon name="i-heroicons-x-circle-solid" class="w-3.5 h-3.5" />
              <span class="font-bold text-[10px]">{{ errorsCount }}</span>
            </span>
          </UBadge>
        </UTooltip>

        <!-- Mini Warning Badge -->
        <UTooltip v-if="warningsCount > 0" :text="warningsTooltip">
          <UBadge 
            color="warning" 
            variant="soft" 
            size="xs"
          >
            <span class="flex items-center gap-0.5">
              <UIcon name="i-heroicons-exclamation-triangle-solid" class="w-3.5 h-3.5" />
              <span class="font-bold text-[10px]">{{ warningsCount }}</span>
            </span>
          </UBadge>
        </UTooltip>
      </template>
    </CommonEntityCardHeader>

    <!-- Description -->
    <CommonCardDescription :text="project.description" />

    <!-- Metrics -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <CommonMetricBox
        icon="i-heroicons-document-text"
        :label="t('publication.titlePlural')"
        :value="project.publicationsCount || 0"
      />
      <CommonMetricBox
        icon="i-heroicons-signal"
        :label="t('channel.titlePlural')"
        :value="project.channelCount || 0"
      />
    </div>

    <!-- Languages & Channels -->
    <div class="space-y-3 mt-auto">
      <CommonLanguageBadges
        v-if="project.languages?.length"
        :languages="project.languages"
      />

      <div v-if="project.channels?.length" class="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
        <CommonChannelIcons :channels="project.channels" />
      </div>

      <div v-if="project.lastPublicationAt" class="pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 italic flex items-center gap-1">
        <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
        {{ t('project.lastPublication') }}: {{ formatDateShort(project.lastPublicationAt) }}
      </div>
    </div>
  </div>
</template>
