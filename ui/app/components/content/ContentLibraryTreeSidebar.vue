<script setup lang="ts">
import { calculateRecursiveGroupCounters } from '@gran/shared/content-library-tree'
import type { TreeItem } from '@nuxt/ui'
import { type ContentCollection } from '~/composables/useContentCollections'
import { getApiErrorMessage } from '~/utils/error'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import { buildGroupTreeFromRoot, getRootGroupId } from '~/composables/useContentLibraryGroupsTree'

interface GroupTreeNode extends TreeItem {
  label: string
  value: string
  children?: GroupTreeNode[]
}

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  collections: ContentCollection[]
  activeCollection: ContentCollection | null
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  'select-node': [id: string]
  'refresh-collections': []
  'refresh-items': [{ reset: boolean }]
}>()

const { t } = useI18n()
const toast = useToast()
const { createCollection, updateCollection, deleteCollection } = useContentCollections()

const collectionsById = computed(() => new Map(props.collections.map(c => [c.id, c])))
const allScopeGroupCollections = computed(() => props.collections.filter(c => c.type === 'GROUP'))

const recursiveCounts = computed(() => calculateRecursiveGroupCounters(props.collections as any))

const activeRootGroupId = computed(() => {
  if (props.activeCollection?.type !== 'GROUP') {
    return null
  }

  return getRootGroupId({
    activeGroupId: props.activeCollection.id,
    collectionsById: collectionsById.value as any,
  })
})

const formatGroupTreeLabel = (collection: ContentCollection) => {
  const count = recursiveCounts.value.get(collection.id) ?? Number(collection.directItemsCount ?? 0)
  return `${collection.title} (${count})`
}

const sidebarGroupTreeItems = computed<GroupTreeNode[]>(() => {
  if (!activeRootGroupId.value) {
    return []
  }

  const mapNode = (node: any): GroupTreeNode => ({
    ...node,
    slot: 'group-node',
    children: node.children ? node.children.map(mapNode) : undefined,
  })

  const items = buildGroupTreeFromRoot({
    rootId: activeRootGroupId.value,
    allGroupCollections: allScopeGroupCollections.value,
    labelFn: (c) => formatGroupTreeLabel(c as any),
  })

  return items.map(mapNode)
})

const getGroupTreeNodeValue = (node: unknown): string => {
  if (!node || typeof node !== 'object' || !('value' in node)) return ''
  return (node as any).value || ''
}

const getGroupTreeNodeLabel = (node: unknown): string => {
  if (!node || typeof node !== 'object' || !('label' in node)) return ''
  return (node as any).label || ''
}

const hasTreeChildren = (node: unknown): boolean => {
  return Array.isArray((node as any)?.children) && (node as any).children.length > 0
}

const expanded = ref<string[]>([])

const selected = ref<GroupTreeNode | undefined>(undefined)

const findNodeById = (nodes: GroupTreeNode[], id: string): GroupTreeNode | undefined => {
  for (const n of nodes) {
    if (n.value === id) return n
    if (n.children && n.children.length > 0) {
      const found = findNodeById(n.children, id)
      if (found) return found
    }
  }
  return undefined
}

const getPathToRoot = (id: string): string[] => {
  const out: string[] = []
  let cursor: ContentCollection | undefined = collectionsById.value.get(id)
  const visited = new Set<string>()

  while (cursor && cursor.type === 'GROUP' && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    out.push(cursor.id)

    if (!cursor.parentId) break
    cursor = collectionsById.value.get(cursor.parentId)
  }
  return out
}

watch(() => props.collections, (next) => {
  if (!next) return
  expanded.value = next.filter(c => c.type === 'GROUP').map(c => c.id)
}, { immediate: true })

watch(
  () => props.selectedNodeId,
  (next) => {
    if (!next) {
      selected.value = undefined
      return
    }
    selected.value = findNodeById(sidebarGroupTreeItems.value, next)
  },
  { immediate: true },
)

watch(selected, (next) => {
  const id = next?.value ?? ''
  if (id && id !== props.selectedNodeId) {
    emit('select-node', id)
    emit('refresh-items', { reset: true })
  }
})

// Tree Actions Logic
const isTreeCreateModalOpen = ref(false)
const treeCreateParentId = ref<string | null>(null)
const treeCreateTitle = ref('')
const isCreatingTreeGroup = ref(false)

