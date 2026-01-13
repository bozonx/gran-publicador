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

const { t } = useI18n()
const { getStatusColor, getStatusDisplayName, getStatusIcon, getPublicationProblems, getPostProblemLevel } = usePublications()
const { formatDateShort, truncateContent } = useFormatters()
const route = useRoute()
const isArchiveView = computed(() => route.query.archived === 'true')

// Compute problems for this publication
const problems = computed(() => getPublicationProblems(props.publication))
const showCheckbox = computed(() => route.path === '/publications')

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
    class="app-card app-card-hover p-4 cursor-pointer group flex flex-col h-full relative"
    @click="handleClick"
  >
    <!-- Checkbox for bulk operations -->
    <div v-if="showCheckbox" class="absolute top-1 left-1 p-3 z-10 cursor-default" @click.stop="emit('update:selected', !selected)">
      <UCheckbox
        :model-value="selected"
        @update:model-value="(val) => emit('update:selected', !!val)"
        @click.stop
        :ui="{ wrapper: 'pointer-events-none' }"
      />
    </div>

    <!-- Header: Title, Status, Delete -->
    <div class="flex items-start justify-between gap-3 mb-2" :class="{ 'pl-8': showCheckbox }">
      <div class="flex-1 min-w-0">
        <div v-if="showProjectInfo && publication.project" class="flex items-center gap-1.5 mb-1 text-xs text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-briefcase" class="w-3 h-3 text-gray-400" />
          <span class="truncate">{{ publication.project.name }}</span>
        </div>
        <h3 class="font-semibold text-gray-900 dark:text-white truncate text-base leading-snug mb-1" :class="{ 'italic text-gray-500 font-medium': !publication.title && !stripHtmlAndSpecialChars(publication.content) }">
          {{ displayTitle }}
        </h3>
        <div class="flex items-center gap-1.5 flex-wrap">
          <UBadge :color="getStatusColor(publication.status) as any" size="xs" variant="subtle" class="capitalize gap-1">
            <UIcon :name="getStatusIcon(publication.status)" class="w-3.5 h-3.5" :class="{ 'animate-spin': publication.status === 'PROCESSING' }" />
            {{ getStatusDisplayName(publication.status) }}
          </UBadge>

          <UBadge v-if="publication.archivedAt && !isArchiveView" color="neutral" size="xs" variant="solid">
            {{ t('common.archived') }}
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
      </div>
      
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <slot name="actions" />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-pencil-square"
          size="xs"
          :to="`/publications/${publication.id}/edit`"
          class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click.stop
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="xs"
          class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

    <!-- Content preview -->
    <CommonCardDescription 
      :text="truncateContent(publication.content, 100)"
      :lines="2" 
    />

    <!-- Footer: Author, Date, Posts count, Tags -->
    <CommonCardFooter>
      <!-- Author and Date -->
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div v-if="publication.creator" class="flex items-center gap-1 min-w-0 flex-1">
          <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">{{ publication.creator.fullName || publication.creator.telegramUsername }}</span>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
          <span>{{ formatDateShort(publication.createdAt) }}</span>
        </div>
      </div>

      <!-- Posts count and channels -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-document-duplicate" class="w-3.5 h-3.5" />
          <span>{{ publication._count?.posts || 0 }} {{ t('post.titlePlural', 'posts') }}</span>
        </div>

        <!-- Channel icons -->
        <div v-if="publication.posts && publication.posts.length > 0" class="flex -space-x-1.5 overflow-hidden">
          <div
            v-for="post in publication.posts.slice(0, 5)"
            :key="post.id"
            class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-50 dark:bg-gray-700 flex items-center justify-center"
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
              class="w-3 h-3 text-gray-400" 
            />
          </div>
          <div v-if="publication.posts.length > 5" class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-500 font-medium">
            +{{ publication.posts.length - 5 }}
          </div>
        </div>
      </div>

      <!-- Tags if present -->
      <div v-if="publication.tags" class="flex items-center gap-1 text-xs text-gray-400 italic">
        <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 shrink-0" />
        <span class="truncate">{{ publication.tags }}</span>
      </div>
    </CommonCardFooter>
  </div>
</template>
