<script setup lang="ts">
const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  totalUnfiltered: number
  totalInScope: number
  currentProject?: any
  archiveStatus: 'active' | 'archived'
  isPurging: boolean
  activeCollection?: any
  isStartCreating: boolean
  availableTags: string[]
  sortOptions: any[]
  currentSortOption?: any
  sortOrderIcon: string
  sortOrderLabel: string
  isWindowFileDragActive?: boolean
  canDeleteActiveCollection?: boolean
  userId?: string
  groupIds?: string[]
  orphansOnly?: boolean
}>()

const q = defineModel<string>('q')
const selectedTags = defineModel<string>('selectedTags')
const sortBy = defineModel<string>('sortBy')
const sortOrder = defineModel<'asc' | 'desc'>('sortOrder')

const emit = defineEmits<{
  (e: 'update:archiveStatus', value: 'active' | 'archived'): void
  (e: 'purge'): void
  (e: 'create'): void
  (e: 'upload-files', files: File[]): void
  (e: 'rename-collection'): void
  (e: 'delete-collection'): void
  (e: 'toggle-sort-order'): void
  (e: 'set-saved-view-persist-search', value: boolean): void
  (e: 'set-saved-view-persist-tags', value: boolean): void
  (e: 'set-orphans-only', value: boolean): void
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const { 
  isDropZoneActive: isDropZoneActiveLocal, 
  onDragEnter, 
  onDragOver, 
  onDragLeave, 
  onDrop 
} = useContentFileUpload((files) => emit('upload-files', files))

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    emit('upload-files', Array.from(input.files))
  }
  input.value = ''
}
const infoTooltipText = computed(() => {
  const parts = [t('contentLibrary.actions.uploadMediaTooltip')]

  if (props.activeCollection?.type === 'GROUP') {
    parts.push(t('contentLibrary.actions.groupsInfoTooltip'))
  } else if (props.activeCollection?.type === 'SAVED_VIEW') {
    parts.push(t('contentLibrary.collections.types.savedView.description'))
  }

  return parts.join('\n\n')
})

const sortByToggleOptions = computed(() => {
  return (props.sortOptions ?? []).map((opt: any) => ({
    value: opt.id,
    icon: opt.icon,
    title: opt.label,
  }))
})

const savedViewPersistSearch = computed(() => {
  const raw = props.activeCollection?.config?.persistSearch
  return typeof raw === 'boolean' ? raw : false
})

const savedViewPersistTags = computed(() => {
  const raw = props.activeCollection?.config?.persistTags
  return typeof raw === 'boolean' ? raw : true
})

