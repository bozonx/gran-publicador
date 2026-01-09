<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'

const props = defineProps<{
  channel: ChannelWithProject
  isArchived?: boolean
  showProject?: boolean
}>()

const { t } = useI18n()
const { formatDateShort } = useFormatters()

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
    @click="navigateTo(`/channels/${channel.id}`)"
  >
    <!-- Header with icon and name -->
    <div class="flex items-start gap-3 mb-3">
      <SocialIcon 
        :platform="channel.socialMedia" 
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
    <CommonCardDescription :text="channel.description" />

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

      <UTooltip v-if="channel.failedPostsCount && channel.failedPostsCount > 0" :text="`${channel.failedPostsCount} ${t('channel.failedPosts').toLowerCase()}`">
        <UIcon 
          name="i-heroicons-exclamation-circle" 
          class="w-4 h-4 text-red-500" 
        />
      </UTooltip>
    </div>

    <!-- Project info (if needed) -->
    <div v-if="showProject && channel.project" class="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
      <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5 shrink-0" />
      <span class="truncate font-medium">{{ channel.project.name }}</span>
    </div>

    <!-- Footer: Metrics and identifier -->
    <CommonCardFooter>
      <!-- Channel ID -->
      <div class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
        ID: {{ channel.channelIdentifier }}
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <CommonMetricItem
          icon="i-heroicons-document-text"
          :label="t('channel.publishedPosts')"
          :value="channel.postsCount || 0"
        />



        <div class="flex items-center gap-1 ml-auto" :title="t('channel.lastPublishedPost')">
          <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
          <span>{{ formatDateShort(channel.lastPostAt) }}</span>
        </div>
      </div>
    </CommonCardFooter>
  </div>
</template>
