<script setup lang="ts">
import { type ContentCollection, useContentCollections } from '~/composables/useContentCollections'
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree'
import ContentGroupSelectTree from './ContentGroupSelectTree.vue'

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
  (e: 'move', payload: {
    operation: 'MOVE_TO_GROUP' | 'LINK_TO_GROUP' | 'SET_PROJECT'
    projectId?: string | null
    groupId?: string | null
    sourceGroupId?: string
  }): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const toGroupTreeItems = computed<ContentLibraryTreeItem[]>(() => {
  if (props.activeCollection?.type !== 'GROUP') return []

  return [
    {
      label: props.activeCollection.title,
      value: props.activeCollection.id,
      defaultExpanded: true,
      children: (props.folderTreeItems ?? []) as any,
    },
  ]
})
const { t } = useI18n()
const { listCollections } = useContentCollections()

const targetProjectId = ref<string | null>(null)
const targetGroupIdInProject = ref<string | null>(null)
const targetProjectCollections = ref<ContentCollection[]>([])
const isLoadingTargetCollections = ref(false)

const moveMode = ref<'MOVE' | 'LINK'>('MOVE')

const targetCollectionId = ref<string | null>(null)

const currentProjectId = computed(() => {
  return props.scope === 'project' ? (props.projectId ?? null) : null
})

