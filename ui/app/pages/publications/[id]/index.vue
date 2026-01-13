<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import { stripHtmlAndSpecialChars } from '~/utils/text'
import { getStatusColor, getStatusIcon } from '~/utils/publications'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const { fetchPublication, currentPublication, isLoading } = usePublications()
const { fetchProject, currentProject } = useProjects()

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
    <div v-else-if="currentPublication" class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ displayTitle }}
          </h1>
          <UBadge 
            :color="getStatusColor(currentPublication.status)" 
            variant="soft"
            class="flex items-center gap-1"
          >
            <UIcon :name="getStatusIcon(currentPublication.status)" class="w-4 h-4" />
            {{ t(`publicationStatus.${currentPublication.status.toLowerCase()}`) }}
          </UBadge>
        </div>

        <div class="space-y-6">
          <!-- Main Content -->
          <div v-if="currentPublication.content" class="prose dark:prose-invert max-w-none">
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">{{ t('common.content') }}</h3>
            <div v-html="currentPublication.content" class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md"></div>
          </div>

          <!-- Media -->
          <div v-if="currentPublication.media?.length">
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">{{ t('common.media') }}</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div v-for="media in currentPublication.media" :key="media.id" class="relative aspect-square rounded-lg overflow-hidden">
                <img :src="media.url" :alt="media.filename" class="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <!-- Metadata -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
            <div>
              <p class="text-sm font-medium text-gray-500">{{ t('project.title') }}</p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ currentProject?.name || '-' }}
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">{{ t('common.language') }}</p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ currentPublication.language }}
              </p>
            </div>
            <div v-if="currentPublication.scheduledAt">
              <p class="text-sm font-medium text-gray-500">{{ t('publication.scheduled') }}</p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ new Date(currentPublication.scheduledAt).toLocaleString() }}
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">{{ t('common.type') }}</p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ currentPublication.postType }}
              </p>
            </div>
          </div>

          <!-- Channels/Posts -->
          <div v-if="currentPublication.posts?.length" class="border-t border-gray-100 dark:border-gray-700 pt-6">
             <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">{{ t('common.channels') }}</h3>
             <div class="space-y-3">
               <div v-for="post in currentPublication.posts" :key="post.id" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                 <div class="flex items-center gap-3">
                   <div v-if="post.channel" class="flex items-center gap-2">
                     <span class="font-medium">{{ post.channel.name }}</span>
                     <UBadge size="sm" variant="outline">{{ post.channel.platform }}</UBadge>
                   </div>
                 </div>
                 <UBadge :color="post.publishedAt ? 'success' : 'neutral'" size="sm">
                   {{ post.publishedAt ? t('publicationStatus.published') : t('publicationStatus.pending') }}
                 </UBadge>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
