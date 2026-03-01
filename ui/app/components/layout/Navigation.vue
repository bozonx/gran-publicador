<script setup lang="ts">
import { eventBus } from '~/utils/events'
import type { ProjectWithRole } from '~/stores/projects'
import type { ChannelWithProject } from '~/types/channels'

const { t } = useI18n()
const { isAdmin, user } = useAuth()
const route = useRoute()

// Projects and Channels
const { projects, fetchProjects, isLoading: isProjectsLoading, getProjectProblemLevel, getProjectProblems } = useProjects()
const { fetchChannels: fetchChannelsApi, getChannelProblemLevel } = useChannels()

// Static Navigation
const mainNavItems = computed(() => [
  { label: t('navigation.dashboard'), to: '/', icon: 'i-heroicons-home' },
  { label: t('contentLibrary.title', 'Content Library'), to: '/content-library', icon: 'i-heroicons-rectangle-stack' },
  { label: t('navigation.publications', 'Publications'), to: '/publications', icon: 'i-heroicons-document-text' },
  { label: t('navigation.channels'), to: '/channels', icon: 'i-heroicons-hashtag' },
  { label: t('navigation.projects'), to: '/projects', icon: 'i-heroicons-briefcase' },
  { label: t('navigation.news', 'News'), to: '/news', icon: 'i-heroicons-newspaper' },
])

const bottomNavItems = computed(() => [
  { label: t('navigation.admin'), to: '/admin', icon: 'i-heroicons-shield-check', adminOnly: true },
  { label: t('navigation.settings'), to: '/settings', icon: 'i-heroicons-cog-6-tooth' },
].filter(item => !item.adminOnly || isAdmin.value))

