<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
  showDescription?: boolean
}>()

const { t, d } = useI18n()

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), 'short')
}

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
  } else {
    count += 1 // No posts ever is also a warning
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
  } else {
    parts.push(t('project.noRecentPostsWarning'))
  }
  return parts.join(', ')
})
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="block app-card app-card-hover transition-all cursor-pointer"
    :class="{ 'opacity-75 grayscale': project.archivedAt }"
  >
    <div class="p-3 sm:p-3.5">
      <div class="flex items-center justify-between gap-3">
        <!-- Left: Project Title + Publications Count -->
        <div class="flex-1 min-w-0 flex items-center gap-2">
          <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate leading-6">
            {{ project.name }}
          </h3>
          
          <!-- Publications Count Badge (green like CommonCountBadge) -->
          <UBadge 
            color="primary" 
            variant="subtle" 
            size="xs"
            class="shrink-0"
          >
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-document-text" class="w-3 h-3" />
              <span class="font-semibold text-[10px]">{{ project.publicationsCount || 0 }}</span>
            </span>
          </UBadge>
        </div>

        <!-- Right: Problem Badges -->
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
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
