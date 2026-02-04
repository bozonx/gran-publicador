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
  'update:activeTab': [tab: ContentLibraryTab | null]
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

const getStorageKey = () => {
  return `content-library-tab-${props.scope}-${props.projectId || 'global'}`
}

const fetchTabs = async () => {
  if (props.scope === 'project' && !props.projectId) return

  isLoading.value = true
  try {
    tabs.value = await listTabs(props.scope, props.scope === 'project' ? props.projectId : undefined)
    
    // Restore from localStorage
    const savedTabId = localStorage.getItem(getStorageKey())
    const tabToRestore = savedTabId ? tabs.value.find(t => t.id === savedTabId) : null

    if (tabToRestore) {
      activeTabId.value = tabToRestore.id
      emit('update:activeTab', tabToRestore)
    } else {
      // Auto-select first tab if none selected or restored
      if (!activeTabId.value && tabs.value.length > 0 && tabs.value[0]) {
        activeTabId.value = tabs.value[0].id
        emit('update:activeTab', tabs.value[0])
      }
    }
  } catch (e: any) {
    console.error('Failed to fetch tabs', e)
  } finally {
    isLoading.value = false
  }
}

const handleCreateTab = async (data: { type: 'FOLDER' | 'SAVED_VIEW'; title: string }) => {
  try {
    const newTab = await createTab({
      scope: props.scope,
      projectId: props.projectId,
      type: data.type,
      title: data.title,
      config: {},
    })
    
    await fetchTabs()
    activeTabId.value = newTab.id
    emit('update:activeTab', newTab)
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.tabs.createSuccess'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.data?.message || t('contentLibrary.tabs.createError'),
      color: 'error',
    })
  }
}

const handleDeleteTab = async (tabId: string) => {
  try {
    await deleteTab(tabId, props.scope, props.projectId)
    
    if (activeTabId.value === tabId) {
      activeTabId.value = null
      emit('update:activeTab', null)
    }
    
    await fetchTabs()
    
    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.tabs.deleteSuccess'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.data?.message || t('contentLibrary.tabs.deleteError'),
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
      description: e?.data?.message || t('contentLibrary.tabs.reorderError'),
      color: 'error',
    })
    await fetchTabs()
  } finally {
    isReordering.value = false
  }
}

const getTabIcon = (type: 'FOLDER' | 'SAVED_VIEW') => {
  return type === 'FOLDER' ? 'i-heroicons-folder' : 'i-heroicons-bookmark'
}

const getTabColor = (type: 'FOLDER' | 'SAVED_VIEW', isActive: boolean) => {
  if (isActive) return 'primary'
  return type === 'FOLDER' ? 'neutral' : 'neutral'
}

watch(() => props.projectId, () => {
  if (props.scope === 'project') {
    fetchTabs()
  }
})

watch(activeTabId, (newId) => {
  if (newId) {
    localStorage.setItem(getStorageKey(), newId)
  }
})

watch(() => props.scope, () => {
  activeTabId.value = null
  emit('update:activeTab', null)
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
        v-model="tabs"
        :animation="200"
        handle=".drag-handle"
        class="flex flex-wrap items-center gap-2 flex-1 min-w-0"
        @end="handleReorder"
      >
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-1 min-w-0"
        >
          <UButton
            :color="getTabColor(tab.type, activeTabId === tab.id)"
            :variant="activeTabId === tab.id ? 'solid' : 'outline'"
            size="sm"
            :icon="getTabIcon(tab.type)"
            @click="() => { activeTabId = tab.id; emit('update:activeTab', tab) }"
            class="drag-handle cursor-move max-w-full"
          >
            <span class="truncate max-w-[12rem] sm:max-w-[16rem]">
              {{ tab.title }}
            </span>
          </UButton>
        </div>
      </VueDraggable>

      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-heroicons-plus"
        @click="isCreateModalOpen = true"
        :title="t('contentLibrary.tabs.create')"
      />
    </div>

    <CreateTabModal
      v-model:open="isCreateModalOpen"
      @create="handleCreateTab"
    />
  </div>
</template>
