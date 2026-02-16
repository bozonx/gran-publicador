<script setup lang="ts">
import { stripHtmlAndSpecialChars } from '~/utils/text'
import CommonThumb from '~/components/common/Thumb.vue'
import { getMediaLinksThumbDataLoose, type MediaItemLike } from '~/composables/useMedia'
import { useAuthStore } from '~/stores/auth'

type MediaItemLikeLoose = Omit<MediaItemLike, 'filename' | 'mimeType'> & {
  filename?: string | null
  mimeType?: string | null
}

interface ContentItemMediaLink {
  media?: MediaItemLikeLoose
  order: number
}

interface ContentItem {
  id: string
  title?: string | null
  note?: string | null
  tags?: string[]
  createdAt: string
  archivedAt?: string | null
  text?: string | null
  media?: Array<{ mediaId?: string; hasSpoiler?: boolean; order?: number; media?: MediaItemLikeLoose }>
}

const props = defineProps<{
  item: ContentItem
  archiveStatus?: 'active' | 'archived'
  selected?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  hideCheckbox?: boolean
  hideActions?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: ContentItem): void
  (e: 'toggleSelection', itemId: string): void
  (e: 'archive', item: ContentItem): void
  (e: 'restore', itemId: string): void
  (e: 'delete-forever', itemId: string): void
  (e: 'create-publication', item: ContentItem): void
  (e: 'move', item: ContentItem): void
}>()

const { t } = useI18n()
const { formatDateShort, truncateContent } = useFormatters()
const authStore = useAuthStore()

const actionsMenuItems = computed(() => {
  if (props.hideActions) {
    return []
  }

  if (props.archiveStatus === 'archived' || props.item.archivedAt) {
    return [
      [
        {
          label: t('common.deleteForever', 'Delete forever'),
          icon: 'i-heroicons-trash',
          onSelect: () => emit('delete-forever', props.item.id),
        },
      ],
    ]
  }

  return [
    [
      {
        label: t('contentLibrary.bulk.move'),
        icon: 'i-heroicons-folder-open',
        onSelect: () => emit('move', props.item),
      },
      {
        label: t('contentLibrary.actions.moveToTrash', 'Move to trash'),
        icon: 'i-heroicons-trash',
        onSelect: () => emit('archive', props.item),
      },
    ],
  ]
})

const formatTags = (tags?: string[]) => (tags && tags.length > 0 ? tags.join(', ') : '')

const getAllItemMedia = (item: ContentItem): ContentItemMediaLink[] => {
  return (item.media || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((m) => ({
      media: m.media,
      order: m.order ?? 0,
    }))
}

function toMediaItemLike(media?: MediaItemLikeLoose): MediaItemLike | undefined {
  if (!media) return undefined

  return {
    ...media,
    filename: media.filename ?? undefined,
    mimeType: media.mimeType ?? undefined,
  }
}

const thumbData = computed(() => {
  const rawLinks = getAllItemMedia(props.item)
  if (rawLinks.length === 0) {
    return { first: null, totalCount: 0 }
  }

  const links = rawLinks.map(l => ({ order: l.order, media: toMediaItemLike(l.media) }))
  return getMediaLinksThumbDataLoose(links, authStore.accessToken || undefined)
})

const getItemTextBlocks = (item: ContentItem): string[] => {
  const texts: string[] = []
  const itemText = stripHtmlAndSpecialChars(item.text || '').trim()
  if (itemText) {
    texts.push(itemText)
  }

  if (texts.length === 0 && item.note) {
    const noteClean = stripHtmlAndSpecialChars(item.note).trim()
    if (noteClean) texts.push(noteClean)
  }

  return texts
}

</script>

<template>
  <div
    class="app-card app-card-hover p-4 cursor-pointer group flex flex-col h-full relative"
    :class="{ 'ring-2 ring-primary-500 rounded-lg': selected }"
    @click="emit('click', item)"
  >
    <!-- Checkbox for selection -->
    <div 
      v-if="!hideCheckbox"
      class="absolute top-2 left-2 z-10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity" 
      :class="{ 'opacity-100': selected }" 
      @click.stop
    >
      <UCheckbox
        :model-value="selected"
        @update:model-value="emit('toggleSelection', item.id)"
      />
    </div>

    <!-- Header: Title, Tags, Delete -->
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex-1 min-w-0">
        <h3 
          class="font-semibold text-gray-900 dark:text-white truncate text-base leading-snug mb-1"
          :class="{ 'italic text-gray-500 font-medium': !item.title }"
        >
          {{ item.title || t('contentLibrary.untitled', 'Untitled') }}
        </h3>
        
        <div class="flex items-center gap-1.5 flex-wrap">
          <UBadge v-if="item.archivedAt" color="warning" size="xs" variant="subtle">
            {{ t('common.archived', 'Archived') }}
          </UBadge>
        </div>
      </div>

      <div v-if="!hideActions" class="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
        <UButton
          v-if="!item.archivedAt"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-paper-airplane"
          :title="t('contentLibrary.actions.createPublication')"
          class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click.stop="emit('create-publication', item)"
        />

        <UButton
          v-else
          size="xs"
          color="primary"
          variant="ghost"
          icon="i-heroicons-arrow-uturn-left"
          :loading="isRestoring"
          :title="t('common.restore')"
          class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click.stop="emit('restore', item.id)"
        />

        <UDropdownMenu v-if="actionsMenuItems.length > 0" :items="actionsMenuItems">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
            :title="t('common.more')"
            :aria-label="t('common.more')"
            class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click.stop
          />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Media preview -->
    <div v-if="getAllItemMedia(item).length > 0" class="mb-3 flex justify-center h-48">
      <CommonThumb
        v-if="thumbData.first"
        :src="thumbData.first.src"
        :srcset="thumbData.first.srcset"
        :alt="thumbData.first.placeholderText"
        size="md"
        :clickable="false"
        :is-video="thumbData.first.isVideo"
        :placeholder-icon="thumbData.first.placeholderIcon"
        :placeholder-text="thumbData.first.placeholderText"
        :show-stack="thumbData.totalCount > 1"
        :total-count="thumbData.totalCount"
      />
    </div>

    <!-- Content preview -->
    <div v-if="getItemTextBlocks(item).length > 0" class="mb-3 space-y-2">
      <p 
        v-for="(text, idx) in getItemTextBlocks(item)"
        :key="idx"
        class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed"
      >
        {{ truncateContent(text, 150) }}
      </p>
    </div>

    <!-- Footer: Date, Stats, Tags -->
    <div class="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 mt-auto">
      <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div class="flex items-center gap-1 shrink-0">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
          <span>{{ formatDateShort(item.createdAt) }}</span>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1" :title="t('contentLibrary.blocksCount', { count: 1 })">
            <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
            <span>1</span>
          </div>
          <div class="flex items-center gap-1" :title="t('contentLibrary.mediaCount', { count: getAllItemMedia(item).length })">
            <UIcon name="i-heroicons-photo" class="w-3.5 h-3.5" />
            <span>{{ getAllItemMedia(item).length }}</span>
          </div>
        </div>
      </div>

      <!-- Tags if present -->
      <div v-if="item.tags && item.tags.length > 0" class="flex items-center gap-1 text-xs text-gray-400 italic">
        <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 shrink-0" />
        <span class="truncate">{{ formatTags(item.tags) }}</span>
      </div>
    </div>
  </div>
</template>
