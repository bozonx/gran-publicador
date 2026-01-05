<script setup lang="ts">
import { useChannels } from '~/composables/useChannels'
import type { ChannelWithProject } from '~/composables/useChannels'
import { useProjects } from '~/composables/useProjects'
import { SOCIAL_MEDIA_WEIGHTS } from '~/utils/socialMedia'
import { useSorting } from '~/composables/useSorting'
import { useViewMode } from '~/composables/useViewMode'
import ChannelListItem from '~/components/channels/ChannelListItem.vue'
import ChannelCard from '~/components/channels/ChannelCard.vue'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { user } = useAuth()
const { 
  channels, 
  fetchChannels, 
  isLoading,
  getSocialMediaIcon,
  getSocialMediaColor,
  setFilter,
} = useChannels()

const searchQuery = ref('')

// Ownership filter
type OwnershipFilter = 'all' | 'own' | 'guest'
const ownershipFilter = ref<OwnershipFilter>('all')

// Filter options
const selectedProjectId = ref<string | null>(null)
const showArchivedFilter = ref(false) // По умолчанию false - показывает неархивные
const showInactiveOnlyFilter = ref(false) // По умолчанию false - показывает все (активные и неактивные)
const showIssuesOnlyFilter = ref(false) // По умолчанию false - показывает все

// Sorting with localStorage persistence
const sortOptionsComputed = computed(() => [
  { id: 'alphabetical', label: t('channel.sort.alphabetical'), icon: 'i-heroicons-bars-3-bottom-left' },
  { id: 'socialMedia', label: t('channel.sort.socialMedia'), icon: 'i-heroicons-share' },
  { id: 'language', label: t('channel.sort.language'), icon: 'i-heroicons-language' },
  { id: 'postsCount', label: t('channel.sort.postsCount'), icon: 'i-heroicons-document-text' }
])

// Sort function
function sortChannelsFn(list: ChannelWithProject[], sortByValue: string, sortOrderValue: 'asc' | 'desc') {
  return [...list].sort((a, b) => {
    let result = 0
    if (sortByValue === 'alphabetical') {
      result = a.name.localeCompare(b.name)

    } else if (sortByValue === 'socialMedia') {
      const weightA = SOCIAL_MEDIA_WEIGHTS[a.socialMedia] || 99
      const weightB = SOCIAL_MEDIA_WEIGHTS[b.socialMedia] || 99
      result = weightA - weightB
      if (result === 0) result = a.name.localeCompare(b.name)
    } else if (sortByValue === 'language') {
      const langA = a.language || 'zzz'
      const langB = b.language || 'zzz'
      result = langA.localeCompare(langB)
      if (result === 0) result = a.name.localeCompare(b.name)
    } else if (sortByValue === 'postsCount') {
      const postsA = a.postsCount || 0
      const postsB = b.postsCount || 0
      result = postsB - postsA
      if (result === 0) result = a.name.localeCompare(b.name)
    }

    return sortOrderValue === 'asc' ? result : -result
  })
}

const { sortBy, sortOrder, currentSortOption, toggleSortOrder } = useSorting<ChannelWithProject>({
  storageKey: 'channels-page',
  defaultSortBy: 'alphabetical',
  defaultSortOrder: 'asc',
  sortOptions: sortOptionsComputed.value,
  sortFn: sortChannelsFn
})

// View mode (list or cards)
const { viewMode, isListView, isCardsView } = useViewMode('channels-view', 'list')

// Projects
const { projects, fetchProjects } = useProjects()

// Fetch all user channels on mount (including archived)
onMounted(async () => {
    setFilter({ includeArchived: true })
    await Promise.all([
        fetchChannels(),
        fetchProjects(true) // включая архивные проекты
    ])
})


// Sorting computed props for UI
const sortOrderIcon = computed(() => 
  sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
)

const sortOrderLabel = computed(() => 
  sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')
)

// Count for badge - only non-archived channels
const nonArchivedChannelsCount = computed(() => {
    return channels.value.filter(c => !c.archivedAt && !c.project?.archivedAt).length
})

// Project filter options - only projects present in channels
const projectFilterOptions = computed(() => {
  const projectIds = new Set<string>()
  const projectMap = new Map<string, { id: string; name: string }>()
  
  channels.value.forEach(c => {
    if (c.projectId && c.project) {
      projectIds.add(c.projectId)
      if (!projectMap.has(c.projectId)) {
        projectMap.set(c.projectId, {
          id: c.project.id,
          name: c.project.name
        })
      }
    }
  })
  
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('common.all') }
  ]
  
  // Sort projects alphabetically
  const sortedProjects = Array.from(projectMap.values()).sort((a, b) => 
    a.name.localeCompare(b.name)
  )
  
  sortedProjects.forEach(project => {
    options.push({
      value: project.id,
      label: project.name
    })
  })
  
  return options
})

