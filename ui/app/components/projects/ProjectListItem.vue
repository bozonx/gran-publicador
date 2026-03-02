<script setup lang="ts">
import type { ProjectWithRole } from '~/stores/projects'
import { getRoleBadgeColor } from '~/utils/roles'

const props = defineProps<{
  project: ProjectWithRole
  showDescription?: boolean
  searchQuery?: string
}>()

const { t } = useI18n()
const router = useRouter()
const { 
  getProjectProblemsSummary 
} = useProjects()
const { getChannelProblemLevel } = useChannels()
const { formatDateShort, formatDateWithTime } = useFormatters()

// Problem detection
const problemsSummary = computed(() => getProjectProblemsSummary(props.project))

// Category counts and tooltips from summary
const errorsCount = computed(() => problemsSummary.value.errorsCount)
const warningsCount = computed(() => problemsSummary.value.warningsCount)
const errorsTooltip = computed(() => problemsSummary.value.errorsTooltip)
const warningsTooltip = computed(() => problemsSummary.value.warningsTooltip)
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="block app-card app-card-hover transition-all cursor-pointer h-full"
    :class="{ 'opacity-75 grayscale': project.archivedAt }"
  >
    <div class="flex items-start gap-4">
      <slot name="leading" />
      <div class="flex-1 min-w-0">
          <!-- Header: Name + Role + Problem Badges -->
          <CommonEntityCardHeader
            :title="project.name"
            :title-class="'text-base sm:text-lg max-w-full'"
          >
            <template #title>
              <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate max-w-full mb-1">
                <CommonSearchHighlight :text="project.name" :query="searchQuery || ''" />
              </h3>
            </template>
            <template #badges>
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
              <CommonWarningBadge
                v-if="errorsCount > 0"
                variant="error"
                icon="i-heroicons-x-circle-solid"
                :text="String(errorsCount)"
                :title="errorsTooltip"
              />

              <!-- Mini Warning Badge -->
              <CommonWarningBadge
                v-if="warningsCount > 0"
                variant="warning"
                icon="i-heroicons-exclamation-triangle-solid"
                :text="String(warningsCount)"
                :title="warningsTooltip"
              />
            </template>
          </CommonEntityCardHeader>

          <!-- Note (optional) -->
          <p 
            v-if="showDescription && project.note" 
            class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2"
          >
            <CommonSearchHighlight :text="project.note" :query="searchQuery || ''" />
          </p>

          <!-- Channels -->
          <div v-if="project.channels?.length" class="mb-4">
            <CommonChannelIcons
              :channels="project.channels"
              :max-visible="10"
              :get-problem-level="(c) => getChannelProblemLevel(c as any)"
              route-prefix="/channels/"
              :stacked="false"
            />
          </div>

          <!-- Metrics / Stats -->
          <CommonCardFooter with-border spacing="compact">
            <div class="flex items-center gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-wrap">
              <CommonMetricItem
                icon="i-heroicons-document-text"
                :label="t('publication.titlePlural').toLowerCase()"
                :value="project.publicationsCount || 0"
                :title="t('project.publicationsCountTooltip')"
              />
              
              <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>

              <CommonMetricItem
                icon="i-heroicons-signal"
                :label="t('channel.titlePlural').toLowerCase()"
                :value="project.channelCount || 0"
                :title="t('channel.titlePlural')"
              />

              <template v-if="project.languages?.length">
                <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <CommonLanguageBadges :languages="project.languages" mode="compact" />
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
          </CommonCardFooter>
        </div>
    </div>
  </NuxtLink>
</template>