// Sorted projects
const activeProjects = computed(() => {
  const list = projects.value.filter(p => !p.archivedAt)
  const order = user.value?.projectOrder || []
  
  if (order.length === 0) return list
  
  return [...list].sort((a, b) => {
    const indexA = order.indexOf(a.id)
    const indexB = order.indexOf(b.id)
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
})

const projectChannels = ref<Record<string, ChannelWithProject[]>>({})
const areChannelsLoading = ref<Record<string, boolean>>({})

// Initialize projects once if not loaded
onMounted(async () => {
  if (projects.value.length === 0) {
    await fetchProjects(false)
  }
  checkActiveRoute()
  eventBus.on('channel:created', handleChannelCreatedEvent)
})

onUnmounted(() => {
  eventBus.off('channel:created', handleChannelCreatedEvent)
})

const handleChannelCreatedEvent = (channel: any) => {
  if (channel?.projectId) fetchProjectChannels(channel.projectId)
}

// Auto-expand and fetch channels for active project
watch(() => route.path, () => checkActiveRoute(), { immediate: true })

function checkActiveRoute() {
  const match = route.path.match(/\/projects\/([^\/]+)/)
  if (match?.[1]) {
    const projectId = match[1]
    if (!projectChannels.value[projectId]) {
      fetchProjectChannels(projectId)
    }
  }
}

async function fetchProjectChannels(projectId: string) {
  if (areChannelsLoading.value[projectId]) return
  areChannelsLoading.value[projectId] = true
  try {
    const channels = await fetchChannelsApi({ projectId, limit: 100 })
    projectChannels.value[projectId] = channels
  } catch (e) {
    console.error('Failed to fetch channels for project', projectId, e)
  } finally {
    areChannelsLoading.value[projectId] = false
  }
}

const getIndicatorColor = (project: ProjectWithRole) => {
  const level = getProjectProblemLevel(project)
  if (level === 'critical') return 'bg-red-500'
  if (level === 'warning') return 'bg-yellow-500'
  return 'bg-emerald-500'
}

const getProjectTooltip = (project: ProjectWithRole) => {
  const problems = getProjectProblems(project)
  if (problems.length === 0) return project.name
  return problems.map(p => t(`problems.project.${p.key}`, { count: p.count })).join(', ')
}
</script>

<template>
  <nav class="flex flex-col h-full gap-1 overflow-hidden">
    <!-- Main Items -->
    <div class="flex flex-col gap-1 px-1">
      <UButton
        v-for="item in mainNavItems"
        :key="item.to"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        variant="ghost"
        color="neutral"
        block
        active-class="bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400"
        class="justify-start font-medium"
      />
    </div>

    <!-- Projects Header -->
    <div class="mt-4 mb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
      {{ t('navigation.my_projects') }}
    </div>

    <!-- Scrollable Projects List -->
    <div class="flex-1 overflow-y-auto px-1 space-y-1 scrollbar-thin">
      <div v-if="isProjectsLoading && projects.length === 0" class="p-4">
        <USkeleton class="h-8 w-full mb-2" />
        <USkeleton class="h-8 w-full" />
      </div>
      
      <template v-else>
        <UCollapsible v-for="project in activeProjects" :key="project.id" :default-open="route.path.includes(`/projects/${project.id}`)">
          <template #default="{ open }">
            <div 
              class="group flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              :class="{ 'bg-gray-50 dark:bg-gray-800/50': open }"
            >
              <UTooltip :text="getProjectTooltip(project)" :popper="{ placement: 'right' }" class="flex-1 min-w-0">
                <NuxtLink 
                  :to="`/projects/${project.id}`"
                  class="flex items-center gap-2.5 px-3 py-2 flex-1 min-w-0"
                  @click.stop
                >
                  <div class="w-2 h-2 rounded-full shrink-0" :class="getIndicatorColor(project)" />
                  <span class="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{{ project.name }}</span>
                </NuxtLink>
              </UTooltip>

              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-chevron-right"
                size="xs"
                class="p-1 mr-1 transition-transform duration-200"
                :class="{ 'rotate-90': open }"
                @click="!projectChannels[project.id] && fetchProjectChannels(project.id)"
              />
            </div>
          </template>


          <template #content>
            <div class="pl-7 pr-2 py-2 flex flex-col gap-2 border-l border-gray-100 dark:border-gray-800 ml-4 mb-1">
              <div v-if="areChannelsLoading[project.id]" class="flex gap-1">
                <USkeleton v-for="i in 3" :key="i" class="h-6 w-6 rounded-md" />
              </div>
              
              <div v-else-if="projectChannels[project.id]?.length" class="flex flex-wrap gap-1.5">
                <UTooltip v-for="channel in projectChannels[project.id]" :key="channel.id" :text="channel.name">
                  <NuxtLink
                    :to="`/channels/${channel.id}`"
                    class="group relative flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
                    active-class="!bg-primary-100 dark:!bg-primary-900/50 !border-primary-300 dark:!border-primary-700 ring-1 ring-primary-500"
                  >
                    <CommonSocialIcon :platform="channel.socialMedia" :problem-level="getChannelProblemLevel(channel)" size="sm" />
                  </NuxtLink>
                </UTooltip>
              </div>

              <!-- Quick Links for Project -->
              <div class="flex items-center gap-1 mt-1">
                <UButton :to="`/projects/${project.id}/news`" icon="i-heroicons-newspaper" variant="ghost" color="neutral" size="xs" :title="t('navigation.news')" />
                <UButton :to="`/projects/${project.id}/content-library`" icon="i-heroicons-rectangle-stack" variant="ghost" color="neutral" size="xs" :title="t('contentLibrary.title')" />
              </div>
            </div>
          </template>
        </UCollapsible>
      </template>

    </div>

    <!-- Bottom Items -->
    <div class="mt-auto p-1 border-t border-gray-100 dark:border-gray-800">
      <UButton
        v-for="item in bottomNavItems"
        :key="item.to"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        variant="ghost"
        color="neutral"
        block
        class="justify-start text-sm"
      />
    </div>
  </nav>
</template>

