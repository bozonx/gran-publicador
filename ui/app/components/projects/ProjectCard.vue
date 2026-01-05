<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
}>()

const { t, d } = useI18n()
const router = useRouter()
const { getChannelProblemLevel } = useChannels()

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), 'short')
}

function formatDateWithTime(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
          {{ project.name }}
        </h3>
        <UBadge 
          v-if="project.role" 
          :color="getRoleBadgeColor(project.role)" 
          variant="subtle" 
          size="xs"
          class="capitalize"
        >
          {{ t(`roles.${project.role}`) }}
        </UBadge>
      </div>
      
      <div class="shrink-0 flex items-center gap-1.5 text-xs font-bold">
          <UTooltip v-if="project.failedPostsCount" :text="t('channel.failedPosts')">
            <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-800/30">
               <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
               <span>{{ project.failedPostsCount }}</span>
            </div>
          </UTooltip>
          <UTooltip v-if="project.problemPublicationsCount" :text="t('problems.project.problemPublications', { count: project.problemPublicationsCount })">
            <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-800/30">
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
      </div>
    </div>

    <!-- Description -->
    <p v-if="project.description" class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 grow">
      {{ project.description }}
    </p>

    <!-- Metrics -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
        <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-1">
          <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
          <span>{{ t('publication.titlePlural') }}</span>
        </div>
        <div class="text-base font-bold text-gray-900 dark:text-white">
          {{ project.publicationsCount || 0 }}
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
        <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-1">
          <UIcon name="i-heroicons-signal" class="w-3.5 h-3.5" />
          <span>{{ t('channel.titlePlural') }}</span>
        </div>
        <div class="text-base font-bold text-gray-900 dark:text-white">
          {{ project.channelCount || 0 }}
        </div>
      </div>
    </div>

    <!-- Languages & Channels -->
    <div class="space-y-3 mt-auto">
      <div v-if="project.languages?.length" class="flex items-center gap-2">
         <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-gray-400 shrink-0" />
         <div class="flex flex-wrap gap-1">
            <span 
              v-for="lang in project.languages" 
              :key="lang"
              class="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
            >
              {{ lang.split('-')[0] }}
            </span>
         </div>
      </div>

      <div v-if="project.channels?.length" class="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
        <div class="flex -space-x-2">
            <CommonSocialIcon 
              v-for="channel in project.channels.slice(0, 5)" 
              :key="channel.id"
              :platform="channel.socialMedia" 
              :show-background="true" 
              :is-stale="channel.isStale"
              :problem-level="getChannelProblemLevel(channel)"
              class="ring-2 ring-white dark:ring-gray-800 scale-90"
            />
            <div v-if="project.channels.length > 5" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 ring-2 ring-white dark:ring-gray-800">
              +{{ project.channels.length - 5 }}
            </div>
        </div>
      </div>

      <div v-if="project.lastPublicationAt" class="pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 italic flex items-center gap-1">
          <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
          {{ t('project.lastPublication') }}: {{ formatDate(project.lastPublicationAt) }}
      </div>
    </div>
  </div>
</template>
