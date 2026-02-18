<script setup lang="ts">
const props = defineProps<{
  selectedIds: string[]
  archiveStatus: 'active' | 'archived'
  isGroupCollection: boolean
  hideCreatePublication?: boolean
}>()

const emit = defineEmits<{
  (e: 'archive'): void
  (e: 'restore'): void
  (e: 'purge'): void
  (e: 'move'): void
  (e: 'to-group'): void
  (e: 'merge'): void
  (e: 'create-publication'): void
  (e: 'clear'): void
}>()

const { t } = useI18n()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-full opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-full opacity-0"
  >
    <div v-if="selectedIds.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-full shadow-2xl border border-gray-700 flex items-center gap-6 min-w-max">
      <span class="text-sm font-medium border-r border-gray-700 pr-6 mr-0">
        {{ t('common.selected', { count: selectedIds.length }) }}
      </span>

      <div class="flex items-center gap-2">
        <template v-if="archiveStatus === 'archived'">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="emit('restore')"
          >
            {{ t('common.restore', 'Restore') }}
          </UButton>

          <UButton
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="emit('purge')"
          >
            {{ t('common.deleteForever', 'Delete forever') }}
          </UButton>
        </template>

        <template v-else>
          <UButton
            color="warning"
            variant="ghost"
            icon="i-heroicons-archive-box"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="emit('archive')"
          >
            {{ t('contentLibrary.actions.moveToTrash', 'Move to trash') }}
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-folder-open"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="emit('move')"
          >
            {{ t('contentLibrary.bulk.move') }}
          </UButton>

          <UButton
            v-if="selectedIds.length >= 2"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-square-3-stack-3d"
            size="sm"
            class="text-white hover:bg-gray-700"
            @click="emit('merge')"
          >
            {{ t('contentLibrary.bulk.merge') }}
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-paper-airplane"
            size="sm"
            class="text-white hover:bg-gray-700"
            v-if="!hideCreatePublication"
            @click="emit('create-publication')"
          >
            {{ t('contentLibrary.bulk.createPublication') }}
          </UButton>
        </template>
      </div>

      <UButton
        color="neutral"
        variant="ghost"
        icon="i-heroicons-x-mark"
        size="sm"
        class="text-gray-400 hover:text-white"
        @click="emit('clear')"
      />
    </div>
  </Transition>
</template>
