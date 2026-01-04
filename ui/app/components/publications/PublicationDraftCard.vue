<script setup lang="ts">
import { getSocialMediaIcon } from '~/utils/socialMedia'

const props = defineProps<{
    draft: any 
    projectId: string
}>()

const { t, d } = useI18n()
const router = useRouter()

function truncateContent(content: string | null | undefined, maxLength = 100): string {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

function goToDraft() {
    router.push(`/projects/${props.projectId}/publications/${props.draft.id}`)
}
</script>

<template>
   <div
      class="border border-gray-100 dark:border-gray-700 rounded-lg p-4 bg-gray-50/30 dark:bg-gray-800/30 transition-all hover:shadow-md cursor-pointer"
      @click="goToDraft"
    >
      <div class="flex flex-col h-full">
        <h3 class="font-medium text-gray-900 dark:text-white mb-2 line-clamp-1">
          {{ draft.title || t('post.untitled') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 grow">
          {{ truncateContent(draft.content) }}
        </p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-2 text-xs text-gray-400">
             <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
             {{ d(new Date(draft.createdAt), 'short') }}
          </div>
          
          <div class="flex items-center gap-1">
            <!-- Channel Icons -->
            <div v-if="draft.posts && draft.posts.length > 0" class="flex -space-x-1.5 overflow-hidden mr-2">
               <UTooltip
                  v-for="post in draft.posts.slice(0, 3)"
                  :key="post.id"
                  :text="post.channel?.name || post.socialMedia"
                >
                  <div class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <UIcon 
                      :name="getSocialMediaIcon(post.channel?.socialMedia || post.socialMedia)" 
                      class="w-3 h-3" 
                    />
                  </div>
                </UTooltip>
                <div v-if="draft.posts.length > 3" class="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500 font-medium">
                  +{{ draft.posts.length - 3 }}
                </div>
            </div>

            <div v-if="draft._count?.posts" class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-medium">
               <span class="opacity-70">{{ t('channel.titlePlural') }}:</span>
               {{ draft._count.posts }}
            </div>
          </div>
        </div>
      </div>
   </div>
</template>
