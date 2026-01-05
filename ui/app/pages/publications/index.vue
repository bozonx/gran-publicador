<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/composables/usePublications'
import { useSorting } from '~/composables/useSorting'
import { getSocialMediaOptions, getSocialMediaIcon } from '~/utils/socialMedia'
import type { SocialMedia } from '~/types/socialMedia'
import type { PublicationStatus } from '~/types/posts'
import { DEFAULT_PAGE_SIZE } from '~/constants'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { user } = useAuth()

const {
  publications,
  isLoading,
  totalCount,
  statusOptions,
  fetchUserPublications,
} = usePublications()

// Initialize currentPage from URL query parameter
const currentPage = ref(
  route.query.page && typeof route.query.page === 'string' 
    ? Math.max(1, parseInt(route.query.page, 10) || 1)
    : 1
)

// Pagination state
const limit = ref(DEFAULT_PAGE_SIZE)

// Filter states
const selectedStatus = ref<PublicationStatus | null>(null)
const selectedChannelId = ref<string | null>(null)
const searchQuery = ref('')

// Ownership filter
type OwnershipFilter = 'all' | 'own' | 'notOwn'
const ownershipFilter = ref<OwnershipFilter>('all')

// Filter options
const showArchivedFilter = ref(false) // По умолчанию false - показывает неархивные
const showIssuesOnlyFilter = ref(false) // По умолчанию false - показывает все
const selectedSocialMedia = ref<SocialMedia | null>(null) // Фильтр по социальной сети
const selectedLanguage = ref<string | null>(null) // Фильтр по языку

// Sorting options
const sortOptionsComputed = computed(() => [
  { id: 'scheduledAt', label: t('publication.sort.scheduledAt'), icon: 'i-heroicons-clock' },
  { id: 'publishedAt', label: t('publication.sort.publishedAt'), icon: 'i-heroicons-check-circle' },
  { id: 'createdAt', label: t('publication.sort.createdAt'), icon: 'i-heroicons-plus-circle' },
  { id: 'updatedAt', label: t('publication.sort.updatedAt'), icon: 'i-heroicons-arrow-path' },
  { id: 'postDate', label: t('publication.sort.postDate'), icon: 'i-heroicons-calendar' }
])

// Sort function
function sortPublicationsFn(list: PublicationWithRelations[], sortByValue: string, sortOrderValue: 'asc' | 'desc') {
  return [...list].sort((a, b) => {
    let result = 0
    
    if (sortByValue === 'scheduledAt') {
      // scheduledAt поста и если нет то смотрится scheduledAt публикации
      const dateA = a.posts?.[0]?.scheduledAt || a.scheduledAt
      const dateB = b.posts?.[0]?.scheduledAt || b.scheduledAt
      
      if (!dateA && !dateB) result = 0
      else if (!dateA) result = 1
      else if (!dateB) result = -1
      else result = new Date(dateA).getTime() - new Date(dateB).getTime()
      
    } else if (sortByValue === 'publishedAt') {
      // publishedAt у поста
      const dateA = a.posts?.[0]?.publishedAt
      const dateB = b.posts?.[0]?.publishedAt
      
      if (!dateA && !dateB) result = 0
      else if (!dateA) result = 1
      else if (!dateB) result = -1
      else result = new Date(dateA).getTime() - new Date(dateB).getTime()
      
    } else if (sortByValue === 'createdAt') {
      // createdAt у публикации
      result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      
    } else if (sortByValue === 'updatedAt') {
      // updatedAt у публикации
      const dateA = a.updatedAt || a.createdAt
      const dateB = b.updatedAt || b.createdAt
      result = new Date(dateA).getTime() - new Date(dateB).getTime()
      
    } else if (sortByValue === 'postDate') {
      // postDate
      const dateA = a.postDate
      const dateB = b.postDate
      
      if (!dateA && !dateB) result = 0
      else if (!dateA) result = 1
      else if (!dateB) result = -1
      else result = new Date(dateA).getTime() - new Date(dateB).getTime()
    }

    return sortOrderValue === 'asc' ? result : -result
  })
}

const { sortBy, sortOrder, currentSortOption, toggleSortOrder } = useSorting<PublicationWithRelations>({
  storageKey: 'publications-page',
  defaultSortBy: 'scheduledAt',
  defaultSortOrder: 'desc',
  sortOptions: sortOptionsComputed.value,
  sortFn: sortPublicationsFn
})

