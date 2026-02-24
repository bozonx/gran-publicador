<script setup lang="ts">
import type { PublicationStatus } from '~/types/posts'

interface Props {
  selectedIds: string[]
  isArchivedView: boolean
  pending?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['clear', 'archive', 'restore', 'setStatus', 'move', 'delete'])

const { t } = useI18n()
const { statusOptions } = usePublications()

const bulkStatusOptions = computed(() => [
  ...statusOptions.value
    .filter(opt => ['DRAFT', 'READY'].includes(opt.value))
    .map(opt => ({
      label: opt.label,
      icon: 'i-heroicons-tag',
      onSelect: () => emit('setStatus', opt.value)
    }))
])
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
      <div class="flex items-center gap-2 border-r border-gray-700 pr-6 mr-2">
        <span class="text-sm font-medium">{{ t('common.selected', { count: selectedIds.length }) }}</span>
        <UButton 
          color="neutral" 
          variant="ghost" 
          size="xs" 
          icon="i-heroicons-x-mark" 
          @click="emit('clear')"
        />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-if="!isArchivedView"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-archive-box"
          size="sm"
          :loading="pending"
          @click="emit('archive')"
        >
          {{ t('common.archive') }}
        </UButton>
        <UButton
          v-else
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          size="sm"
          :loading="pending"
          @click="emit('restore')"
        >
          {{ t('common.restore') }}
        </UButton>

        <UDropdownMenu :items="bulkStatusOptions" :popper="{ placement: 'top' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-adjustments-horizontal"
            size="sm"
            :loading="pending"
          >
            {{ t('post.statusLabel') }}
          </UButton>
        </UDropdownMenu>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-folder-plus"
          size="sm"
          :loading="pending"
          @click="emit('move')"
        >
          {{ t('publication.bulk.moveToProject') }}
        </UButton>

        <UButton
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          size="sm"
          :loading="pending"
          @click="emit('delete')"
        >
          {{ t('common.delete') }}
        </UButton>
      </div>
    </div>
  </Transition>
</template>
