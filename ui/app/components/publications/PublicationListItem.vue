<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'
import { stripHtmlAndSpecialChars } from '~/utils/text'

const props = defineProps<{
  publication: PublicationWithRelations
  showProjectInfo?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', publication: PublicationWithRelations): void
  (e: 'delete', publication: PublicationWithRelations): void
  (e: 'update:selected', value: boolean): void
}>()

const { t, d } = useI18n()
const { formatDateShort, truncateContent } = useFormatters()
const { getStatusColor, getStatusDisplayName, getStatusIcon, getPublicationProblems, getPostProblemLevel } = usePublications()
const route = useRoute()
const isArchiveView = computed(() => route.query.archived === 'true')

const displayTitle = computed(() => {
  if (props.publication.title) {
    return stripHtmlAndSpecialChars(props.publication.title)
  }
  if (props.publication.content) {
    const cleaned = stripHtmlAndSpecialChars(props.publication.content)
    if (cleaned) return cleaned
  }
  return t('post.untitled')
})

// Compute problems for this publication
const problems = computed(() => getPublicationProblems(props.publication))
const showCheckbox = computed(() => route.path === '/publications')

function handleClick() {

  emit('click', props.publication)
}

function handleDelete(e: Event) {
  e.stopPropagation()
  emit('delete', props.publication)
}
</script>

<template>
  <div
    class="app-card app-card-hover p-5 cursor-pointer group"
    @click="handleClick"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-start gap-4">
        <!-- Checkbox for bulk operations -->
        <div v-if="showCheckbox" class="px-3 pb-3 pt-4 -m-3 cursor-default" @click.stop="emit('update:selected', !selected)">
          <UCheckbox
            :model-value="selected"
            @update:model-value="(val) => emit('update:selected', !!val)"
            @click.stop
            :ui="{ wrapper: 'pointer-events-none' }"
          />
        </div>
        
        <div class="flex-1 min-w-0">
          <!-- Title and Actions -->
          <div class="flex items-start justify-between gap-4 mb-2">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
          <h3 class="font-semibold text-gray-900 dark:text-white truncate text-lg leading-snug" :class="{ 'italic text-gray-500 font-medium': !publication.title && !stripHtmlAndSpecialChars(publication.content) }">
            {{ displayTitle }}
          </h3>
          <UBadge :color="getStatusColor(publication.status) as any" size="xs" variant="subtle" class="capitalize gap-1">
            <UIcon :name="getStatusIcon(publication.status)" class="w-3.5 h-3.5" :class="{ 'animate-spin': publication.status === 'PROCESSING' }" />
            {{ getStatusDisplayName(publication.status) }}
          </UBadge>

          <UBadge v-if="publication.archivedAt && !isArchiveView" color="neutral" size="xs" variant="solid">
            {{ t('common.archived') }}
          </UBadge>

          <UBadge v-if="!publication.projectId" color="neutral" size="xs" variant="soft" class="gap-1">
            <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 text-gray-400" />
            {{ t('publication.personal_draft_short', 'Personal') }}
          </UBadge>
          
          <!-- Problem indicators -->
          <UTooltip 
            v-for="problem in problems" 
            :key="problem.key"
            :text="t(`problems.publication.${problem.key}`, problem.count ? { count: problem.count } : {})"
          >
            <UIcon 
              :name="problem.type === 'critical' ? 'i-heroicons-x-circle' : problem.key === 'publicationExpired' ? 'i-heroicons-clock' : 'i-heroicons-exclamation-triangle'" 
              :class="problem.type === 'critical' ? 'text-red-500' : 'text-orange-500'"
              class="w-4 h-4"
            />
          </UTooltip>
        </div>
        
        <div class="flex items-center gap-1 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
          <slot name="actions" />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-pencil-square"
            size="xs"
            :to="`/publications/${publication.id}/edit`"
            @click.stop
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-trash"
            size="xs"
            @click="handleDelete"
          />
        </div>
      </div>

      <!-- Media preview -->
      <div v-if="publication.media && publication.media.length > 0" class="mb-3 flex justify-center">
        <MediaStack
          :media="publication.media"
          size="sm"
          :clickable="false"
        />
      </div>

      <!-- Content Snippet -->
      <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 grow leading-relaxed">
        {{ truncateContent(publication.content) }}
      </p>

      <!-- Footer Info -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-gray-500 dark:text-gray-400">
        <!-- Author -->
        <div v-if="publication.creator" class="flex items-center gap-1.5 min-w-0">
          <UIcon name="i-heroicons-user" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ publication.creator.fullName || publication.creator.telegramUsername }}</span>
        </div>

        <!-- Date -->
        <div class="flex items-center gap-1.5 shrink-0">
          <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
          <span>{{ formatDateShort(publication.createdAt) }}</span>
        </div>
        
        <!-- Posts Count -->
        <div class="flex items-center gap-1.5 shrink-0">
          <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" />
          <span>{{ publication._count?.posts || 0 }} {{ t('post.titlePlural', 'posts') }}</span>
        </div>

        <!-- Tags -->
        <div v-if="publication.tags" class="flex items-center gap-1.5 min-w-0">
          <UIcon name="i-heroicons-tag" class="w-4 h-4 shrink-0" />
          <span class="truncate text-gray-400 italic">{{ publication.tags }}</span>
        </div>
        
        <!-- Project Info (Optional) -->
        <div v-if="showProjectInfo && publication.projectId" class="flex items-center gap-1.5 ml-auto">
           <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
           <span class="text-[11px] font-mono">{{ publication.projectId.slice(0, 8) }}</span>
        </div>
      </div>

      <!-- Channels visualization -->
      <div v-if="publication.posts && publication.posts.length > 0" class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
        <div class="flex -space-x-1.5 overflow-hidden">
          <div
            v-for="post in publication.posts.slice(0, 8)"
            :key="post.id"
            class="h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-50 dark:bg-gray-700 flex items-center justify-center"
          >
            <CommonSocialIcon 
              v-if="post.channel"
              :platform="post.channel.socialMedia" 
              :problem-level="getPostProblemLevel(post)"
              size="sm"
            />
            <UIcon 
              v-else
              name="i-heroicons-question-mark-circle" 
              class="w-3.5 h-3.5 text-gray-400" 
            />
          </div>
          <div v-if="publication.posts.length > 8" class="h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-500 font-medium">
            +{{ publication.posts.length - 8 }}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>