const isTreeRenameModalOpen = ref(false)
const treeRenameTargetId = ref<string | null>(null)
const treeRenameTitle = ref('')
const isRenamingTreeGroup = ref(false)

const isTreeDeleteConfirmModalOpen = ref(false)
const treeDeleteTargetId = ref<string | null>(null)
const isDeletingTreeGroup = ref(false)

const treeCreateParentLabel = computed(() => {
  if (!treeCreateParentId.value) return '-'
  return collectionsById.value.get(treeCreateParentId.value)?.title ?? '-'
})

const treeDeleteTargetLabel = computed(() => {
  if (!treeDeleteTargetId.value) return '-'
  return collectionsById.value.get(treeDeleteTargetId.value)?.title ?? '-'
})

const openTreeCreateModal = (parentId: string) => {
  const parentCollection = collectionsById.value.get(parentId)
  if (!parentCollection || parentCollection.type !== 'GROUP') return

  treeCreateParentId.value = parentId
  treeCreateTitle.value = ''
  isTreeCreateModalOpen.value = true
}

const handleCreateGroupFromTreeModal = async () => {
  const title = treeCreateTitle.value.trim()
  if (!treeCreateParentId.value || !title) return

  isCreatingTreeGroup.value = true
  try {
    const parentGroupType =
      props.scope === 'project'
        ? ((collectionsById.value.get(treeCreateParentId.value)?.groupType as any) ?? 'PROJECT_USER')
        : undefined

    const newCollection = await createCollection({
      scope: props.scope,
      projectId: props.projectId,
      type: 'GROUP',
      ...(props.scope === 'project' ? { groupType: parentGroupType } : {}),
      parentId: treeCreateParentId.value,
      title,
      config: {},
    })

    const path = getPathToRoot(treeCreateParentId.value)
    expanded.value = Array.from(new Set([...expanded.value, ...path]))

    emit('refresh-collections')
    emit('select-node', newCollection.id)
    isTreeCreateModalOpen.value = false
    emit('refresh-items', { reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to create subgroup'), color: 'error' })
  } finally {
    isCreatingTreeGroup.value = false
  }
}

const openTreeRenameModal = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  if (!targetCollection || targetCollection.type !== 'GROUP' || !targetCollection.parentId) return

  treeRenameTargetId.value = collectionId
  treeRenameTitle.value = targetCollection.title
  isTreeRenameModalOpen.value = true
}

const handleRenameGroupFromTree = async () => {
  const title = treeRenameTitle.value.trim()
  if (!treeRenameTargetId.value || !title) return

  isRenamingTreeGroup.value = true
  try {
    const updatedCollection = await updateCollection(treeRenameTargetId.value, {
      scope: props.scope,
      projectId: props.projectId,
      title,
    })

    emit('refresh-collections')
    if (props.activeCollection?.id === treeRenameTargetId.value) {
      emit('select-node', updatedCollection.id)
    }

    isTreeRenameModalOpen.value = false
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to rename subgroup'), color: 'error' })
  } finally {
    isRenamingTreeGroup.value = false
  }
}

const openTreeDeleteModal = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  if (!targetCollection || targetCollection.type !== 'GROUP' || !targetCollection.parentId) return

  treeDeleteTargetId.value = collectionId
  isTreeDeleteConfirmModalOpen.value = true
}

const handleDeleteGroupFromTree = async () => {
  if (!treeDeleteTargetId.value) return

  const targetCollection = collectionsById.value.get(treeDeleteTargetId.value)
  if (!targetCollection) return

  const parentId = targetCollection.parentId
  isDeletingTreeGroup.value = true
  try {
    await deleteCollection(targetCollection.id, props.scope, props.projectId)
    emit('refresh-collections')

    if (parentId) {
      emit('select-node', parentId)
    } else {
      emit('select-node', '')
    }

    isTreeDeleteConfirmModalOpen.value = false
    emit('refresh-items', { reset: true })
  } catch (e: any) {
    toast.add({ title: t('common.error'), description: getApiErrorMessage(e, 'Failed to delete group'), color: 'error' })
  } finally {
    isDeletingTreeGroup.value = false
  }
}

