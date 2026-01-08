<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
  showDescription?: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const { getProjectProblemLevel, getProjectProblems } = useProjects()
const { getChannelProblemLevel } = useChannels()
const { formatDateShort, formatDateWithTime } = useFormatters()

// Problem detection
const problems = computed(() => getProjectProblems(props.project))
const problemLevel = computed(() => getProjectProblemLevel(props.project))

function getIndicatorColor(level: 'critical' | 'warning' | null) {
  if (level === 'critical') return 'bg-red-500'
  if (level === 'warning') return 'bg-yellow-500'
  return 'bg-emerald-500'
}

// Errors category (critical issues)
const errorsCount = computed(() => {
  const p = problems.value.find(p => p.type === 'critical')
  return p ? (p.count || 1) : 0
})

// Warnings category (non-critical issues)
const warningsCount = computed(() => {
  return problems.value.filter(p => p.type === 'warning').length
})

// Tooltip text for errors
const errorsTooltip = computed(() => {
  return problems.value
    .filter(p => p.type === 'critical')
    .map(p => {
      if (p.key === 'failedPosts') return t('channel.failedPosts') + `: ${p.count}`
      return p.key
    })
    .join(', ')
})

// Tooltip text for warnings
const warningsTooltip = computed(() => {
  return problems.value
    .filter(p => p.type === 'warning')
    .map(p => {
      if (p.key === 'problemPublications') return t('problems.project.problemPublications', { count: p.count })
      if (p.key === 'staleChannels') return `${p.count} ` + t('common.stale').toLowerCase()
      if (p.key === 'noRecentActivity') return t('project.noRecentPostsWarning')
      return p.key
    })
    .join(', ')
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
          <!-- Header: Name + Role + Problem Badges -->
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <div 
              class="w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300"
              :class="getIndicatorColor(problemLevel)"
            ></div>
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
            <div class="flex items-center gap-1.5" :title="t('project.publicationsCountTooltip')">
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
                     @click.stop.prevent="router.push(`/publications/${project.lastPublicationId}`)"
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
                :to="`/channels/${channel.id}`"
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
