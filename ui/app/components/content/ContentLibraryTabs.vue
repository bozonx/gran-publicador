<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { ContentLibraryTab } from '~/composables/useContentLibraryTabs'

const props = defineProps<{
  scope: 'project' | 'personal'
  projectId?: string
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
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

const fetchTabs = async () => {
  if (props.scope === 'project' && !props.projectId) return

  isLoading.value = true
  try {
    tabs.value = await listTabs(props.scope, props.scope === 'project' ? props.projectId : undefined)
    
    // Auto-select first tab if none selected
    if (!activeTabId.value && tabs.value.length > 0 && tabs.value[0]) {
      activeTabId.value = tabs.value[0].id
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

watch(() => props.scope, () => {
  activeTabId.value = null
  fetchTabs()
})

onMounted(() => {
  fetchTabs()
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 overflow-x-auto pb-2">
      <VueDraggable
        v-model="tabs"
        :animation="200"
        handle=".drag-handle"
        class="flex items-center gap-2 flex-1"
        @end="handleReorder"
      >
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-1 shrink-0"
        >
          <UButton
            :color="getTabColor(tab.type, activeTabId === tab.id)"
            :variant="activeTabId === tab.id ? 'solid' : 'outline'"
            size="sm"
            :icon="getTabIcon(tab.type)"
            @click="activeTabId = tab.id"
            class="drag-handle cursor-move"
          >
            {{ tab.title }}
          </UButton>
          
          <UButton
            v-if="tabs.length > 1"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark"
            @click.stop="handleDeleteTab(tab.id)"
            class="w-6 h-6 p-0"
          />
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
