<script setup lang="ts">
const { t } = useI18n()
const { 
  getPublicationProblems, 
  getPublicationProblemLevel 
} = usePublications()
const { 
  getChannelProblems, 
  getChannelProblemLevel 
} = useChannels()
const { 
  getProjectProblems,
  getProjectProblemLevel 
} = useProjects()

// Fetch data
const { data: publications } = await useFetch('/api/publications', {
  query: { limit: 100, includeArchived: false }
})

const { data: channels } = await useFetch('/api/channels', {
  query: { limit: 100, includeArchived: false }
})

const { data: projects } = await useFetch('/api/projects', {
  query: { includeArchived: false }
})

// Calculate statistics
const stats = computed(() => {
  const result = {
    critical: 0,
    warning: 0,
    publications: {
      failed: 0,
      partial: 0,
      expired: 0,
    },
    channels: {
      noCredentials: 0,
      failedPosts: 0,
      stale: 0,
      inactive: 0,
    },
    projects: {
      noActivity: 0,
      staleChannels: 0,
    }
  }

  // Count publication problems
  if (publications.value && Array.isArray(publications.value.items)) {
    publications.value.items.forEach((publication: any) => {
      const level = getPublicationProblemLevel(publication)
      if (level === 'critical') result.critical++
      else if (level === 'warning') result.warning++

      // Count specific publication issues
      if (publication.status === 'FAILED') result.publications.failed++
      if (publication.status === 'PARTIAL') result.publications.partial++
      if (publication.status === 'EXPIRED') result.publications.expired++
    })
  }

  // Count channel problems
  if (channels.value && Array.isArray(channels.value.items)) {
    channels.value.items.forEach((channel: any) => {
      const level = getChannelProblemLevel(channel)
      if (level === 'critical') result.critical++
      else if (level === 'warning') result.warning++

      const problems = getChannelProblems(channel)
      
      // Count specific channel issues
      if (problems.some(p => p.key === 'noCredentials')) result.channels.noCredentials++
      if (problems.some(p => p.key === 'failedPosts')) result.channels.failedPosts++
      if (problems.some(p => p.key === 'staleChannel')) result.channels.stale++
      if (problems.some(p => p.key === 'inactiveChannel')) result.channels.inactive++
    })
  }

  // Count project problems
  if (projects.value && Array.isArray(projects.value)) {
    projects.value.forEach((project: any) => {
      const level = getProjectProblemLevel(project)
      if (level === 'critical') result.critical++
      else if (level === 'warning') result.warning++

      const problems = getProjectProblems(project)
      const noActivity = problems.find(p => p.key === 'noRecentActivity')
      const staleChannels = problems.find(p => p.key === 'staleChannels')

      if (noActivity) result.projects.noActivity++
      if (staleChannels) result.projects.staleChannels++
    })
  }

  return result
})

const hasProblems = computed(() => stats.value.critical > 0 || stats.value.warning > 0)

const problemItems = computed(() => {
  const items = []
  
  if (stats.value.publications.failed > 0) {
    items.push({
      label: t('problems.publication.allPostsFailed'),
      count: stats.value.publications.failed,
      color: 'red',
      icon: 'i-heroicons-x-circle',
      to: '/publications?issue=failed'
    })
  }
  
  if (stats.value.publications.partial > 0) {
    items.push({
      label: t('publicationStatus.partial'),
      count: stats.value.publications.partial,
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
      to: '/publications?issue=partial'
    })
  }
  
  if (stats.value.channels.noCredentials > 0) {
    items.push({
      label: t('problems.channel.noCredentials'),
      count: stats.value.channels.noCredentials,
      color: 'red',
      icon: 'i-heroicons-key',
      to: '/channels?issue=noCredentials'
    })
  }
  
  if (stats.value.channels.failedPosts > 0) {
    items.push({
      label: t('channel.failedPosts'),
      count: stats.value.channels.failedPosts,
      color: 'red',
      icon: 'i-heroicons-exclamation-circle',
      to: '/channels?issue=failedPosts'
    })
  }

  if (stats.value.publications.expired > 0) {
    items.push({
      label: t('publicationStatus.expired'),
      count: stats.value.publications.expired,
      color: 'orange',
      icon: 'i-heroicons-clock',
      to: '/publications?issue=expired'
    })
  }

  if (stats.value.projects.noActivity > 0) {
    items.push({
      label: t('project.noRecentActivity'),
      count: stats.value.projects.noActivity,
      color: 'orange',
      icon: 'i-heroicons-clock',
      to: '/projects'
    })
  }
  
  if (stats.value.channels.stale > 0) {
    items.push({
      label: t('common.stale'),
      count: stats.value.channels.stale,
      color: 'orange',
      icon: 'i-heroicons-clock',
      to: '/channels?issue=stale'
    })
  }
  
  if (stats.value.channels.inactive > 0) {
    items.push({
      label: t('channel.inactive'),
      count: stats.value.channels.inactive,
      color: 'orange',
      icon: 'i-heroicons-pause-circle',
      to: '/channels?issue=inactive'
    })
  }
  
  return items
})
</script>

<template>
  <div class="app-card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-orange-500" />
        {{ t('dashboard.problems') }}
      </h3>
      
      <UBadge 
        v-if="hasProblems"
        :color="stats.critical > 0 ? 'error' : 'warning'" 
        variant="subtle"
      >
        {{ stats.critical + stats.warning }}
      </UBadge>
    </div>

    <!-- No problems state -->
    <div v-if="!hasProblems" class="text-center py-8">
      <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.noProblems') }}
      </p>
    </div>

    <!-- Problems list -->
    <div v-else class="space-y-2">
      <!-- Summary -->
      <div class="flex items-center gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div v-if="stats.critical > 0" class="flex items-center gap-2">
          <UIcon name="i-heroicons-x-circle" class="w-4 h-4 text-red-500" />
          <span class="text-sm font-medium text-red-600 dark:text-red-400">
            {{ stats.critical }} {{ t('problems.critical').toLowerCase() }}
          </span>
        </div>
        <div v-if="stats.warning > 0" class="flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-orange-500" />
          <span class="text-sm font-medium text-orange-600 dark:text-orange-400">
            {{ stats.warning }} {{ t('problems.warning').toLowerCase() }}
          </span>
        </div>
      </div>

      <!-- Problem items -->
      <div class="space-y-1">
        <NuxtLink
          v-for="item in problemItems"
          :key="item.label"
          :to="item.to"
          class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <UIcon 
              :name="item.icon" 
              class="w-4 h-4 shrink-0"
              :class="`text-${item.color}-500`"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300 truncate">
              {{ item.label }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <UBadge 
              :color="item.color === 'red' ? 'error' : 'warning'" 
              variant="subtle" 
              size="xs"
            >
              {{ item.count }}
            </UBadge>
            <UIcon 
              name="i-heroicons-chevron-right" 
              class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
