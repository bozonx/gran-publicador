<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { ContentLibraryTab } from '~/composables/useContentLibraryTabs'
import CreateTabModal from '~/components/content/CreateTabModal.vue'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:active-tab': [tab: ContentLibraryTab | null]
  'update:tabs': [tabs: ContentLibraryTab[]]
}>()

const { t } = useI18n()
const toast = useToast()
const { listTabs, createTab, deleteTab, reorderTabs } = useContentLibraryTabs()

const tabs = ref<ContentLibraryTab[]>([])
const isLoading = ref(false)
const isCreateModalOpen = ref(false)
const isReordering = ref(false)

const activeTabId = computed({
  get: () => props.modelValue ?? null,
  set: (value) => emit('update:modelValue', value),
})

const topLevelTabs = computed<ContentLibraryTab[]>({
  get: () => tabs.value.filter(tab => tab.type === 'SAVED_VIEW' || !tab.parentId),
  set: (nextTopLevelTabs) => {
    const topLevelIds = new Set(nextTopLevelTabs.map(tab => tab.id))
    const nestedTabs = tabs.value.filter(tab => !topLevelIds.has(tab.id))
    tabs.value = [...nextTopLevelTabs, ...nestedTabs]
  },
})

const tabById = computed(() => {
  return new Map(tabs.value.map(tab => [tab.id, tab]))
})

const groupChildrenByParentId = computed(() => {
  const result = new Map<string, ContentLibraryTab[]>()

  for (const tab of tabs.value) {
    if (tab.type !== 'GROUP' || !tab.parentId) {
      continue
    }

    const children = result.get(tab.parentId) ?? []
    children.push(tab)
    result.set(tab.parentId, children)
  }

  return result
})

const groupRecursiveItemsCount = computed(() => {
  const memo = new Map<string, number>()

  const countForGroup = (groupId: string, trail: Set<string>): number => {
    if (memo.has(groupId)) {
      return memo.get(groupId) ?? 0
    }

    if (trail.has(groupId)) {
      return 0
    }

    const group = tabById.value.get(groupId)
    if (!group || group.type !== 'GROUP') {
      return 0
    }

    const nextTrail = new Set(trail)
    nextTrail.add(groupId)

    let total = Number(group.directItemsCount ?? 0)
    const children = groupChildrenByParentId.value.get(groupId) ?? []

    for (const child of children) {
      total += countForGroup(child.id, nextTrail)
    }

    memo.set(groupId, total)
    return total
  }

  for (const tab of tabs.value) {
    if (tab.type !== 'GROUP') {
      continue
    }

    countForGroup(tab.id, new Set<string>())
  }

  return memo
})

const resolveTopLevelTabId = (tabId: string | null | undefined): string | null => {
  if (!tabId) {
    return null
  }

  let cursor = tabById.value.get(tabId)
  if (!cursor) {
    return null
  }

  if (cursor.type === 'SAVED_VIEW') {
    return cursor.id
  }

  while (cursor.parentId) {
    const parent = tabById.value.get(cursor.parentId)
    if (!parent) {
      break
    }
    cursor = parent
  }

  return cursor.id
}

const highlightedTabId = computed(() => resolveTopLevelTabId(activeTabId.value))

const getStorageKey = () => {
  return `content-library-tab-${props.scope}-${props.projectId || 'global'}`
}

const fetchTabs = async () => {
  if (props.scope === 'project' && !props.projectId) return

  isLoading.value = true
  try {
    tabs.value = await listTabs(props.scope, props.scope === 'project' ? props.projectId : undefined)
    emit('update:tabs', tabs.value)

    if (activeTabId.value) {
      const currentActiveTab = tabs.value.find(t => t.id === activeTabId.value)
      if (currentActiveTab) {
        emit('update:active-tab', currentActiveTab)
      }
    }
    
    // Restore from localStorage
    const savedTabId = localStorage.getItem(getStorageKey())
    const resolvedSavedTabId = resolveTopLevelTabId(savedTabId)
    const tabToRestore = resolvedSavedTabId ? topLevelTabs.value.find(t => t.id === resolvedSavedTabId) : null

    if (tabToRestore) {
      activeTabId.value = tabToRestore.id
      emit('update:active-tab', tabToRestore)
    } else {
      // Auto-select first tab if none selected or restored
      if (!activeTabId.value && topLevelTabs.value.length > 0 && topLevelTabs.value[0]) {
        activeTabId.value = topLevelTabs.value[0].id
        emit('update:active-tab', topLevelTabs.value[0])
      }
    }
  } catch (e: any) {
    console.error('Failed to fetch tabs', e)
  } finally {
    isLoading.value = false
  }
}