const accordionItems = computed(() => {
  const items = []

  // 1. In folder (only if current collection is GROUP)
  if (props.activeCollection?.type === 'GROUP') {
    items.push({
      label: t('contentLibrary.moveModal.toGroup'),
      icon: 'i-heroicons-folder',
      slot: 'to-group',
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
    .filter(collection => !collection.parentId && collection.id !== props.activeCollection?.id)
    .map(collection => ({
      label: collection.title,
      value: collection.id
    }))
})

const selectedCollection = computed(() => {
  if (!targetCollectionId.value) return null
  return props.collections.find(c => c.id === targetCollectionId.value)
})

const targetCollectionTreeItems = computed(() => {
  if (!targetCollectionId.value) return []

  return buildGroupTreeFromRoot({
    rootId: targetCollectionId.value,
    allGroupCollections: props.collections,
    labelFn: (c) => c.title,
  })
})

const targetProjectCollectionTreeItems = computed(() => {
  if (!targetGroupIdInProject.value) return []

  return buildGroupTreeFromRoot({
    rootId: targetGroupIdInProject.value,
    allGroupCollections: targetProjectCollections.value,
    labelFn: (c) => c.title,
  })
})

const projectOptions = computed(() => {
  return props.projects
    .filter(p => !props.projectId || p.id !== props.projectId)
    .map(p => ({
      label: p.name,
      value: p.id
    }))
})

const targetProjectCollectionOptions = computed(() => {
  const options = targetProjectCollections.value
    .filter(c => (c.type === 'GROUP' || c.type === 'SAVED_VIEW') && !c.parentId)
    .map(c => ({
      label: c.title,
      value: c.id
    }))

  return [
    { label: t('contentLibrary.moveModal.noCollection'), value: null },
    ...options
  ]
})

async function fetchTargetProjectCollections(pId: string) {
  isLoadingTargetCollections.value = true
  try {
    targetProjectCollections.value = await listCollections('project', pId)
  } catch (e) {
    console.error('Failed to fetch target project collections', e)
  } finally {
    isLoadingTargetCollections.value = false
  }
}

watch(targetProjectId, (next) => {
  if (next) {
    fetchTargetProjectCollections(next)
    targetGroupIdInProject.value = null
  } else {
    targetProjectCollections.value = []
    targetGroupIdInProject.value = null
  }
})

const handleMoveToGroup = (groupId: string) => {
  if (!groupId) return
  if (props.activeCollection?.type !== 'GROUP') return

  if (moveMode.value === 'LINK') {
    emit('move', {
      operation: 'LINK_TO_GROUP',
      groupId,
    })
    isOpen.value = false
    return
  }

  emit('move', {
    operation: 'MOVE_TO_GROUP',
    groupId,
    sourceGroupId: props.activeCollection.id,
  })
  isOpen.value = false
}

const handleMoveToOtherCollectionGroup = (groupId: string) => {
  if (!groupId) return

  emit('move', {
    operation: 'SET_PROJECT',
    projectId: currentProjectId.value,
    groupId,
  })
  isOpen.value = false
}

const handleMoveToProjectGroup = (groupId: string) => {
  if (!groupId) return
  if (!targetProjectId.value) return

  emit('move', {
    operation: 'SET_PROJECT',
    projectId: targetProjectId.value,
    groupId,
  })
  isOpen.value = false
}

function handleMoveToCollection(next: unknown) {
  const targetId = (next && typeof next === 'object' && 'value' in next)
    ? (next as any).value
    : next

  targetCollectionId.value = (targetId ?? null) as any
}

function handleConfirmMoveToSavedView() {
  emit('move', {
    operation: 'SET_PROJECT',
    projectId: currentProjectId.value,
  })
  isOpen.value = false
}

function handleMoveToProjectCollection(next: unknown) {
  const targetId = (next && typeof next === 'object' && 'value' in next)
    ? (next as any).value
    : next

  targetGroupIdInProject.value = (targetId ?? null) as any
}

const selectedTargetProjectCollection = computed(() => {
  if (!targetGroupIdInProject.value) return null
  return targetProjectCollections.value.find(c => c.id === targetGroupIdInProject.value) ?? null
})

const hasSelectedProjectCollection = computed(() => {
  return targetGroupIdInProject.value !== null
})

function handleConfirmMoveToProjectSavedView() {
  if (!targetProjectId.value) return

  emit('move', {
    operation: 'SET_PROJECT',
    projectId: targetProjectId.value,
  })
  isOpen.value = false
}

function handleMoveToPersonal() {
  emit('move', {
    operation: 'SET_PROJECT',
    projectId: null
  })
  isOpen.value = false
}

// Reset state when closing
watch(isOpen, (next) => {
  if (!next) {
    targetProjectId.value = null
    targetGroupIdInProject.value = null
    targetProjectCollections.value = []
    targetCollectionId.value = null
    moveMode.value = 'MOVE'
  }
})

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
        <template #to-group>
          <div class="p-4 space-y-3">
            <UiAppButtonGroup
              v-model="moveMode"
              :options="[
                { value: 'MOVE', label: t('common.move', 'Move') },
                { value: 'LINK', label: t('contentLibrary.bulk.linkMode', 'Link') },
              ]"
              active-variant="solid"
              variant="outline"
              fluid
            />

            <div class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
              <ContentGroupSelectTree
                v-if="toGroupTreeItems.length > 0"
                :items="toGroupTreeItems as any"
                @select="handleMoveToGroup"
              />
              <div v-else class="text-sm text-gray-500 py-2 italic px-4">
                {{ t('contentLibrary.bulk.noGroupsInContext') }}
              </div>
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
              :search-input="{ placeholder: t('contentLibrary.bulk.searchGroups') }"
              :placeholder="t('contentLibrary.bulk.searchGroups')"
              @update:model-value="handleMoveToCollection"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>

            <div v-if="targetCollectionId" class="py-2">
              <div v-if="selectedCollection?.type === 'GROUP'" class="max-h-60 overflow-y-auto custom-scrollbar">
                <ContentGroupSelectTree
                  v-if="targetCollectionTreeItems.length > 0"
                  :items="targetCollectionTreeItems as any"
                  @select="handleMoveToOtherCollectionGroup"
                />
              </div>
              <div v-else-if="selectedCollection?.type === 'SAVED_VIEW'" class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                <UButton
                  color="primary"
                  icon="i-heroicons-arrow-right-circle"
                  @click="handleConfirmMoveToSavedView"
                >
                  {{ t('common.move') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>

        <template #to-project>
          <div class="p-4 space-y-4">
            <USelectMenu
              v-model="targetProjectId"
              :items="projectOptions"
              value-key="value"
              label-key="label"
              searchable
              :search-input="{ placeholder: t('contentLibrary.bulk.selectProject') }"
              :placeholder="t('contentLibrary.bulk.selectProject')"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>

            <div v-if="targetProjectId" class="space-y-2">
              <UFormField :label="t('contentLibrary.moveModal.selectCollectionInProject')">
                <USelectMenu
                  :items="targetProjectCollectionOptions"
                  value-key="value"
                  label-key="label"
                  :loading="isLoadingTargetCollections"
                  :placeholder="t('contentLibrary.bulk.searchGroups')"
                  @update:model-value="handleMoveToProjectCollection"
                />
              </UFormField>

              <div v-if="hasSelectedProjectCollection" class="space-y-2">
                <div v-if="selectedTargetProjectCollection?.type === 'GROUP'" class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
                  <ContentGroupSelectTree
                    v-if="targetProjectCollectionTreeItems.length > 0"
                    :items="targetProjectCollectionTreeItems as any"
                    @select="handleMoveToProjectGroup"
                  />
                </div>
                <div v-else class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                  <UButton
                    color="primary"
                    icon="i-heroicons-arrow-right-circle"
                    @click="handleConfirmMoveToProjectSavedView"
                  >
                    {{ t('common.move') }}
                  </UButton>
                </div>
              </div>
            </div>

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
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 9999px;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #374151;
}
</style>
