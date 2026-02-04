<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'
import { getSocialMediaDisplayName } from '~/utils/socialMedia'
import SocialIcon from '~/components/common/SocialIcon.vue'
import { isChannelCredentialsEmpty } from '~/utils/channels'

const props = defineProps<{
  channel: ChannelWithProject
  isArchived?: boolean
  showProject?: boolean
}>()

const { t, d } = useI18n()

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  const dObj = new Date(date)
  if (isNaN(dObj.getTime())) return '-'
  return d(dObj, 'short')
}

const hasCredentials = computed(() => !isChannelCredentialsEmpty(props.channel.credentials, props.channel.socialMedia))

const { getChannelProblemLevel } = useChannels()
const channelProblemLevel = computed(() => getChannelProblemLevel(props.channel))
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
        <div class="flex items-center gap-3 mb-2 flex-wrap">
          <SocialIcon 
            :platform="channel.socialMedia" 
            show-background 
          />
          
          <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
            {{ channel.name }}
          </h3>

          <!-- Language -->
          <div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400" :title="t('channel.language')">
            <UIcon name="i-heroicons-language" class="w-4 h-4" />
            <span class="font-medium">
              {{ channel.language }}
            </span>
          </div>
          
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
               class="w-5 h-5 text-orange-500" 
             />
          </UTooltip>

          <UTooltip v-if="!hasCredentials" :text="t('channel.noCredentials')">
             <NuxtLink 
               :to="`/channels/${channel.id}/settings#credentials`"
               @click.stop
             >
              <UIcon 
                name="i-heroicons-exclamation-triangle" 
                class="w-5 h-5 text-red-500 hover:text-red-600 transition-colors" 
              />
             </NuxtLink>
          </UTooltip>

          <UTooltip v-if="channel.failedPostsCount && channel.failedPostsCount > 0" :text="`${channel.failedPostsCount} ${t('channel.failedPosts').toLowerCase()}`">
             <UIcon 
               name="i-heroicons-exclamation-circle" 
               class="w-5 h-5 text-red-500" 
             />
          </UTooltip>
        </div>

        <!-- Description -->
        <p v-if="channel.description" class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
            {{ channel.description }}
        </p>



        <!-- Metrics & ID -->
        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          <div class="font-mono">
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

          <div class="flex items-center gap-1.5" :title="t('channel.publishedPosts')">
            <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
            <span>
              {{ channel.postsCount || 0 }} {{ t('channel.publishedPosts').toLowerCase() }}
            </span>
          </div>



          <div class="flex items-center gap-1.5" :title="t('channel.lastPublishedPost')">
            <UIcon name="i-heroicons-clock" class="w-4 h-4" />
            <span>
              {{ t('channel.lastPublishedPost') }}: 
              <NuxtLink 
                v-if="channel.lastPublicationId"
                :to="`/publications/${channel.lastPublicationId}`"
                class="hover:underline hover:text-primary-500 font-medium relative z-10"
                @click.stop
              >
                {{ formatDate(channel.lastPostAt) }}
              </NuxtLink>
              <span v-else>
                {{ formatDate(channel.lastPostAt) }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
