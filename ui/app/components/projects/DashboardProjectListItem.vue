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

// Warning if no new posts for more than 3 days
const isWarningActive = computed(() => {
  if (!props.project.lastPublicationAt) return true // No posts ever is also a warning
  
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
    <div class="p-3 sm:p-3.5">
      <div class="flex items-start justify-between gap-6">
        <div class="flex-1 min-w-0">
          <!-- Project Title -->
          <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate leading-6">
            {{ project.name }}
          </h3>

          <!-- Warning: 3+ days without posts -->
          <div v-if="isWarningActive" class="mt-2 flex items-center gap-1.5 text-xs leading-none text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-md w-fit border border-amber-100/50 dark:border-amber-800/30">
             <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 shrink-0" />
             <span class="truncate">
                {{ t('project.noRecentPostsWarning') }}
             </span>
          </div>

          <!-- Stale Channels Warning -->
          <div v-if="project.staleChannelsCount" class="mt-2 flex items-center gap-1.5 text-xs leading-none text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-900/20 px-2 py-1.5 rounded-md w-fit border border-orange-100/50 dark:border-orange-800/30">
             <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5 shrink-0" />
             <span class="truncate">
                {{ project.staleChannelsCount }} {{ t('common.stale').toLowerCase() }}
             </span>
          </div>
        </div>

        <!-- Right Side: Publications Count -->
        <div class="shrink-0 pt-0.5">
          <UBadge 
            color="neutral" 
            variant="soft" 
            size="sm"
            class="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-700/50 shadow-sm"
          >
            <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span class="font-bold text-xs text-gray-700 dark:text-gray-200">{{ project.publicationsCount || 0 }}</span>
          </UBadge>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
