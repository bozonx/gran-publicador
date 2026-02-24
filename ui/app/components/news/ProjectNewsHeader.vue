<script setup lang="ts">
const props = defineProps<{
  projectId: string
  projectName?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <NuxtLink :to="`/projects/${projectId}`" class="hover:text-primary-500 transition-colors flex items-center gap-1">
          <UIcon name="i-heroicons-folder" class="w-4 h-4" />
          {{ projectName || t('project.title') }}
        </NuxtLink>
        <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        <span>{{ t('news.news_selections') }}</span>
      </div>
      
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center flex-wrap gap-x-3 gap-y-2">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-newspaper" class="w-8 h-8 text-primary-500" />
          {{ t('news.news_selections') }}
        </div>
        
        <template v-if="projectName">
          <span class="hidden md:block text-gray-300 dark:text-gray-700 font-normal">·</span>
          <NuxtLink 
            :to="`/projects/${projectId}`" 
            class="flex items-center gap-1.5 text-lg font-medium text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"
          >
            <UIcon name="i-heroicons-folder" class="w-5 h-5 mt-0.5" />
            {{ projectName }}
          </NuxtLink>
        </template>
      </h1>
    </div>
  </div>
</template>