const getGroupNodeMenuItems = (collectionId: string) => {
  const targetCollection = collectionsById.value.get(collectionId)
  const menuItems: Array<{ label: string; icon: string; onSelect: () => void }> = [
    {
      label: t('contentLibrary.collections.createSubgroup'),
      icon: 'i-heroicons-folder-plus',
      onSelect: () => openTreeCreateModal(collectionId),
    },
  ]

  if (targetCollection?.parentId) {
    menuItems.push({
      label: t('common.rename'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openTreeRenameModal(collectionId),
    })
  }

  if (targetCollection?.parentId) {
    menuItems.push({
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      onSelect: () => openTreeDeleteModal(collectionId),
    })
  }

  return [menuItems]
}
</script>

<template>
  <aside class="app-card-lg border border-gray-200/70 dark:border-gray-700/70 space-y-4">
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('contentLibrary.groupsTree.title') }}
      </h3>
    </div>

    <div class="rounded-md border border-gray-200 dark:border-gray-800 p-3 max-h-128 overflow-auto">
      <div v-if="sidebarGroupTreeItems.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('contentLibrary.groupsTree.empty') }}
      </div>
      <UTree
        v-else
        v-model="selected"
        v-model:expanded="expanded"
        :items="sidebarGroupTreeItems"
        :get-key="(i: any) => i.value"
        :ui="{ item: 'cursor-pointer' }"
      >
        <template #group-node-leading="{ item, expanded, handleToggle }">
          <UButton
            v-if="hasTreeChildren(item)"
            variant="ghost"
            color="neutral"
            size="xs"
            :icon="expanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
            class="p-0.5"
            @click.stop="handleToggle"
          />
        </template>
        <template #group-node-label="{ item }">
          <span
            class="flex-1 truncate text-sm py-1 transition-colors"
            :class="selectedNodeId === getGroupTreeNodeValue(item)
              ? 'text-primary-600 dark:text-primary-300'
              : 'text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-300'"
            @click.stop="() => { selected = item as any }"
          >
            {{ getGroupTreeNodeLabel(item) }}
          </span>
        </template>
        <template #group-node-trailing="{ item }">
          <UDropdownMenu :items="getGroupNodeMenuItems(getGroupTreeNodeValue(item))">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-heroicons-ellipsis-horizontal"
              :aria-label="t('contentLibrary.groupsTree.nodeMenuAriaLabel')"
              @click.stop
            />
          </UDropdownMenu>
        </template>
      </UTree>
    </div>

    <!-- Subgroup Modals -->
    <UiAppModal
      v-model:open="isTreeCreateModalOpen"
      :title="t('contentLibrary.collections.createSubgroupTitle')"
      :description="t('contentLibrary.groupsTree.selectedParentHint', { title: treeCreateParentLabel })"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isTreeCreateModalOpen = false"
    >
      <UFormField :label="t('common.title')">
        <UInput v-model="treeCreateTitle" autofocus @keydown.enter="handleCreateGroupFromTreeModal" />
      </UFormField>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTreeCreateModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isCreatingTreeGroup"
          :disabled="!treeCreateTitle.trim()"
          @click="handleCreateGroupFromTreeModal"
        >
          {{ t('common.create') }}
        </UButton>
      </template>
    </UiAppModal>

    <UiAppModal
      v-model:open="isTreeRenameModalOpen"
      :title="t('contentLibrary.collections.renameTitle', 'Rename group')"
      :ui="{ content: 'w-full max-w-md' }"
      @close="isTreeRenameModalOpen = false"
    >
      <UFormField :label="t('common.title', 'Title')">
        <UInput v-model="treeRenameTitle" autofocus @keydown.enter="handleRenameGroupFromTree" />
      </UFormField>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTreeRenameModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isRenamingTreeGroup"
          :disabled="!treeRenameTitle.trim()"
          @click="handleRenameGroupFromTree"
        >
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>

    <UiConfirmModal
      v-if="isTreeDeleteConfirmModalOpen"
      v-model:open="isTreeDeleteConfirmModalOpen"
      :title="t('contentLibrary.collections.deleteTitle')"
      :description="t('contentLibrary.groupsTree.deleteConfirmDescription', { title: treeDeleteTargetLabel })"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-trash"
      :loading="isDeletingTreeGroup"
      @confirm="handleDeleteGroupFromTree"
    />
  </aside>
</template>
