<script setup lang="ts">
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
}>()

const q = defineModel<string>('q')
const selectedTags = defineModel<string[]>('selectedTags')
const sortBy = defineModel<string>('sortBy')
const sortOrder = defineModel<'asc' | 'desc'>('sortOrder')
const viewMode = defineModel<any>('viewMode')

const emit = defineEmits<{
  (e: 'update:archiveStatus', value: 'active' | 'archived'): void
  (e: 'purge'): void
  (e: 'create'): void
  (e: 'upload-files', files: File[]): void
  (e: 'rename-tab'): void
  (e: 'delete-tab'): void
  (e: 'toggle-sort-order'): void
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDropZoneActiveLocal = ref(false)
const dragDepth = ref(0)

const isDropZoneActive = computed(() => isDropZoneActiveLocal.value || Boolean(props.isWindowFileDragActive))

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
      class="app-card-lg space-y-4 transition-colors"
      :class="isDropZoneActive ? 'ring-2 ring-primary-500/60 bg-primary-50/30 dark:bg-primary-900/10' : ''"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden"
        @change="onFileInputChange"
      >
      <slot />
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
              <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-pencil-square" @click="emit('rename-tab')">
                {{ t('common.rename') }}
              </UButton>
              <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" @click="emit('delete-tab')">
                {{ t('common.delete') }}
              </UButton>
            </template>
            <div v-if="activeTab" class="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <CommonViewToggle v-model="viewMode" />
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
