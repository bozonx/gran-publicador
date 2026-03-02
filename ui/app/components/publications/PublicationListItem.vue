<script setup lang="ts">
import { getPublicationDisplayTitle, getPublicationAuthorName } from '~/utils/publications'
import { getMediaLinksThumbDataLoose } from '~/utils/media'
import type { PublicationWithRelations } from '~/types/publications'
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
const { formatDateShort, truncateContent } = useFormatters()
const { getStatusColor, getStatusDisplayName, getStatusIcon, getPublicationProblems } = usePublications()
const route = useRoute()
const isArchiveView = computed(() => route.query.archived === 'true')

const isContentActionModalOpen = ref(false)
const isCopyProjectModalOpen = ref(false)
const contentActionMode = ref<'copy'>('copy')

const thumbData = computed(() => {
  if (!props.publication.media || props.publication.media.length === 0) {
    return { first: null, totalCount: 0 }
  }

  return getMediaLinksThumbDataLoose(props.publication.media as { media?: unknown; order: number }[])
})

const displayTitle = computed(() => getPublicationDisplayTitle(props.publication, t))

// Compute problems for this publication
const problems = computed(() => getPublicationProblems(props.publication))

const authorName = computed(() => getPublicationAuthorName(props.publication, t))

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
    class="app-card app-card-hover cursor-pointer group"
    @click="handleClick"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-start gap-4">
        <!-- Checkbox for bulk operations -->
        <div v-if="selectable" class="px-3 pb-3 pt-4 -m-3 cursor-default" @click.stop="emit('update:selected', !selected)">
          <UCheckbox
            :model-value="selected"
            :ui="{ wrapper: 'pointer-events-none' }"
            @update:model-value="(val) => emit('update:selected', !!val)"
            @click.stop
          />
        </div>
        
        <div class="flex-1 min-w-0">
          <!-- Title and Actions -->
          <CommonEntityCardHeader
            :title="displayTitle"
            :title-class="!publication.title && !stripHtmlAndSpecialChars(publication.content) ? 'italic text-gray-500 font-medium' : ''"
            class="mb-2"
          >
            <template #badges>
              <UBadge :color="getStatusColor(publication.status) as any" size="xs" variant="subtle" class="capitalize gap-1">
                <UIcon :name="getStatusIcon(publication.status)" class="w-3.5 h-3.5" :class="{ 'animate-spin': publication.status === 'PROCESSING' }" />
                {{ getStatusDisplayName(publication.status) }}
              </UBadge>

              <UBadge v-if="publication.archivedAt && !isArchiveView" color="neutral" size="xs" variant="solid">
                {{ t('common.archived') }}
              </UBadge>

              <UBadge v-if="!publication.projectId" color="neutral" size="xs" variant="soft" class="gap-1">
                <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 text-gray-400" />
                {{ t('publication.personal_draft_short') }}
              </UBadge>
              
              <!-- Problem indicators -->
              <PublicationsPublicationProblemIndicators :problems="problems" />
            </template>
            
            <template #actions>
              <div class="flex items-center gap-1 group-hover:opacity-100 transition-opacity">
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
                    @click.stop
                  />
                </UDropdownMenu>
              </div>
            </template>
          </CommonEntityCardHeader>

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

      <!-- Content Snippet -->
      <CommonCardDescription 
        :text="truncateContent(publication.content)" 
        :lines="2"
        class="mb-4 grow leading-relaxed"
      />

      <!-- Footer Info -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-gray-500 dark:text-gray-400">
        <!-- Author -->
        <div v-if="authorName" class="flex items-center gap-1.5 min-w-0">
          <UIcon name="i-heroicons-user" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ authorName }}</span>
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
        <div v-if="showProjectInfo && (publication.project || publication.projectId)" class="flex items-center gap-1.5 ml-auto">
           <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
           <span v-if="publication.project" class="text-xs truncate max-w-[150px]">{{ publication.project.name }}</span>
           <span v-else class="text-[11px] font-mono">{{ publication.projectId?.slice(0, 8) }}</span>
        </div>
      </div>

      <!-- Channels visualization -->
      <div v-if="publication.posts && publication.posts.length > 0" class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
        <CommonPostChannelIcons :posts="publication.posts" :max-visible="8" size="sm" />
      </div>
        </div>
      </div>
    </div>

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
