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

function truncateContent(content: string | null | undefined, maxLength = 150): string {
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
    class="bg-white dark:bg-gray-800/50 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer p-5 border border-gray-100 dark:border-gray-700/50 hover:border-primary-500/30 group"
    @click="handleClick"
  >
    <div class="flex flex-col h-full">
      <!-- Title and Actions -->
      <div class="flex items-start justify-between gap-4 mb-2">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <h3 class="font-semibold text-gray-900 dark:text-white truncate text-lg leading-snug">
            {{ publication.title || t('post.untitled') }}
          </h3>
          <UBadge :color="getStatusColor(publication.status)" size="xs" variant="subtle" class="capitalize">
            {{ getStatusDisplayName(publication.status) }}
          </UBadge>
        </div>
        
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
          @click="handleDelete"
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
          <span>{{ d(new Date(publication.createdAt), 'short') }}</span>
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
            <UIcon 
              :name="post.channel?.socialMedia === 'TELEGRAM' ? 'i-logos-telegram' : 'i-heroicons-paper-airplane'" 
              class="w-3.5 h-3.5" 
            />
          </div>
          <div v-if="publication.posts.length > 8" class="h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-500 font-medium">
            +{{ publication.posts.length - 8 }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
