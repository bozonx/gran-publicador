<script setup lang="ts">
import type { ContentCollection } from '~/composables/useContentCollections'

interface Props {
  ids: string[]
  scope: 'personal' | 'project'
  projectId?: string
  activeCollection?: ContentCollection | null
  collections: ContentCollection[]
  projects: any[]
  folderTreeItems: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'move', payload: { operation: 'MOVE_TO_GROUP' | 'SET_PROJECT'; targetId: string | null; sourceGroupId?: string }): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const accordionItems = computed(() => {
  const items = []

  // 1. In folder (only if current collection is GROUP)
  if (props.activeCollection?.type === 'GROUP') {
    items.push({
      label: t('contentLibrary.moveModal.toFolder'),
      icon: 'i-heroicons-folder',
      slot: 'to-folder',
      defaultOpen: true
    })
  }

  // 2. In another collection
  items.push({
    label: t('contentLibrary.moveModal.toCollection'),
    icon: 'i-heroicons-rectangle-stack',
    slot: 'to-collection'
  })

  // 3. In another project
  items.push({
    label: t('contentLibrary.moveModal.toProject'),
    icon: 'i-heroicons-briefcase',
    slot: 'to-project'
  })

  return items
})

const collectionOptions = computed(() => {
  return props.collections
    .filter(collection => collection.type === 'GROUP' && collection.id !== props.activeCollection?.id)
    .map(collection => ({
      label: collection.title,
      value: collection.id
    }))
})

const projectOptions = computed(() => {
  return props.projects
    .filter(p => !props.projectId || p.id !== props.projectId)
    .map(p => ({
      label: p.name,
      value: p.id
    }))
})

function handleMoveToGroup(node: any) {
  const targetId = typeof node === 'string' ? node : node?.value
  if (!targetId) return

  emit('move', {
    operation: 'MOVE_TO_GROUP',
    targetId,
    sourceGroupId: props.activeCollection?.id
  })
  isOpen.value = false
}

function handleMoveToCollection(collection: any) {
  if (!collection?.value) return

  emit('move', {
    operation: 'MOVE_TO_GROUP',
    targetId: collection.value,
    sourceGroupId: props.activeCollection?.id
  })
  isOpen.value = false
}

function handleMoveToProject(project: any) {
  if (!project?.value) return

  emit('move', {
    operation: 'SET_PROJECT',
    targetId: project.value
  })
  isOpen.value = false
}

function handleMoveToPersonal() {
  emit('move', {
    operation: 'SET_PROJECT',
    targetId: null
  })
  isOpen.value = false
}

</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('contentLibrary.bulk.moveMode')"
    :ui="{ content: 'max-w-md' }"
  >
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('contentLibrary.bulk.toGroupDescription', { count: ids.length }) }}
      </p>

      <UAccordion :items="accordionItems" multiple>
        <template #to-folder>
          <div class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
            <UTree
              v-if="folderTreeItems.length > 0"
              :items="folderTreeItems"
              class="w-full"
              @select="handleMoveToGroup"
            />
            <div v-else class="text-sm text-gray-500 py-2 italic px-4">
              {{ t('contentLibrary.bulk.noGroupsInContext') }}
            </div>
          </div>
        </template>

        <template #to-collection>
          <div class="p-4 space-y-2">
            <USelectMenu
              :items="collectionOptions"
              value-key="value"
              label-key="label"
              searchable
              :placeholder="t('contentLibrary.bulk.searchGroups')"
              @update:model-value="handleMoveToCollection"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>
          </div>
        </template>

        <template #to-project>
          <div class="p-4 space-y-4">
            <USelectMenu
              :items="projectOptions"
              value-key="value"
              label-key="label"
              searchable
              :placeholder="t('contentLibrary.bulk.selectProject')"
              @update:model-value="handleMoveToProject"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>

            <UButton
              v-if="scope === 'project'"
              color="neutral"
              variant="outline"
              icon="i-heroicons-user"
              block
              @click="handleMoveToPersonal"
            >
              {{ t('contentLibrary.moveModal.toPersonal') }}
            </UButton>
          </div>
        </template>
      </UAccordion>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="isOpen = false"
      >
        {{ t('common.cancel') }}
      </UButton>
    </template>
  </UiAppModal>
</template>

<style scoped>
@reference "tailwindcss";

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-200 dark:bg-gray-700 rounded-full;
}
</style>
