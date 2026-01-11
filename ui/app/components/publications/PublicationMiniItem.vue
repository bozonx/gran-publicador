<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

const props = defineProps<{
  publication: PublicationWithRelations
  showStatus?: boolean
  showDate?: boolean
  dateType?: 'scheduled' | 'created'
  isProblematic?: boolean
}>()

const { t } = useI18n()
const { getStatusColor, getStatusDisplayName } = usePublications()
const { getPublicationDisplayTitle, formatDateWithTime } = useFormatters()

const displayTitle = computed(() => getPublicationDisplayTitle(props.publication))

const displayDate = computed(() => {
  const date = props.dateType === 'scheduled' 
    ? (props.publication.scheduledAt || (props.publication as any).postScheduledAt)
    : props.publication.createdAt
  
  if (!date) return null
  return formatDateWithTime(date)
})

// Check for problem level if needed, but for now we just use isProblematic flag or status
</script>

<template>
  <NuxtLink
    :to="`/publications/${publication.id}`"
    class="block p-3.5 hover:bg-white dark:hover:bg-gray-700/50 transition-all rounded-xl group border shadow-sm hover:shadow-md"
    :class="[
      isProblematic 
        ? 'bg-red-50/30 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-300 dark:hover:border-red-700' 
        : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:border-primary-500/30 dark:hover:border-primary-500/30'
    ]"
  >
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-2 mb-1">
          <UBadge
            v-if="showStatus"
            :color="getStatusColor(publication.status) as any"
            variant="subtle"
            size="xs"
            class="shrink-0 mt-0.5"
          >
            {{ getStatusDisplayName(publication.status) }}
          </UBadge>
          <div 
            class="text-sm text-gray-700 dark:text-gray-200 line-clamp-2 font-medium group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
            :class="{ 'text-red-700 dark:text-red-300': isProblematic }"
          >
            {{ displayTitle }}
          </div>
        </div>
        <div v-if="showDate && displayDate" class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <UIcon v-if="dateType === 'scheduled'" name="i-heroicons-clock" class="w-3 h-3" />
          {{ displayDate }}
        </div>
      </div>
      <UIcon 
        name="i-heroicons-chevron-right" 
        class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors mt-1" 
      />
    </div>
  </NuxtLink>
</template>
