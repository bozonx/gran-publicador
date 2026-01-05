<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'
import { getSocialMediaDisplayName } from '~/utils/socialMedia'
import SocialIcon from '~/components/common/SocialIcon.vue'

const props = defineProps<{
  channel: ChannelWithProject
  isArchived?: boolean
  showProject?: boolean
}>()

const { t, d } = useI18n()

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return d(new Date(date), 'short')
}

const hasCredentials = computed(() => {
  if (!props.channel.credentials) return false
  return Object.keys(props.channel.credentials).length > 0
})

const { getChannelProblemLevel } = useChannels()
const channelProblemLevel = computed(() => getChannelProblemLevel(props.channel))
</script>

<template>
  <div
    class="app-card app-card-hover p-4 cursor-pointer relative flex flex-col h-full"
    :class="{ 'opacity-60 grayscale': isArchived }"
    @click="navigateTo(`/projects/${channel.projectId}/channels/${channel.id}`)"
  >
    <!-- Header with icon and name -->
    <div class="flex items-start gap-3 mb-3">
      <SocialIcon 
        :platform="channel.socialMedia" 
        :is-stale="channel.isStale"
        :problem-level="channelProblemLevel"
        show-background 
      />
      
      <div class="flex-1 min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate mb-1">
          {{ channel.name }}
        </h3>
        
        <!-- Language -->
        <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-language" class="w-3.5 h-3.5" />
          <span class="font-medium">{{ channel.language }}</span>
        </div>
      </div>
    </div>

    <!-- Description -->
    <p v-if="channel.description" class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 grow">
      {{ channel.description }}
    </p>

    <!-- Status badges and warnings -->
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <UBadge 
        v-if="!channel.isActive" 
        color="warning" 
        variant="subtle" 
        size="xs"
      >
        {{ t('channel.inactive') }}
      </UBadge>
      
      <UTooltip v-if="channel.isStale" :text="t('settings.staleChannelsWarning')">
        <UIcon 
          name="i-heroicons-clock" 
          class="w-4 h-4 text-orange-500" 
        />
      </UTooltip>

      <UTooltip v-if="!hasCredentials" :text="t('channel.noCredentials')">
        <UIcon 
          name="i-heroicons-exclamation-triangle" 
          class="w-4 h-4 text-warning-500" 
        />
      </UTooltip>
    </div>

    <!-- Project info (if needed) -->
    <div v-if="showProject && channel.project" class="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
      <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5 shrink-0" />
      <span class="truncate font-medium">{{ channel.project.name }}</span>
    </div>

    <!-- Footer: Metrics and identifier -->
    <div class="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
      <!-- Channel ID -->
      <div class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
        ID: {{ channel.channelIdentifier }}
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div class="flex items-center gap-1" :title="t('channel.publishedPosts')">
          <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
          <span>{{ channel.postsCount || 0 }}</span>
        </div>

        <div v-if="channel.failedPostsCount && channel.failedPostsCount > 0" class="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium" :title="t('channel.failedPosts')">
          <UIcon name="i-heroicons-exclamation-circle" class="w-3.5 h-3.5 shrink-0" />
          <span>{{ channel.failedPostsCount }}</span>
        </div>

        <div class="flex items-center gap-1 ml-auto" :title="t('channel.lastPublishedPost')">
          <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
          <span>{{ formatDate(channel.lastPostAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