const toolbarMenuItems = computed(() => {
  const items: any[] = []

  if (props.activeCollection) {
    if (props.activeCollection.type === 'SAVED_VIEW') {
      items.push([
        {
          label: t('contentLibrary.savedView.persistSearch.label'),
          icon: savedViewPersistSearch.value ? 'i-heroicons-check-circle text-success-500' : 'i-heroicons-x-circle',
          title: savedViewPersistSearch.value
            ? t('contentLibrary.savedView.persistSearch.enabledTitle')
            : t('contentLibrary.savedView.persistSearch.disabledTitle'),
          onSelect: () => emit('set-saved-view-persist-search', !savedViewPersistSearch.value),
        },
        {
          label: t('contentLibrary.savedView.persistTags.label'),
          icon: savedViewPersistTags.value ? 'i-heroicons-check-circle text-success-500' : 'i-heroicons-x-circle',
          title: savedViewPersistTags.value
            ? t('contentLibrary.savedView.persistTags.enabledTitle')
            : t('contentLibrary.savedView.persistTags.disabledTitle'),
          onSelect: () => emit('set-saved-view-persist-tags', !savedViewPersistTags.value),
        },
      ])

      if (!props.orphansOnly) {
        items.push([
          {
            label: t('contentLibrary.savedView.orphans.label'),
            icon: 'i-heroicons-folder-minus',
            title: t('contentLibrary.savedView.orphans.title'),
            onSelect: () => emit('set-orphans-only', true),
          },
        ])
      }
    }

    items.push([
      {
        label: t('common.rename'),
        icon: 'i-heroicons-pencil-square',
        onSelect: () => emit('rename-collection'),
      },
    ])

    if (props.canDeleteActiveCollection !== false) {
      items.push([
        {
          label: t('common.delete'),
          icon: 'i-heroicons-trash',
          onSelect: () => emit('delete-collection'),
        },
      ])
    }
  }

  return items
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-start justify-between gap-4 w-full">
      <div class="min-w-0">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
          {{ scope === 'personal' ? t('contentLibrary.title') : t('project.contentLibrary') }}
          <CommonCountBadge :count="totalInScope" :title="t('contentLibrary.badgeCountTooltip')" />
        </h1>
        
        <template v-if="scope === 'project'">
          <NuxtLink
            v-if="currentProject"
            :to="`/projects/${projectId}`"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium flex items-center gap-1"
          >
            <UIcon name="i-heroicons-folder" class="w-4 h-4" />
            {{ currentProject.name }}
          </NuxtLink>
        </template>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('contentLibrary.subtitlePersonal') }}
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0 pt-1">
        <UButton
          class="cursor-pointer"
          variant="ghost" 
          :icon="archiveStatus === 'archived' ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-trash'"
          size="sm"
          @click="emit('update:archiveStatus', archiveStatus === 'active' ? 'archived' : 'active')"
        >
          {{ archiveStatus === 'archived' ? t('contentLibrary.filter.active') : t('contentLibrary.filter.archived') }}
        </UButton>
        
        <UButton
          v-if="archiveStatus === 'archived'"
          class="cursor-pointer"
          size="sm"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :loading="isPurging"
          @click="emit('purge')"
        >
          {{ t('contentLibrary.actions.purgeArchived') }}
        </UButton>
      </div>
    </div>

    <slot name="collections" />

    <!-- Toolbar Card -->
    <div
      class="relative overflow-hidden app-card-lg space-y-4 border transition-all duration-300"
      :class="[
        isDropZoneActiveLocal
          ? 'ring-2 ring-primary-500/70 border-primary-400 bg-linear-to-br from-primary-50/90 via-primary-100/40 to-emerald-50/30 dark:from-primary-900/30 dark:via-primary-900/15 dark:to-emerald-900/10 shadow-lg shadow-primary-500/20 scale-[1.01]'
          : isWindowFileDragActive
            ? 'border-primary-400/50 border-dashed bg-primary-50/20 dark:bg-primary-900/10 shadow-md ring-2 ring-primary-500/10'
            : 'border-gray-200/70 dark:border-gray-700/70'
      ]"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isDropZoneActiveLocal"
          class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-[1px]"
        >
          <div class="inline-flex items-center gap-2 rounded-xl border border-primary-400/70 bg-white/95 dark:bg-gray-900/90 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 shadow-xl ring-4 ring-primary-500/10">
            <UIcon name="i-heroicons-arrow-up-tray" class="w-5 h-5 animate-bounce" />
            <span>{{ t('media.dropHere') }}</span>
          </div>
        </div>
      </Transition>

      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden"
        @change="onFileInputChange"
      >
      <slot />
      <div class="flex flex-col gap-4">

        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:min-w-0">
            <CommonSearchInput v-model="q" :placeholder="t('contentLibrary.searchPlaceholder')" class="w-full sm:flex-1 sm:min-w-0" />
            <PublicationsTagsFilter
              v-model="selectedTags"
              :placeholder="t('contentLibrary.filter.filterByTags')"
              :publication-tags="availableTags"
              :project-id="projectId"
              :user-id="userId"
              :scope="scope"
              :group-id="Array.isArray(groupIds) ? groupIds[0] : undefined"
              :search-endpoint="'/content-library/tags/search'"
              class="w-full sm:flex-1 sm:min-w-0"
            />
          </div>

          <div class="flex items-center justify-end gap-2 shrink-0 flex-nowrap">
            <UiAppButtonGroup
              v-model="sortBy"
              :options="sortByToggleOptions"
              active-variant="solid"
              variant="outline"
            />
            <UButton class="cursor-pointer" :icon="sortOrderIcon" color="neutral" variant="ghost" :title="sortOrderLabel" @click="emit('toggle-sort-order')" />

            <UDropdownMenu v-if="toolbarMenuItems.length > 0" :items="toolbarMenuItems">
              <UButton
                class="cursor-pointer"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-ellipsis-horizontal"
                :title="t('common.more')"
                :aria-label="t('common.more')"
              />
            </UDropdownMenu>
          </div>
        </div>

        <div v-if="activeCollection" class="flex justify-between items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <template v-if="archiveStatus === 'active'">
              <UButton
                class="cursor-pointer"
                color="primary"
                size="sm"
                icon="i-heroicons-plus"
                :loading="isStartCreating"
                @click="emit('create')"
              >
                {{ t('contentLibrary.actions.createEmpty') }}
              </UButton>

              <UButton
                class="cursor-pointer"
                color="neutral"
                size="sm"
                variant="outline"
                icon="i-heroicons-cloud-arrow-up"
                @click="triggerFilePicker"
              >
                {{ t('contentLibrary.actions.uploadMedia') }}
              </UButton>

              <CommonInfoTooltip :text="infoTooltipText" />
            </template>
          </div>

          <div class="flex items-center justify-end gap-2">
            <UButton
              v-if="activeCollection?.type === 'SAVED_VIEW' && orphansOnly"
              class="cursor-pointer"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-heroicons-x-mark"
              :title="t('contentLibrary.savedView.orphans.clearTitle')"
              @click="emit('set-orphans-only', false)"
            >
              {{ t('contentLibrary.savedView.orphans.chip') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
