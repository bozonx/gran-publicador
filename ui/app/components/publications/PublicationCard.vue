<script setup lang="ts">
import type { PublicationWithRelations } from '~/types/publications'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import CommonThumb from '~/components/common/Thumb.vue'
import { getMediaLinksThumbDataLoose } from '~/utils/media'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  publication: PublicationWithRelations
  showProjectInfo?: boolean
  selected?: boolean
  selectable?: boolean
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
const authStore = useAuthStore()

const isContentActionModalOpen = ref(false)
const isCopyProjectModalOpen = ref(false)
const contentActionMode = ref<'copy'>('copy')

const thumbData = computed(() => {
  if (!props.publication.media || props.publication.media.length === 0) {
    return { first: null, totalCount: 0 }
  }

  return getMediaLinksThumbDataLoose(props.publication.media as any)
})

// Compute problems for this publication
const problems = computed(() => getPublicationProblems(props.publication))

const authorName = computed(() => {
  const creator = props.publication.creator
  if (!creator) return ''
  return creator.fullName || creator.telegramUsername || t('common.unknown')
})

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
    class="app-card app-card-hover cursor-pointer group flex flex-col h-full relative"
    @click="handleClick"
  >
    <!-- Checkbox for bulk operations -->
    <div v-if="selectable" class="absolute top-1 left-1 p-3 z-10 cursor-default" @click.stop="emit('update:selected', !selected)">
      <UCheckbox
        :model-value="selected"
        :ui="{ wrapper: 'pointer-events-none' }"
        @update:model-value="(val) => emit('update:selected', !!val)"
        @click.stop
      />
    </div>

    <!-- Header: Title, Status, Delete -->
    <div class="flex items-start justify-between gap-3 mb-2" :class="{ 'pl-8': selectable }">
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
          <PublicationsPublicationProblemIndicators :problems="problems" />

          <CommonAdminDebugInfo :data="publication" />
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
          :title="t('common.edit')"
          @click.stop
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="xs"
          class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :title="t('common.delete')"
          @click="handleDelete"
        />
        <UDropdownMenu
          :items="[[
            {
              label: t('publication.copyToProject'),
              icon: 'i-heroicons-document-duplicate',
              click: () => {
                isCopyProjectModalOpen = true
              }
            },
            {
              label: t('publication.copyToContentLibrary'),
              icon: 'i-heroicons-arrow-down-on-square-stack',
              click: () => {
                contentActionMode = 'copy'
                isContentActionModalOpen = true
              }
            }
          ]]"
          :popper="{ placement: 'bottom-end', strategy: 'fixed' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-vertical"
            size="xs"
            class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click.stop
          />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Media preview -->
    <div v-if="publication.media && publication.media.length > 0" class="mb-3 flex justify-center">
      <CommonThumb
        v-if="thumbData.first"
        :src="thumbData.first.src"
        :srcset="thumbData.first.srcset"
        :alt="thumbData.first.placeholderText"
        size="sm"
        :clickable="false"
        :is-video="thumbData.first.isVideo"
        :placeholder-icon="thumbData.first.placeholderIcon"
        :placeholder-text="''"
        :show-stack="thumbData.totalCount > 1"
        :total-count="thumbData.totalCount"
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
        <div v-if="authorName" class="flex items-center gap-1 min-w-0 flex-1">
          <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">{{ authorName }}</span>
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
        <PublicationsPublicationChannelIcons :posts="publication.posts || []" />
      </div>

      <!-- Tags if present -->
      <div v-if="publication.tags" class="flex items-center gap-1 text-xs text-gray-400 italic">
        <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 shrink-0" />
        <span class="truncate">{{ publication.tags }}</span>
      </div>
    </CommonCardFooter>

    <!-- Content Action Modal (Copy/Move to Content Library) -->
    <ContentCreateItemFromPublicationModal
      v-model:open="isContentActionModalOpen"
      :publication-id="publication.id"
      :scope="publication.projectId ? 'project' : 'personal'"
      :project-id="publication.projectId || undefined"
      :mode="contentActionMode"
    />

    <ModalsCopyPublicationToProjectModal
      v-model:open="isCopyProjectModalOpen"
      :publication-id="publication.id"
      :current-project-id="publication.projectId || undefined"
    />
  </div>
</template>
