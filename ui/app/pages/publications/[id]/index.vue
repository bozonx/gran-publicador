<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { useFormatters } from '~/composables/useFormatters'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getStatusColor, getStatusIcon } from '~/utils/publications'
import { getSocialMediaIcon } from '~/utils/socialMedia'
import MediaGallery from '~/components/media/MediaGallery.vue'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const { fetchPublication, currentPublication, isLoading } = usePublications()
const { fetchProject, currentProject } = useProjects()
const { formatDateWithTime, formatDateShort } = useFormatters()

const publicationId = computed(() => route.params.id as string)

onMounted(async () => {
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
        if (currentPublication.value?.projectId) {
            await fetchProject(currentPublication.value.projectId)
        }
    }
})

const tabs = computed(() => [
  { label: t('common.view', 'View'), icon: 'i-heroicons-eye', to: `/publications/${publicationId.value}` },
  { label: t('common.edit', 'Edit'), icon: 'i-heroicons-pencil-square', to: `/publications/${publicationId.value}/edit` }
])

const displayTitle = computed(() => {
  if (currentPublication.value?.title) {
    return stripHtmlAndSpecialChars(currentPublication.value.title)
  }
  if (currentPublication.value?.content) {
    const cleaned = stripHtmlAndSpecialChars(currentPublication.value.content)
    if (cleaned) return cleaned
  }
  return t('post.untitled')
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-6 px-4">
    <!-- Tab Switcher -->
    <div class="mb-8 border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="[
            route.path === tab.to
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon :name="tab.icon" class="mr-2 h-5 w-5" :class="[route.path === tab.to ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500']" />
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !currentPublication" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin"></UIcon>
    </div>

    <!-- Content -->
    <div v-else-if="currentPublication" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="p-6">
          <!-- Title Section -->
          <div class="mb-4">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ displayTitle }}
            </h1>
          </div>

          <!-- Badge Row -->
          <div class="flex flex-wrap gap-2 mb-6">
            <!-- Language -->
            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.language') }}:</span>
              {{ currentPublication.language }}
            </UBadge>
            
            <!-- Post Type -->
            <UBadge variant="soft" color="neutral" class="font-normal">
              <span class="text-gray-400 mr-1">{{ t('common.type') }}:</span>
              {{ t(`postType.${currentPublication.postType.toLowerCase()}`) }}
            </UBadge>

            <!-- Status -->
            <UBadge 
              :color="getStatusColor(currentPublication.status) as any" 
              variant="soft"
              class="flex items-center gap-1 font-medium"
            >
              <UIcon :name="getStatusIcon(currentPublication.status)" class="w-4 h-4" />
              {{ t(`publicationStatus.${currentPublication.status.toLowerCase()}`) }}
            </UBadge>

            <!-- Project Link -->
            <NuxtLink v-if="currentProject" :to="`/projects/${currentProject.id}`">
              <UBadge variant="soft" color="primary" class="hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer font-normal">
                <UIcon name="i-heroicons-folder" class="w-4 h-4 mr-1 text-primary-500" />
                {{ currentProject.name }}
              </UBadge>
            </NuxtLink>
          </div>

          <!-- Social Media & Dates Row -->
          <div v-if="currentPublication.posts?.length" class="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div v-for="post in currentPublication.posts" :key="post.id" class="flex items-center gap-2">
              <UTooltip :text="post.channel?.name || post.socialMedia">
                <div class="h-8 w-8 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                  <UIcon :name="getSocialMediaIcon(post.channel?.socialMedia || post.socialMedia)" class="w-4 h-4" />
                </div>
              </UTooltip>
              <div class="flex flex-col">
                <span class="text-[10px] uppercase tracking-wider text-gray-400 leading-none mb-0.5">
                  {{ post.publishedAt ? t('post.publishedAt') : t('post.scheduledAt') }}
                </span>
                <span 
                  class="text-xs font-medium"
                  :class="post.publishedAt ? 'text-success-600 dark:text-success-400' : 'text-primary-600 dark:text-primary-400'"
                >
                  {{ post.publishedAt ? formatDateWithTime(post.publishedAt) : (post.scheduledAt ? formatDateWithTime(post.scheduledAt) : t('common.none')) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Note Section -->
          <div v-if="currentPublication.note" class="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
            <h3 class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              {{ t('post.note') }}
            </h3>
            <p class="text-sm text-amber-800 dark:text-amber-300 italic">
              {{ currentPublication.note }}
            </p>
          </div>

          <!-- Media Gallery -->
          <div class="mb-8">
            <MediaGallery 
              v-if="currentPublication.media"
              :media="currentPublication.media" 
              :publication-id="currentPublication.id"
              :editable="false"
              @refresh="() => fetchPublication(publicationId)"
            />
          </div>

          <!-- Content Section -->
          <div class="space-y-6">
            <div v-if="currentPublication.content" class="prose dark:prose-invert max-w-none">
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{{ t('post.content') }}</h3>
              <div v-html="currentPublication.content" class="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50"></div>
            </div>

            <!-- Author Comment -->
            <div v-if="currentPublication.authorComment" class="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-4 h-4" />
                {{ t('post.authorComment') }}
              </h3>
              <div class="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                {{ currentPublication.authorComment }}
              </div>
            </div>

            <!-- Meta Footer (Date & Tags) -->
            <div class="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-sm">
              <div v-if="currentPublication.postDate" class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-gray-400" />
                <span class="text-gray-500">{{ t('post.postDate') }}:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ formatDateShort(currentPublication.postDate) }}</span>
              </div>
              
              <div v-if="currentPublication.tags" class="flex items-center gap-2">
                <UIcon name="i-heroicons-tag" class="w-5 h-5 text-gray-400" />
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in currentPublication.tags.split(',')" :key="tag" class="text-primary-600 dark:text-primary-400 font-medium">
                    #{{ tag.trim() }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