// Fetch on mount
onMounted(async () => {
    // Check if channelId or status is in query params
    if (route.query.channelId && typeof route.query.channelId === 'string') {
        selectedChannelId.value = route.query.channelId
    }
    if (route.query.status && typeof route.query.status === 'string') {
        selectedStatus.value = route.query.status as PublicationStatus
    }
    
    await fetchUserPublications({
        limit: 1000,
        includeArchived: true
    })
})

// Watch filters (reset to page 1)
watch([selectedStatus, selectedChannelId, ownershipFilter, showIssuesOnlyFilter, showArchivedFilter, selectedSocialMedia, selectedLanguage, searchQuery], () => {
    currentPage.value = 1
})

// Sync URL with page changes
watch(currentPage, (newPage) => {
    if (!import.meta.client) return
    
    // Check if we need to update URL
    const query = { ...route.query }
    const urlPage = parseInt(String(query.page || '1'), 10)
    
    if (newPage !== urlPage) {
        if (newPage > 1) {
            query.page = String(newPage)
        } else {
            delete query.page
        }
        router.push({ query })
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
})

// Sync page from URL changes
watch(() => route.query.page, (newPage) => {
    const pageNum = parseInt(String(newPage || '1'), 10)
    if (pageNum !== currentPage.value) {
        currentPage.value = pageNum
    }
})

function goToPublication(pub: PublicationWithRelations) {
    router.push(`/projects/${pub.projectId}/publications/${pub.id}`)
}

const statusFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  ...statusOptions.value,
])

const hasActiveFilters = computed(() => {
  return selectedStatus.value || selectedChannelId.value || searchQuery.value
})


// Sorting computed props for UI
const sortOrderIcon = computed(() => 
  sortOrder.value === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
)

const sortOrderLabel = computed(() => 
  sortOrder.value === 'asc' ? t('common.sortOrder.asc') : t('common.sortOrder.desc')
)

// Social media filter options
const socialMediaFilterOptions = computed(() => [
  { value: null, label: t('common.all') },
  ...getSocialMediaOptions(t)
])

// Language filter options - only languages present in publications
const languageFilterOptions = computed(() => {
  const languages = new Set<string>()
  publications.value.forEach(p => {
    if (p.language) {
      languages.add(p.language)
    }
  })
  
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('common.all') }
  ]
  
  // Sort languages alphabetically
  const sortedLanguages = Array.from(languages).sort()
  sortedLanguages.forEach(lang => {
    options.push({
      value: lang,
      label: lang
    })
  })
  
  return options
})

// Count for badge - total filtered publications
const filteredCount = computed(() => filteredPublications.value.length)

// Client-side search filtering and sorting
const filteredPublications = computed(() => {
    let result = publications.value
    
    // Apply status filter
    if (selectedStatus.value) {
        result = result.filter(p => p.status === selectedStatus.value)
    }
    
    // Apply channel filter
    if (selectedChannelId.value) {
        result = result.filter(p => {
            return p.posts?.some(post => post.channelId === selectedChannelId.value)
        })
    }
    
    // Apply archive filter (checkbox)
    if (!showArchivedFilter.value) {
        // Выключено: только неархивные публикации
        result = result.filter(p => !p.archivedAt)
    } else {
        // Включено: только архивные публикации
        result = result.filter(p => p.archivedAt)
    }
    
    // Apply ownership filter (button group)
    if (ownershipFilter.value === 'own') {
        // Only publications created by current user
        result = result.filter(p => p.createdBy === user.value?.id)
    } else if (ownershipFilter.value === 'notOwn') {
        // Only publications NOT created by current user
        result = result.filter(p => p.createdBy !== user.value?.id)
    }
    // 'all' - no filtering by ownership
    
    // Apply issues filter (checkbox)
    if (showIssuesOnlyFilter.value) {
        result = result.filter(p => {
            // Publication has issues if:
            // 1. Status is EXPIRED
            const isExpired = p.status === 'EXPIRED'
            // 2. Has at least one failed post
            const hasFailedPosts = p.posts?.some(post => post.status === 'FAILED')
            
            return isExpired || hasFailedPosts
        })
    }
    // По умолчанию (false) - показываем все
    
    // Apply social media filter
    if (selectedSocialMedia.value) {
        result = result.filter(p => {
            // Check if publication has at least one post in a channel with selected social media
            return p.posts?.some(post => post.channel?.socialMedia === selectedSocialMedia.value)
        })
    }
    
    // Apply language filter
    if (selectedLanguage.value) {
        result = result.filter(p => p.language === selectedLanguage.value)
    }
    
    // Apply search filter
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        result = result.filter(p => 
            (p.title && p.title.toLowerCase().includes(q)) || 
            (p.content && p.content.toLowerCase().includes(q))
        )
    }
    
    // Apply sorting
    return sortPublicationsFn(result, sortBy.value, sortOrder.value)
})

