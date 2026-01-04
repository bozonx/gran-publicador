<script setup lang="ts">
import type { ChannelWithProject } from '~/composables/useChannels'
import { SOCIAL_MEDIA_WEIGHTS } from '~/utils/socialMedia'
import ChannelListItem from '~/components/channels/ChannelListItem.vue'

const props = defineProps<{
  projectId: string
}>()

const { t } = useI18n()
const {
  channels,
  isLoading,
  fetchChannels,
  setFilter
} = useChannels()

// Store all channels including archived
const allChannels = ref<ChannelWithProject[]>([])

// Sorting
const sortOptions = computed(() => [
  { id: 'alphabetical', label: t('channel.sort.alphabetical'), icon: 'i-heroicons-bars-3-bottom-left' },
  { id: 'activity', label: t('channel.sort.activity'), icon: 'i-heroicons-bolt' },
  { id: 'socialMedia', label: t('channel.sort.socialMedia'), icon: 'i-heroicons-share' },
  { id: 'language', label: t('channel.sort.language'), icon: 'i-heroicons-language' }
])

function sortChannelsFn(list: ChannelWithProject[], sortBy: string, sortOrder: 'asc' | 'desc') {
  return [...list].sort((a, b) => {
    let result = 0
    if (sortBy === 'alphabetical') {
      result = a.name.localeCompare(b.name)
    } else if (sortBy === 'activity') {
      const valA = a.isActive ? 1 : 0
      const valB = b.isActive ? 1 : 0
      result = valB - valA
      if (result === 0) result = a.name.localeCompare(b.name)
    } else if (sortBy === 'socialMedia') {
      const weightA = SOCIAL_MEDIA_WEIGHTS[a.socialMedia] || 99
      const weightB = SOCIAL_MEDIA_WEIGHTS[b.socialMedia] || 99
      result = weightA - weightB
      if (result === 0) result = a.name.localeCompare(b.name)
    } else if (sortBy === 'language') {
      const langA = a.language || 'zzz'
      const langB = b.language || 'zzz'
      result = langA.localeCompare(langB)
      if (result === 0) result = a.name.localeCompare(b.name)
    }

    return sortOrder === 'asc' ? result : -result
  })
}

const { 
  sortBy, 
  sortOrder, 
  currentSortOption, 
  toggleSortOrder,
  sortList
} = useSorting<ChannelWithProject>({
  storageKey: 'channels',
  defaultSortBy: 'alphabetical',
  sortOptions: sortOptions.value,
  sortFn: sortChannelsFn
})

// Use local sortOptions for template to ensure reactivity to language changes
const activeSortOption = computed(() => sortOptions.value.find(opt => opt.id === sortBy.value))

// Filter non-archived channels
const nonArchivedChannels = computed(() => 
  allChannels.value.filter(ch => !ch.archivedAt)
)

// Filter archived channels
const archivedChannels = computed(() => 
  allChannels.value.filter(ch => ch.archivedAt)
)

// Count of non-archived channels
const channelCount = computed(() => nonArchivedChannels.value.length)

// Has archived channels
const hasArchivedChannels = computed(() => archivedChannels.value.length > 0)

// Final sorted list for display
const sortedChannels = computed(() => sortList(nonArchivedChannels.value))
const sortedArchivedChannels = computed(() => sortList(archivedChannels.value))

// Archived Logic
const showArchived = ref(false)

onMounted(async () => {
  if (props.projectId) {
    // Fetch all channels including archived at once
    setFilter({ isActive: null, includeArchived: true })
    const fetchedChannels = await fetchChannels(props.projectId)
    allChannels.value = fetchedChannels
  }
})

function toggleArchivedChannels() {
  showArchived.value = !showArchived.value
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('channel.titlePlural') }}
          <CommonCountBadge :count="channelCount" :title="t('channel.channelsCount')" />
        </h3>
      </div>
      
      <div class="flex items-center gap-2">
        <USelectMenu
          v-model="sortBy"
          :items="sortOptions"
          value-key="id"
          label-key="label"
          class="w-56"
          :searchable="false"
        >
          <template #leading>
            <UIcon v-if="activeSortOption" :name="activeSortOption.icon" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <UButton
          :icon="sortOrder === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'"
          color="neutral"
          variant="ghost"
          @click="toggleSortOrder"
          :title="sortOrder === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')"
        />

        <UButton
          icon="i-heroicons-plus"
          color="primary"
          :to="`/projects/${projectId}/channels/new`"
        >
          {{ t('channel.createChannel', 'Create channel') }}
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="channelCount === 0 && !hasArchivedChannels"
      class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center"
    >
      <UIcon
        name="i-heroicons-signal-slash"
        class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ t('channel.noChannelsFound') }}
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6">
        {{ t('channel.noChannelsDescription') }}
      </p>

    </div>

    <!-- Channels List -->
    <div v-else class="space-y-4">
      <ChannelListItem
        v-for="channel in sortedChannels"
        :key="channel.id"
        :channel="channel"
      />

      <!-- Show/Hide Archived Button -->
      <div v-if="hasArchivedChannels" class="flex justify-center pt-4">
        <UButton
          :icon="showArchived ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          variant="ghost"
          color="neutral"
          @click="toggleArchivedChannels"
        >
          {{ showArchived ? t('common.hideArchived', 'Hide Archived') : t('common.showArchived', 'Show Archived') }}
        </UButton>
      </div>

      <!-- Archived Channels Section -->
      <div v-if="showArchived" class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div v-if="archivedChannels.length > 0">
           <ChannelListItem
            v-for="channel in sortedArchivedChannels"
            :key="channel.id"
            :channel="channel"
            is-archived
          />
        </div>
        <div v-else class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400">{{ t('channel.noArchived', 'No archived channels') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
