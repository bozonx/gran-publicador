<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

const props = defineProps<{
  publication: PublicationWithRelations
  showProjectInfo?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', publication: PublicationWithRelations): void
  (e: 'delete', publication: PublicationWithRelations): void
}>()

const { t, d } = useI18n()
const { getStatusColor, getStatusDisplayName } = usePublications()

function truncateContent(content: string | null | undefined, maxLength = 100): string {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

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
    class="app-card app-card-hover p-4 cursor-pointer group flex flex-col h-full"
    @click="handleClick"
  >
    <!-- Header: Title, Status, Delete -->
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-white truncate text-base leading-snug mb-1">
          {{ publication.title || t('post.untitled') }}
        </h3>
        <UBadge :color="getStatusColor(publication.status)" size="xs" variant="subtle" class="capitalize">
          {{ getStatusDisplayName(publication.status) }}
        </UBadge>
      </div>
      
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <slot name="actions" />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="xs"
          @click="handleDelete"
        />
      </div>
    </div>

    <!-- Content preview -->
    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 grow leading-relaxed">
      {{ truncateContent(publication.content) }}
    </p>

    <!-- Footer: Author, Date, Posts count, Tags -->
    <div class="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
      <!-- Author and Date -->
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div v-if="publication.creator" class="flex items-center gap-1 min-w-0 flex-1">
          <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">{{ publication.creator.fullName || publication.creator.telegramUsername }}</span>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
          <span>{{ d(new Date(publication.createdAt), 'short') }}</span>
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
            <UIcon 
              :name="post.channel?.socialMedia === 'TELEGRAM' ? 'i-logos-telegram' : 'i-heroicons-paper-airplane'" 
              class="w-3 h-3" 
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
    </div>
  </div>
</template>
