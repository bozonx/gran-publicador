<script setup lang="ts">
interface GroupBreadcrumb {
  id: string
  title: string
}

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  totalUnfiltered: number
  currentProject?: any
  archiveStatus: 'active' | 'archived'
  isPurging: boolean
  activeTab?: any
  isStartCreating: boolean
  availableTags: string[]
  sortOptions: any[]
  currentSortOption?: any
  sortOrderIcon: string
  sortOrderLabel: string
  isWindowFileDragActive?: boolean
  tabBreadcrumbs?: GroupBreadcrumb[]
}>()

const q = defineModel<string>('q')
const selectedTags = defineModel<string[]>('selectedTags')
const sortBy = defineModel<string>('sortBy')
const sortOrder = defineModel<'asc' | 'desc'>('sortOrder')

const emit = defineEmits<{
  (e: 'update:archiveStatus', value: 'active' | 'archived'): void
  (e: 'purge'): void
  (e: 'create'): void
  (e: 'upload-files', files: File[]): void
  (e: 'create-subgroup'): void
  (e: 'rename-tab'): void
  (e: 'delete-tab'): void
  (e: 'toggle-sort-order'): void
  (e: 'select-breadcrumb-tab', tabId: string): void
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDropZoneActiveLocal = ref(false)
const dragDepth = ref(0)

function isFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes('Files') ?? false
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function emitSelectedFiles(fileList: FileList | null | undefined) {
  if (!fileList?.length) {
    return
  }

  emit('upload-files', Array.from(fileList))
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  emitSelectedFiles(input.files)
  input.value = ''
}

function onDragEnter(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  dragDepth.value += 1
  isDropZoneActiveLocal.value = true
}

function onDragOver(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  isDropZoneActiveLocal.value = true
}

function onDragLeave(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)

  if (dragDepth.value === 0) {
    isDropZoneActiveLocal.value = false
  }
}

function onDrop(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }

  event.preventDefault()
  dragDepth.value = 0
  isDropZoneActiveLocal.value = false
  emitSelectedFiles(event.dataTransfer?.files)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
          {{ scope === 'personal' ? t('contentLibrary.title') : t('project.contentLibrary') }}
          <CommonCountBadge :count="totalUnfiltered" :title="t('contentLibrary.badgeCountTooltip')" />
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
          variant="ghost" 
          :icon="archiveStatus === 'archived' ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-trash'"
          size="sm"
          @click="emit('update:archiveStatus', archiveStatus === 'active' ? 'archived' : 'active')"
        >
          {{ archiveStatus === 'archived' ? t('contentLibrary.filter.active') : t('contentLibrary.filter.archived') }}
        </UButton>
        
        <UButton
          v-if="archiveStatus === 'archived'"
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
      <div
        v-if="(tabBreadcrumbs?.length || 0) > 0"
        class="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-50/80 px-3 py-2 text-sm text-gray-600 dark:border-gray-700/70 dark:bg-gray-800/50 dark:text-gray-300"
      >
        <template v-for="(crumb, index) in tabBreadcrumbs" :key="crumb.id">
          <UButton
            :variant="index === tabBreadcrumbs!.length - 1 ? 'soft' : 'ghost'"
            color="neutral"
            size="xs"
            :disabled="index === tabBreadcrumbs!.length - 1"
            class="max-w-56"
            @click="emit('select-breadcrumb-tab', crumb.id)"
          >
            <span class="truncate">{{ crumb.title }}</span>
          </UButton>
          <UIcon
            v-if="index < tabBreadcrumbs!.length - 1"
            name="i-heroicons-chevron-right"
            class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
          />
        </template>
      </div>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center pb-2 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2">
            <template v-if="archiveStatus === 'active'">
              <UButton
                color="primary"
                size="sm"
                icon="i-heroicons-plus"
                :loading="isStartCreating"
                @click="emit('create')"
              >
                {{ t('contentLibrary.actions.createEmpty') }}
              </UButton>

              <UButton
                color="neutral"
                size="sm"
                variant="outline"
                icon="i-heroicons-cloud-arrow-up"
                @click="triggerFilePicker"
              >
                {{ t('contentLibrary.actions.uploadMedia') }}
              </UButton>

              <CommonInfoTooltip :text="t('contentLibrary.actions.uploadMediaTooltip')" />
            </template>
          </div>

          <div class="flex items-center gap-2">
            <template v-if="activeTab">
              <UButton
                v-if="archiveStatus === 'active' && activeTab.type === 'GROUP'"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-folder-plus"
                @click="emit('create-subgroup')"
              >
                {{ t('contentLibrary.tabs.createSubgroup') }}
              </UButton>
              <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-pencil-square" @click="emit('rename-tab')">
                {{ t('common.rename') }}
              </UButton>
              <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" @click="emit('delete-tab')">
                {{ t('common.delete') }}
              </UButton>
            </template>
            <div v-if="activeTab" class="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <CommonInfoTooltip :text="t('contentLibrary.actions.groupsInfoTooltip')" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <UInput v-model="q" :placeholder="t('contentLibrary.searchPlaceholder')" icon="i-heroicons-magnifying-glass" class="w-full" />
          <USelectMenu v-model="selectedTags" :items="availableTags" multiple :placeholder="t('contentLibrary.filter.filterByTags')" class="w-full" icon="i-heroicons-tag" searchable />
          <div class="flex items-center gap-2">
            <USelectMenu v-model="sortBy" :items="sortOptions" value-key="id" label-key="label" class="flex-1" :searchable="false">
              <template #leading>
                <UIcon v-if="currentSortOption" :name="currentSortOption.icon" class="w-4 h-4" />
              </template>
            </USelectMenu>
            <UButton :icon="sortOrderIcon" color="neutral" variant="ghost" :title="sortOrderLabel" @click="emit('toggle-sort-order')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
