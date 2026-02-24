<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import type { PublicationsStatusGroupFilter } from '~/pages/publications/statusGroupFilter'

interface Props {
  status: PublicationsStatusGroupFilter
  ownership: string
  archived: string
  socialMedia: SocialMedia | null
  language: string | null
  tags: string
  projectId: string | null
  channelId: string | null
  search: string
  isLoading?: boolean
  hasActiveFilters?: boolean
  publicationTagsSuggestions?: string[]
}

const props = defineProps<Props>()
const emit = defineEmits([
  'update:status',
  'update:ownership',
  'update:archived',
  'update:socialMedia',
  'update:language',
  'update:tags',
  'update:projectId',
  'update:channelId',
  'update:search',
  'reset'
])

const { t } = useI18n()
const { user } = useAuth()

const statusGroupOptions = computed(() => [
  { value: 'active', label: t('publication.filter.statusGroup.active') },
  { value: 'draft', label: t('publication.filter.statusGroup.draft') },
  { value: 'ready', label: t('publication.filter.statusGroup.ready') },
  { value: 'problematic', label: t('publication.filter.statusGroup.problematic') }
])

const ownershipOptions = computed(() => [
  { value: 'own', label: t('publication.filter.ownership.own') },
  { value: 'notOwn', label: t('publication.filter.ownership.notOwn') },
  { value: 'all', label: t('publication.filter.ownership.all') }
])

const archiveOptions = computed(() => [
  { value: 'archived', label: t('channel.filter.archiveStatus.archived') },
  { value: 'active', label: t('channel.filter.archiveStatus.active') }
])

// Local proxies for v-model in child components if needed, 
// but here we just emit updates directly from Nuxt UI components.
</script>

<template>
  <div class="app-card section-spacing">
    <div class="flex items-center gap-4 mb-4">
      <div class="flex-1">
        <CommonSearchInput
          :model-value="search"
          :loading="isLoading"
          @update:model-value="emit('update:search', $event)"
        />
      </div>
      <UButton
        v-if="hasActiveFilters"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-x-mark"
        size="sm"
        @click="emit('reset')"
      >
        {{ t('common.resetFilters', 'Reset') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <!-- Status Group -->
      <div class="flex items-center gap-2">
         <UiAppButtonGroup
          :model-value="status"
          :options="statusGroupOptions"
          variant="outline"
          active-variant="solid"
          color="neutral"
          @update:model-value="emit('update:status', $event)"
        />
        <CommonInfoTooltip :text="t('publication.filter.statusGroup.tooltip')" />
      </div>

      <!-- Ownership -->
      <div class="flex items-center gap-2">
        <UiAppButtonGroup
          :model-value="ownership"
          :options="ownershipOptions"
          variant="outline"
          active-variant="solid"
          @update:model-value="emit('update:ownership', $event)"
        />
        <CommonInfoTooltip :text="t('publication.filter.ownership.tooltip')" />
      </div>

      <!-- Archive -->
      <UiAppButtonGroup
        :model-value="archived"
        :options="archiveOptions"
        variant="outline"
        active-variant="solid"
        color="neutral"
        @update:model-value="emit('update:archived', $event)"
      />

      <!-- Other Selects -->
      <CommonSocialMediaSelect
        :model-value="socialMedia"
        allow-all
        class="w-full sm:w-48"
        @update:model-value="emit('update:socialMedia', $event)"
      />

      <CommonLanguageSelect
        :model-value="language"
        allow-all
        searchable
        class="w-full sm:w-48"
        @update:model-value="emit('update:language', $event)"
      />

      <PublicationsTagsFilter
        :model-value="tags"
        :publication-tags="publicationTagsSuggestions"
        :project-id="projectId || undefined"
        :user-id="projectId ? undefined : user?.id"
        class="w-full sm:w-64"
        @update:model-value="emit('update:tags', $event)"
      />

      <CommonProjectSelect
        :model-value="projectId"
        allow-all
        class="w-full sm:w-48"
        @update:model-value="emit('update:projectId', $event)"
      />

      <CommonChannelSelect
        :model-value="channelId"
        allow-all
        class="w-full sm:w-48"
        @update:model-value="emit('update:channelId', $event)"
      />
    </div>
  </div>
</template>
