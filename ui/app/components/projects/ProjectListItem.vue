<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
  showDescription?: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const { getChannelProblemLevel } = useChannels()
const { formatDateShort, formatDateWithTime } = useFormatters()
const isWarningActive = computed(() => {
  if (!props.project.lastPublicationAt) return false // Fix: don't show warning if no publications at all, just stale if channels exist
  
  const lastDate = new Date(props.project.lastPublicationAt).getTime()
  const now = new Date().getTime()
  const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24)
  
  return diffDays > 3
})
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="block app-card app-card-hover transition-all cursor-pointer"
    :class="{ 'opacity-75 grayscale': project.archivedAt }"
  >
    <div class="p-4 sm:p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <!-- Header: Name + Role -->
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate max-w-full">
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

          <!-- Stale/Inactivity Warnings -->
          <div v-if="isWarningActive || project.staleChannelsCount" class="flex flex-wrap gap-2 mb-3">
            <CommonWarningBadge
              v-if="isWarningActive"
              icon="i-heroicons-exclamation-triangle"
              :text="t('project.noRecentPostsWarning')"
              variant="warning"
            />

            <CommonWarningBadge
              v-if="project.staleChannelsCount"
              icon="i-heroicons-clock"
              :text="`${project.staleChannelsCount} ${t('common.stale').toLowerCase()}`"
              variant="warning"
            />
          </div>

          <!-- Description (optional) -->
          <p 
            v-if="showDescription && project.description" 
            class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2"
          >
            {{ project.description }}
          </p>
          <!-- Metrics / Stats -->
          <div class="flex items-center gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 flex-wrap">
            <div class="flex items-center gap-1.5" :title="t('publication.titlePlural')">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 shrink-0" />
              <span>
                {{ project.publicationsCount || 0 }} {{ t('publication.titlePlural').toLowerCase() }}
              </span>
            </div>
            
            <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>

            <div class="flex items-center gap-1.5" :title="t('channel.titlePlural')">
              <UIcon name="i-heroicons-signal" class="w-4 h-4 shrink-0" />
              <span>
                {{ project.channelCount || 0 }} {{ t('channel.titlePlural').toLowerCase() }}
              </span>
            </div>

            <template v-if="project.failedPostsCount">
              <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold" :title="t('channel.failedPosts')">
                <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
                <span>
                   {{ project.failedPostsCount }}
                </span>
              </div>
            </template>

            <template v-if="project.problemPublicationsCount">
              <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div class="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold" :title="t('problems.project.problemPublications', { count: project.problemPublicationsCount })">
                <UIcon name="i-heroicons-document-exclamation" class="w-4 h-4 shrink-0" />
                <span>
                   {{ project.problemPublicationsCount }}
                </span>
              </div>
            </template>

            <template v-if="project.languages?.length">
              <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 shrink-0" />
                <span class="uppercase">
                  {{ project.languages.map(l => l.split('-')[0]).join(', ') }}
                </span>
              </div>
            </template>

            <template v-if="project.lastPublicationAt">
              <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>

              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-clock" class="w-4 h-4 shrink-0" />
                <span>
                   {{ t('project.lastPublication') }}:
                   <span 
                     class="text-primary-500 hover:text-primary-400 transition-colors cursor-pointer font-medium underline decoration-dotted decoration-primary-500/30 underline-offset-2"
                     @click.stop.prevent="router.push(`/projects/${project.id}/publications/${project.lastPublicationId}`)"
                   >
                     {{ formatDateWithTime(project.lastPublicationAt) }}
                   </span>
                </span>
              </div>
            </template>
          </div>

          <!-- Channels -->
          <div v-if="project.channels?.length" class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
            <UTooltip 
              v-for="channel in project.channels" 
              :key="channel.id" 
              :text="channel.name"
            >
              <NuxtLink 
                :to="`/projects/${project.id}/channels/${channel.id}`"
                class="hover:opacity-80 transition-opacity"
                @click.stop
              >
                <CommonSocialIcon 
                  :platform="channel.socialMedia" 
                  :show-background="true" 
                  :is-stale="channel.isStale"
                  :problem-level="getChannelProblemLevel(channel)"
                />
              </NuxtLink>
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