const filteredChannels = computed(() => {
    let result = channels.value

    // Apply archive filter (checkbox)
    if (!showArchivedFilter.value) {
        // Выключено: только активные каналы и проекты
        result = result.filter(c => !c.archivedAt && !c.project?.archivedAt)
    } else {
        // Включено: только архивные каналы или каналы из архивных проектов
        result = result.filter(c => c.archivedAt || c.project?.archivedAt)
    }

    // Apply ownership filter (radio buttons)
    if (ownershipFilter.value === 'own') {
        // Only channels from projects owned by current user
        result = result.filter(c => c.project?.ownerId === user.value?.id)
    } else if (ownershipFilter.value === 'guest') {
        // Only channels from projects where user is invited (not owner)
        result = result.filter(c => c.project?.ownerId !== user.value?.id)
    }
    // 'all' - no filtering by ownership
    
    // Apply project filter
    if (selectedProjectId.value) {
        result = result.filter(c => c.projectId === selectedProjectId.value)
    }

    // Apply inactive filter (checkbox)
    if (showInactiveOnlyFilter.value) {
        result = result.filter(c => !c.isActive)
    }
    // По умолчанию (false) - показываем все (активные и неактивные)

    // Apply issues filter (checkbox)
    if (showIssuesOnlyFilter.value) {
        result = result.filter(c => {
            // Channel has issues if:
            // 1. Has failed posts
            const hasFailedPosts = c.failedPostsCount && c.failedPostsCount > 0
            // 2. Is stale (no recent posts)
            const isStale = c.isStale
            // 3. Has no credentials
            const hasNoCredentials = !c.credentials || Object.keys(c.credentials).length === 0
            
            return hasFailedPosts || isStale || hasNoCredentials
        })
    }
    // По умолчанию (false) - показываем все

    // Apply search query
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.channelIdentifier.toLowerCase().includes(query) ||
            c.project?.name?.toLowerCase().includes(query)
        )
    }

    return sortChannelsFn(result, sortBy.value, sortOrder.value)
})

</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('channel.titlePlural') }}
          <CommonCountBadge :count="nonArchivedChannelsCount" :title="t('channel.filter.badgeCountTooltip')" />
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('navigation.channels') }}
        </p>
      </div>

      <!-- Sorting and view controls -->
      <div class="flex items-center gap-2">
        <CommonViewToggle v-model="viewMode" />

        <USelectMenu
          v-model="sortBy"
          :items="sortOptionsComputed"
          value-key="id"
          label-key="label"
          class="w-56"
          :searchable="false"
        >
          <template #leading>
            <UIcon v-if="currentSortOption" :name="currentSortOption.icon" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <UButton
          :key="sortOrder"
          :icon="sortOrderIcon"
          color="neutral"
          variant="ghost"
          @click="toggleSortOrder"
          :title="sortOrderLabel"
        />
      </div>
    </div>

    <!-- Search and filters -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
      <!-- Search -->
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="t('common.search')"
          size="md"
          class="w-full"
        />
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <!-- Ownership Filter (Button group) -->
        <div class="flex items-center gap-2">
          <div class="flex -space-x-px">
            <UButton 
              :color="ownershipFilter === 'all' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'all' ? 'solid' : 'outline'"
              class="rounded-r-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'all'"
            >
              {{ t('channel.filter.ownership.all') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'own' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'own' ? 'solid' : 'outline'"
              class="rounded-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'own'"
            >
              {{ t('channel.filter.ownership.own') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'guest' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'guest' ? 'solid' : 'outline'"
              class="rounded-l-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'guest'"
            >
              {{ t('channel.filter.ownership.guest') }}
            </UButton>
          </div>
          <UTooltip :text="t('channel.filter.ownership.tooltip')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help" />
          </UTooltip>
        </div>

        <!-- Issues Filter (Checkbox) -->
        <UCheckbox 
          v-model="showIssuesOnlyFilter" 
          :label="t('channel.filter.showIssuesOnly')"
          :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
        />

        <!-- Inactive Filter (Checkbox) -->
        <UCheckbox 
          v-model="showInactiveOnlyFilter" 
          :label="t('channel.filter.showInactiveOnly')"
          :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
        />

        <!-- Archive Filter (Checkbox) - moved to end -->
        <div class="flex items-center gap-1.5">
          <UCheckbox 
            v-model="showArchivedFilter" 
            :label="t('channel.filter.showArchived')"
            :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
          />
          <UTooltip :text="t('channel.filter.archiveStatus.tooltip')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help" />
          </UTooltip>
        </div>
        
        <!-- Project Filter (Select) -->
        <USelectMenu
          v-model="selectedProjectId"
          :items="projectFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('channel.filter.project')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedProjectId" name="i-heroicons-folder" class="w-4 h-4" />
          </template>
        </USelectMenu>
      </div>
    </div>

    <!-- Channels list view -->
    <div v-if="isListView" class="space-y-4">
       <div v-if="isLoading && channels.length === 0" class="flex items-center justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
       </div>

       <div v-else-if="filteredChannels.length === 0" class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-hashtag" class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ t('channel.noChannelsFound') }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ searchQuery ? t('channel.noChannelsFiltered') : t('channel.noChannelsDescription') }}
          </p>
       </div>

       <ChannelListItem
         v-for="channel in filteredChannels"
         :key="channel.id"
         :channel="channel"
         :show-project="true"
       />
    </div>

    <!-- Channels cards view -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       <div v-if="isLoading && channels.length === 0" class="col-span-full flex items-center justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
       </div>

       <div v-else-if="filteredChannels.length === 0" class="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-hashtag" class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ t('channel.noChannelsFound') }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ searchQuery ? t('channel.noChannelsFiltered') : t('channel.noChannelsDescription') }}
          </p>
       </div>

       <ChannelCard
         v-for="channel in filteredChannels"
         :key="channel.id"
         :channel="channel"
         :show-project="true"
       />
    </div>
  </div>
</template>
