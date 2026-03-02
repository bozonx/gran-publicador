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

const hasCredentials = computed(() => !isChannelCredentialsEmpty(props.channel.credentials, props.channel.socialMedia))

const { getChannelProblemLevel, getChannelProblems } = useChannels()
const problems = computed(() => getChannelProblems(props.channel))
const route = useRoute()
const isChannelArchived = computed(() => (props.isArchived || !!props.channel.archivedAt) && route.query.archived !== 'true')
</script>

<template>
  <div
    class="block app-card app-card-hover cursor-pointer relative"
    :class="{ 'opacity-60 grayscale': isChannelArchived }"
    @click="navigateTo(`/channels/${channel.id}`)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <!-- Header: Name + Social Media + Status -->
        <CommonEntityCardHeader
          :title="channel.name"
          title-class="text-base"
        >
          <template #icon>
            <CommonSocialIcon 
              :platform="channel.socialMedia" 
              show-background 
            />
          </template>
          <template #badges>
            <!-- Language -->
            <CommonLanguageBadges
              v-if="channel.language"
              :languages="[channel.language]"
              mode="compact"
            />
            
            <UBadge 
              v-if="!channel.isActive" 
              color="warning" 
              variant="subtle" 
              size="xs"
            >
              {{ t('channel.inactive') }}
            </UBadge>

            <!-- Problem indicators -->
            <UTooltip 
              v-for="problem in problems" 
              :key="problem.key"
              :text="t(`problems.channel.${problem.key}`, problem.count ? { count: problem.count } : {})"
            >
              <NuxtLink 
                v-if="problem.key === 'noCredentials'"
                :to="`/channels/${channel.id}/settings#credentials`"
                @click.stop
              >
                <UIcon 
                  name="i-heroicons-exclamation-triangle" 
                  class="w-5 h-5 text-red-500 hover:text-red-600 transition-colors block" 
                />
              </NuxtLink>
              <UIcon 
                v-else
                :name="problem.type === 'critical' ? 'i-heroicons-x-circle' : 'i-heroicons-exclamation-triangle'" 
                :class="problem.type === 'critical' ? 'text-red-500' : 'text-orange-500'"
                class="w-5 h-5 block"
              />
            </UTooltip>
          </template>
        </CommonEntityCardHeader>

        <!-- Note -->
        <CommonCardDescription 
          v-if="channel.note"
          :text="channel.note" 
          class="mb-3"
        />

        <!-- Metrics & ID -->
        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          <div class="font-mono text-xs">
            ID: {{ channel.channelIdentifier }}
          </div>

          <div v-if="showProject && channel.project" class="flex items-center gap-1.5 min-w-0" :title="t('project.title')">
            <div class="w-px h-3 bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
            <UIcon name="i-heroicons-folder" class="w-4 h-4 shrink-0" />
            <span class="truncate font-medium">
              {{ channel.project.name }}
            </span>
          </div>

          <div class="w-px h-3 bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

          <CommonMetricItem
            icon="i-heroicons-document-text"
            :label="t('channel.publishedPosts').toLowerCase()"
            :value="channel.postsCount || 0"
            :title="t('channel.publishedPosts')"
          />

          <div class="flex items-center gap-1.5" :title="t('channel.lastPublishedPost')">
            <UIcon name="i-heroicons-clock" class="w-4 h-4 shrink-0" />
            <span>
              {{ t('channel.lastPublishedPost') }}: 
              <NuxtLink 
                v-if="channel.lastPublicationId"
                :to="`/publications/${channel.lastPublicationId}`"
                class="hover:underline hover:text-primary-500 font-medium relative z-10"
                @click.stop
              >
                {{ formatDateShort(channel.lastPostAt) }}
              </NuxtLink>
              <span v-else>
                {{ formatDateShort(channel.lastPostAt) }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
