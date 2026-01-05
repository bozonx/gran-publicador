<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
}>()

const { t } = useI18n()
const { formatDateShort } = useFormatters()

const isWarningActive = computed(() => {
  if (!props.project.lastPublicationAt) return false
  
  const lastDate = new Date(props.project.lastPublicationAt).getTime()
  const now = new Date().getTime()
  const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24)
  
  return diffDays > 3
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
        <UTooltip v-if="project.failedPostsCount" :text="t('channel.failedPosts')">
          <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-800/30 text-xs font-bold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
            <span>{{ project.failedPostsCount }}</span>
          </div>
        </UTooltip>
        <UTooltip v-if="project.problemPublicationsCount" :text="t('problems.project.problemPublications', { count: project.problemPublicationsCount })">
          <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-800/30 text-xs font-bold">
            <UIcon name="i-heroicons-document-exclamation" class="w-4 h-4" />
            <span>{{ project.problemPublicationsCount }}</span>
          </div>
        </UTooltip>
        <UTooltip v-if="isWarningActive" :text="t('project.noRecentPostsWarning')">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-500" />
        </UTooltip>
        <UTooltip v-if="project.staleChannelsCount" :text="`${project.staleChannelsCount} ${t('common.stale').toLowerCase()}`">
          <UIcon name="i-heroicons-clock" class="w-5 h-5 text-orange-500" />
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
