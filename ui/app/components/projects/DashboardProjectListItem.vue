<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
  showDescription?: boolean
}>()

const { getProjectProblemLevel, getProjectProblems } = useProjects()
const { t, d } = useI18n()

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

const errorsTooltip = computed(() => {
  return problems.value
    .filter(p => p.type === 'critical')
    .map(p => {
      if (p.key === 'failedPosts') return t('channel.failedPosts') + `: ${p.count}`
      if (p.key === 'noCredentials') return t('problems.project.noCredentials', { count: p.count })
      return t(`problems.project.${p.key}`, p.count ? { count: p.count } : {})
    })
    .join(', ')
})

// Tooltip text for warnings
const warningsTooltip = computed(() => {
  return problems.value
    .filter(p => p.type === 'warning')
    .map(p => {
      if (p.key === 'problemPublications') return t('problems.project.problemPublications', { count: p.count })
      if (p.key === 'staleChannels') return t('problems.project.staleChannels', { count: p.count })
      if (p.key === 'noRecentActivity') return t('project.noRecentPostsWarning')
      if (p.key === 'inactiveChannels') return t('problems.project.inactiveChannels', { count: p.count })
      return t(`problems.project.${p.key}`, p.count ? { count: p.count } : {})
    })
    .join(', ')
})

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), 'short')
}
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="block app-card app-card-hover transition-all cursor-pointer"
    :class="{ 'opacity-75 grayscale': project.archivedAt }"
  >
    <div class="p-3 sm:p-3.5">
      <div class="flex items-center justify-between gap-3">
        <!-- Left: Project Title -->
        <div class="flex-1 min-w-0 flex items-center gap-2">
          <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate leading-6">
            {{ project.name }}
          </h3>
        </div>

        <!-- Right: Icons & Badges -->
        <div class="shrink-0 flex items-center gap-1.5">

          <!-- Mini Error Badge -->
          <UTooltip v-if="errorsCount > 0" :text="errorsTooltip">
            <UBadge 
              color="error" 
              variant="soft" 
              size="xs"
            >
              <span class="flex items-center gap-0.5">
                <UIcon name="i-heroicons-x-circle-solid" class="w-3 h-3" />
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
                <UIcon name="i-heroicons-exclamation-triangle-solid" class="w-3 h-3" />
                <span class="font-bold text-[10px]">{{ warningsCount }}</span>
              </span>
            </UBadge>
          </UTooltip>
          
          <!-- Publications Count Badge (Capsule) -->
          <CommonCountBadge 
            :count="project.publicationsCount" 
            :title="t('project.publicationsCountTooltip')" 
            color="neutral"
            variant="solid"
          />

        </div>
      </div>
    </div>
  </NuxtLink>
</template>
