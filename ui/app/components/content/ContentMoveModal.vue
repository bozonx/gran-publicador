<script setup lang="ts">
import { type ContentCollection, useContentCollections } from '~/composables/useContentCollections'
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree'
import CommonInfoTooltip from '~/components/common/CommonInfoTooltip.vue'
import ContentGroupSelectTree from './ContentGroupSelectTree.vue'

interface Props {
  ids: string[]
  scope: 'personal' | 'project'
  projectId?: string
  activeCollection?: ContentCollection | null
  currentGroupId?: string | null
  collections: ContentCollection[]
  projects: any[]
  folderTreeItems: any[]
}

const handleSelectTargetProject = (projectId: string | null) => {
  if (projectActionMode.value === 'COPY') {
    emit('move', {
      operation: 'COPY_TO_PROJECT',
      projectId,
    })
    isOpen.value = false
    return
  }

  emit('move', {
    operation: 'SET_PROJECT',
    projectId,
  })
  isOpen.value = false
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'move', payload: {
    operation: 'MOVE_TO_GROUP' | 'LINK_TO_GROUP' | 'SET_PROJECT' | 'COPY_TO_PROJECT'
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

const projectsWithCollections = ref<any[]>([])
const isLoadingProjectsWithCollections = ref(false)

const moveMode = ref<'MOVE' | 'LINK'>('MOVE')
const otherCollectionMoveMode = ref<'MOVE' | 'LINK'>('MOVE')
const projectActionMode = ref<'MOVE' | 'COPY'>('MOVE')

const targetCollectionId = ref<string | null>(null)

const currentProjectId = computed(() => {
  return props.scope === 'project' ? (props.projectId ?? null) : null
})

const disabledGroupIds = computed<string[]>(() => {
  if (props.activeCollection?.type !== 'GROUP') return []
  const id = props.currentGroupId ?? props.activeCollection.id
  return id ? [id] : []
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
  return projectsWithCollections.value
    .filter(p => !props.projectId || p.id !== props.projectId)
    .map(p => ({
      label: p.name,
      value: p.id
    }))
})

const PERSONAL_PROJECT_VALUE = '__PERSONAL__'

const projectOptionsWithPersonal = computed(() => {
  const options = [...projectOptions.value]

  if (props.scope !== 'project') return options

  if (currentProjectId.value === null) return options

  options.unshift({
    label: t('contentLibrary.moveModal.toPersonal'),
    value: PERSONAL_PROJECT_VALUE,
  })

  return options
})

const isPersonalTargetSelected = computed(() => {
  return targetProjectId.value === PERSONAL_PROJECT_VALUE
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

async function fetchProjectsWithCollections() {
  if (props.scope !== 'project') {
    projectsWithCollections.value = []
    return
  }

  isLoadingProjectsWithCollections.value = true
  try {
    const candidates = (props.projects ?? []).filter(p => p)

    const results = await Promise.allSettled(
      candidates.map(async (p) => {
        const cols = await listCollections('project', p.id)
        return { project: p, hasCollections: Array.isArray(cols) && cols.length > 0 }
      }),
    )

    projectsWithCollections.value = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ project: any; hasCollections: boolean }>).value)
      .filter(v => v.hasCollections)
      .map(v => v.project)
  } catch (e) {
    console.error('Failed to fetch projects collections', e)
    projectsWithCollections.value = []
  } finally {
    isLoadingProjectsWithCollections.value = false
  }
}

watch(targetProjectId, (next) => {
  if (!next || next === PERSONAL_PROJECT_VALUE) {
    targetProjectCollections.value = []
    targetGroupIdInProject.value = null
    return
  }

  fetchTargetProjectCollections(next)
  targetGroupIdInProject.value = null
})

const handleMoveToGroup = (groupId: string) => {
  if (!groupId) return
  if (props.activeCollection?.type !== 'GROUP') return

  if (disabledGroupIds.value.includes(groupId)) return

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
    sourceGroupId: props.currentGroupId ?? props.activeCollection.id,
  })
  isOpen.value = false
}

const handleMoveToOtherCollectionGroup = (groupId: string) => {
  if (!groupId) return

  if (otherCollectionMoveMode.value === 'LINK') {
    emit('move', {
      operation: 'LINK_TO_GROUP',
      groupId,
    })
    isOpen.value = false
    return
  }

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
  if (targetProjectId.value === PERSONAL_PROJECT_VALUE) return

  if (projectActionMode.value === 'COPY') {
    emit('move', {
      operation: 'COPY_TO_PROJECT',
      projectId: targetProjectId.value,
      groupId,
    })
  } else {
    emit('move', {
      operation: 'SET_PROJECT',
      projectId: targetProjectId.value,
      groupId,
    })
  }
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

  if (projectActionMode.value === 'COPY') {
    emit('move', {
      operation: 'COPY_TO_PROJECT',
      projectId: targetProjectId.value,
    })
    isOpen.value = false
    return
  }

  emit('move', {
    operation: 'SET_PROJECT',
    projectId: targetProjectId.value,
  })
  isOpen.value = false
}

function handleMoveToPersonal() {
  handleSelectTargetProject(null)
}

watch(isOpen, (next) => {
  if (next) {
    fetchProjectsWithCollections()
  }
})

// Reset state when closing
watch(isOpen, (next) => {
  if (!next) {
    targetProjectId.value = null
    targetGroupIdInProject.value = null
    targetProjectCollections.value = []
    targetCollectionId.value = null
    moveMode.value = 'MOVE'
    otherCollectionMoveMode.value = 'MOVE'
    projectActionMode.value = 'MOVE'
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
                :disabled-ids="disabledGroupIds"
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
              <div v-if="selectedCollection?.type === 'GROUP'" class="space-y-3">
                <UiAppButtonGroup
                  v-model="otherCollectionMoveMode"
                  :options="[
                    { value: 'MOVE', label: t('common.move', 'Move') },
                    { value: 'LINK', label: t('contentLibrary.bulk.linkMode', 'Link') },
                  ]"
                  active-variant="solid"
                  variant="outline"
                  fluid
                />

                <div class="max-h-60 overflow-y-auto custom-scrollbar">
                  <ContentGroupSelectTree
                    v-if="targetCollectionTreeItems.length > 0"
                    :items="targetCollectionTreeItems as any"
                    @select="handleMoveToOtherCollectionGroup"
                  />
                </div>
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
            <div class="flex items-center justify-between gap-3">
              <UiAppButtonGroup
                v-model="projectActionMode"
                :options="[
                  { value: 'MOVE', label: t('common.move', 'Move') },
                  { value: 'COPY', label: t('common.copy', 'Copy') },
                ]"
                active-variant="solid"
                variant="outline"
                fluid
              />
              <CommonInfoTooltip
                :text="t('contentLibrary.moveModal.copyHint')"
                placement="left"
              />
            </div>

            <USelectMenu
              v-model="targetProjectId"
              :items="projectOptionsWithPersonal"
              value-key="value"
              label-key="label"
              searchable
              :search-input="{ placeholder: t('contentLibrary.bulk.selectProject') }"
              :placeholder="t('contentLibrary.bulk.selectProject')"
              :loading="isLoadingProjectsWithCollections"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              </template>
            </USelectMenu>

            <div v-if="isPersonalTargetSelected" class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              <UButton
                color="primary"
                icon="i-heroicons-arrow-right-circle"
                @click="handleMoveToPersonal"
              >
                {{ projectActionMode === 'COPY' ? t('common.copy') : t('common.move') }}
              </UButton>
            </div>

            <div v-else-if="targetProjectId" class="space-y-2">
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