const paginatedPublications = computed(() => {
    const start = (currentPage.value - 1) * limit.value
    const end = start + limit.value
    return filteredPublications.value.slice(start, end)
})

const showPagination = computed(() => {
    return filteredPublications.value.length > limit.value
})

</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {{ t('publication.titlePlural') }}
          <CommonCountBadge :count="filteredCount" :title="t('publication.filter.badgeCountTooltip')" />
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('navigation.publications', 'Все публикации проекта') }}
        </p>
      </div>

      <!-- Sorting controls -->
      <div class="flex items-center gap-2">
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
      <div class="flex flex-wrap items-center gap-4">
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
              {{ t('publication.filter.ownership.all') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'own' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'own' ? 'solid' : 'outline'"
              class="rounded-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'own'"
            >
              {{ t('publication.filter.ownership.own') }}
            </UButton>
            <UButton 
              :color="ownershipFilter === 'notOwn' ? 'primary' : 'neutral'"
              :variant="ownershipFilter === 'notOwn' ? 'solid' : 'outline'"
              class="rounded-l-none focus:z-10"
              size="sm"
              @click="ownershipFilter = 'notOwn'"
            >
              {{ t('publication.filter.ownership.notOwn') }}
            </UButton>
          </div>
          <UTooltip :text="t('publication.filter.ownership.tooltip')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help" />
          </UTooltip>
        </div>

        <!-- Issues Filter (Checkbox) -->
        <UCheckbox 
          v-model="showIssuesOnlyFilter" 
          :label="t('publication.filter.showIssuesOnly')"
          :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
        />

        <!-- Archive Filter (Checkbox) - moved to end -->
        <div class="flex items-center gap-1.5">
          <UCheckbox 
            v-model="showArchivedFilter" 
            :label="t('publication.filter.showArchived')"
            :ui="{ label: 'text-sm font-medium text-gray-700 dark:text-gray-300' }"
          />
          <UTooltip :text="t('publication.filter.archiveStatus.tooltip')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400 cursor-help" />
          </UTooltip>
        </div>

        <!-- Social Media Filter (Select) -->
        <USelectMenu
          v-model="selectedSocialMedia"
          :items="socialMediaFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.socialMedia')"
          class="w-full sm:w-48"
        >
          <template #leading>
            <UIcon v-if="selectedSocialMedia" :name="getSocialMediaIcon(selectedSocialMedia)" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <!-- Language Filter (Select) -->
        <USelectMenu
          v-model="selectedLanguage"
          :items="languageFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('publication.filter.language')"
          class="w-full sm:w-40"
        />

        <!-- Status Filter (Select) -->
        <USelectMenu
          v-model="selectedStatus"
          :items="statusFilterOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('post.status')"
          class="w-full sm:w-48"
        />
      </div>
    </div>

    <!-- Publications list -->
    <div v-if="isLoading && publications.length === 0" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="filteredPublications.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('publication.noPublicationsFound', 'Публикации не найдены') }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          {{ hasActiveFilters ? t('post.noPostsFiltered') : t('publication.noPublicationsDescription', 'У вас еще нет созданных публикаций.') }}
        </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <PublicationsPublicationListItem
          v-for="pub in paginatedPublications"
          :key="pub.id"
          :publication="pub"
          show-project-info
          @click="goToPublication"
        />
    </div>

    <!-- Pagination -->
    <div v-if="showPagination" class="mt-8 flex justify-center">
      <UPagination
        v-model:page="currentPage"
        :total="filteredPublications.length"
        :items-per-page="limit"
        :prev-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-left', label: t('common.prev') }"
        :next-button="{ color: 'neutral', icon: 'i-heroicons-arrow-small-right', label: t('common.next'), trailing: true }"
      />
    </div>
  </div>
</template>