const handleCreateTab = async (data: { type: 'GROUP' | 'SAVED_VIEW'; title: string; groupType?: 'PROJECT_USER' | 'PROJECT_SHARED' }) => {
  try {
    const newTab = await createTab({
      scope: props.scope,
      projectId: props.projectId,
      type: data.type,
      groupType: data.type === 'GROUP' ? data.groupType : undefined,
      title: data.title,
      config: {},
    })
    
    await fetchTabs()
    activeTabId.value = newTab.id
    emit('update:active-tab', newTab)
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.tabs.createError'),
      color: 'error',
    })
  }
}

const handleDeleteTab = async (tabId: string) => {
  try {
    await deleteTab(tabId, props.scope, props.projectId)
    
    if (activeTabId.value === tabId) {
      activeTabId.value = null
      emit('update:active-tab', null)
    }
    
    await fetchTabs()
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.tabs.deleteError'),
      color: 'error',
    })
  }
}

const handleReorder = async () => {
  isReordering.value = true
  try {
    await reorderTabs({
      scope: props.scope,
      projectId: props.projectId,
      ids: tabs.value.map(t => t.id),
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: t('contentLibrary.tabs.reorderError'),
      color: 'error',
    })
    await fetchTabs()
  } finally {
    isReordering.value = false
  }
}

const getTabIcon = (type: 'GROUP' | 'SAVED_VIEW') => {
  return type === 'GROUP' ? 'i-heroicons-folder' : 'i-heroicons-bookmark'
}

const getTabColor = (type: 'GROUP' | 'SAVED_VIEW', isActive: boolean) => {
  if (isActive) return 'primary'
  return type === 'GROUP' ? 'neutral' : 'neutral'
}

const getTabLabel = (tab: ContentLibraryTab) => {
  if (tab.type !== 'GROUP') {
    return tab.title
  }

  const totalRecursiveCount = groupRecursiveItemsCount.value.get(tab.id) ?? Number(tab.directItemsCount ?? 0)
  return `${tab.title} (${totalRecursiveCount})`
}

watch(() => props.projectId, () => {
  if (props.scope === 'project') {
    fetchTabs()
  }
})

watch(activeTabId, (newId) => {
  const idToSave = resolveTopLevelTabId(newId)
  if (idToSave) {
    localStorage.setItem(getStorageKey(), idToSave)
  }
})

watch(() => props.scope, () => {
  activeTabId.value = null
  emit('update:active-tab', null)
  fetchTabs()
})

onMounted(() => {
  fetchTabs()
})

defineExpose({
    fetchTabs,
    tabs
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2 pb-2">
      <VueDraggable
        v-model="topLevelTabs"
        :animation="200"
        handle=".drag-handle"
        class="flex flex-wrap items-center gap-2 flex-1 min-w-0"
        @end="handleReorder"
      >
        <div
          v-for="tab in topLevelTabs"
          :key="tab.id"
          class="flex items-center gap-1 min-w-0"
        >
          <UButton
            :color="getTabColor(tab.type, highlightedTabId === tab.id)"
            :variant="highlightedTabId === tab.id ? 'solid' : 'outline'"
            size="sm"
            :icon="getTabIcon(tab.type)"
            class="drag-handle cursor-pointer max-w-full"
            @click="() => { activeTabId = tab.id; emit('update:active-tab', tab) }"
          >
            <span class="truncate max-w-48 sm:max-w-64">
              {{ getTabLabel(tab) }}
            </span>
          </UButton>
        </div>
      </VueDraggable>

      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-heroicons-plus"
        :title="t('contentLibrary.tabs.create')"
        @click="isCreateModalOpen = true"
      />
    </div>

    <CreateTabModal
      v-model:open="isCreateModalOpen"
      :scope="props.scope"
      @create="handleCreateTab"
    />
  </div>
</template>
