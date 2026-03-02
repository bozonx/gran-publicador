<script setup lang="ts">
import type { ChannelWithProject } from '~/types/channels'

import { isChannelCredentialsEmpty } from '~/utils/channels'

const props = defineProps<{
  channel: ChannelWithProject
  isArchived?: boolean
  showProject?: boolean
}>()

const { t } = useI18n()
const { formatDateShort } = useFormatters()

const { getChannelProblemLevel, getChannelProblems } = useChannels()
const channelProblemLevel = computed(() => getChannelProblemLevel(props.channel))
const problems = computed(() => getChannelProblems(props.channel))
const route = useRoute()
const isChannelArchived = computed(() => (props.isArchived || !!props.channel.archivedAt) && route.query.archived !== 'true')
</script>

<template>
  <div
    class="app-card app-card-hover cursor-pointer relative flex flex-col h-full"
    :class="{ 'opacity-60 grayscale': isChannelArchived }"
    @click="navigateTo(`/channels/${channel.id}`)"
  >
    <!-- Header with icon and name -->
    <CommonEntityCardHeader
      :title="channel.name"
    >
      <template #icon>
        <CommonSocialIcon 
          :platform="channel.socialMedia" 
          show-background 
        />
      </template>

      <template #actions>
        <!-- Problems from backend -->
        <UTooltip 
          v-for="problem in problems" 
          :key="problem.key"
          :text="t(`problems.channel.${problem.key}`, problem.count ? { count: problem.count } : {})"
        >
          <UIcon 
            :name="problem.type === 'critical' ? 'i-heroicons-x-circle' : 'i-heroicons-exclamation-triangle'" 
            :class="problem.type === 'critical' ? 'text-red-500' : 'text-orange-500'"
            class="w-5 h-5"
          />
        </UTooltip>
      </template>
    </CommonEntityCardHeader>

    <div class="mb-3">
      <!-- Language -->
      <CommonLanguageBadges
        v-if="channel.language"
        :languages="[channel.language]"
        mode="compact"
        class="mb-2"
      />
      <!-- Status badges -->
      <UBadge 
        v-if="!channel.isActive" 
        color="neutral" 
        variant="subtle" 
        size="xs"
      >
        {{ t('channel.inactive') }}
      </UBadge>
    </div>

    <!-- Note -->
    <CommonCardDescription :text="channel.note" />

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

        <div v-if="channel.lastPostAt" class="flex items-center gap-1 ml-auto" :title="t('channel.lastPublishedPost')">
          <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
          <span>{{ formatDateShort(channel.lastPostAt) }}</span>
        </div>
      </div>
    </CommonCardFooter>
  </div>
</template>
