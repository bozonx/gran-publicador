<script setup lang="ts">
import { type ContentCollection, useContentCollections } from '~/composables/useContentCollections'
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree'

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
    operation: 'MOVE_TO_GROUP' | 'SET_PROJECT';
    targetId: string | null;
    targetGroupId?: string | null;
    sourceGroupId?: string;
  }): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const { listCollections } = useContentCollections()

const targetProjectId = ref<string | null>(null)
const targetGroupIdInProject = ref<string | null>(null)
const targetProjectCollections = ref<ContentCollection[]>([])
const isLoadingTargetCollections = ref(false)

const folderSelectedValue = ref<ContentLibraryTreeItem | undefined>(undefined)

const targetCollectionId = ref<string | null>(null)
const targetCollectionSelectedValue = ref<ContentLibraryTreeItem | undefined>(undefined)

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
  const options = props.collections
    .filter(collection => collection.type === 'GROUP' && !collection.parentId && collection.id !== props.activeCollection?.id)
    .map(collection => ({
      label: collection.title,
      value: collection.id
    }))

  return [
    { label: t('contentLibrary.moveModal.noCollection'), value: null },
    ...options
  ]
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
    .filter(c => c.type === 'GROUP' && !c.parentId)
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
    targetProjectSelectedValue.value = undefined
  } else {
    targetProjectCollections.value = []
    targetGroupIdInProject.value = null
    targetProjectSelectedValue.value = undefined
  }
})

const targetProjectSelectedValue = ref<ContentLibraryTreeItem | undefined>(undefined)

watch(folderSelectedValue, (next) => {
  if (!next) return
  handleMoveToGroup(next)
  folderSelectedValue.value = undefined
})

watch(targetCollectionSelectedValue, (next) => {
  if (!next) return
  handleMoveToGroup(next)
  targetCollectionSelectedValue.value = undefined
})

watch(targetProjectSelectedValue, (next) => {
  if (!next) return

  const targetGroupId = typeof next === 'string' ? next : next.value
  if (!targetGroupId) return

  emit('move', {
    operation: 'SET_PROJECT',
    targetId: targetProjectId.value,
    targetGroupId,
  })
  isOpen.value = false
  targetProjectSelectedValue.value = undefined
})

function handleMoveToGroup(node: any) {
  // UTree emits the item object, so we need node.value
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
  // collection.value can be null ("No collection")
  const targetId = collection.value

  if (targetId === null) {
    emit('move', {
      operation: 'MOVE_TO_GROUP',
      targetId: null,
      sourceGroupId: props.activeCollection?.id
    })
    isOpen.value = false
    return
  }

  targetCollectionId.value = targetId
  targetCollectionSelectedValue.value = undefined
}

function handleMoveToProjectCollection(collection: any) {
  const targetId = collection.value

  if (targetId === null) {
    emit('move', {
      operation: 'SET_PROJECT',
      targetId: targetProjectId.value,
      targetGroupId: null,
    })
    isOpen.value = false
    return
  }

  targetGroupIdInProject.value = targetId
  targetProjectSelectedValue.value = undefined
}

function handleMoveToPersonal() {
  emit('move', {
    operation: 'SET_PROJECT',
    targetId: null
  })
  isOpen.value = false
}

// Reset state when closing
watch(isOpen, (next) => {
  if (!next) {
    targetProjectId.value = null
    targetGroupIdInProject.value = null
    targetProjectCollections.value = []
    folderSelectedValue.value = undefined
    targetCollectionId.value = null
    targetCollectionSelectedValue.value = undefined
    targetProjectSelectedValue.value = undefined
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
        <template #to-folder>
          <div class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
            <UTree
              v-if="folderTreeItems.length > 0"
              v-model="folderSelectedValue"
              :items="folderTreeItems"
              class="w-full"
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
              :search-input="{ placeholder: t('contentLibrary.bulk.searchGroups') }"
              :placeholder="t('contentLibrary.bulk.searchGroups')"
              @update:model-value="handleMoveToCollection"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>

            <div v-if="targetCollectionId" class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
              <UTree
                v-if="targetCollectionTreeItems.length > 0"
                v-model="targetCollectionSelectedValue"
                :items="targetCollectionTreeItems"
                class="w-full"
              />
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

              <div v-if="targetGroupIdInProject" class="space-y-2">
                <div class="py-2 max-h-60 overflow-y-auto custom-scrollbar">
                  <UTree
                    v-if="targetProjectCollectionTreeItems.length > 0"
                    v-model="targetProjectSelectedValue"
                    :items="targetProjectCollectionTreeItems"
                    class="w-full"
                  />
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
