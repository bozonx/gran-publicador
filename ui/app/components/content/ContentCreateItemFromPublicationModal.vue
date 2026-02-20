<script setup lang="ts">
import type { ContentCollection } from '~/composables/useContentCollections'
import { useContentCollections } from '~/composables/useContentCollections'
import { buildGroupTreeFromRoot, type ContentLibraryTreeItem } from '~/composables/useContentLibraryGroupsTree'
import ContentGroupSelectTree from './ContentGroupSelectTree.vue'
import { getApiErrorMessage } from '~/utils/error'

interface Props {
  scope: 'project' | 'personal'
  projectId?: string
  publicationId: string | null
  mode?: 'copy' | 'move'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'copy',
})

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const router = useRouter()
const { fetchProjects } = useProjects()

const { listCollections } = useContentCollections()

const isLoading = ref(false)
const isCreating = ref(false)
const error = ref<string | null>(null)

const publication = ref<any | null>(null)
const projects = ref<any[]>([])
const collections = ref<ContentCollection[]>([])

const selectedScope = ref<'project' | 'personal'>(props.scope)
const targetProjectId = ref<string | undefined>(props.projectId)
const targetCollectionId = ref<string | null>(null)

const projectOptions = computed(() => {
  const options = [{ label: t('contentLibrary.moveModal.personal'), value: 'personal' }]
  projects.value.forEach((p) => {
    options.push({ label: p.name, value: p.id })
  })
  return options
})

const selectedProjectOption = computed({
  get: () => {
    if (selectedScope.value === 'personal') return 'personal'
    return targetProjectId.value
  },
  set: (val: string | undefined) => {
    if (val === 'personal') {
      selectedScope.value = 'personal'
      targetProjectId.value = undefined
    } else {
      selectedScope.value = 'project'
      targetProjectId.value = val
    }
  },
})

const collectionOptions = computed(() => {
  return collections.value
    .filter(c => (c.type === 'GROUP' || c.type === 'SAVED_VIEW') && !c.parentId)
    .map(c => ({ label: c.title, value: c.id }))
})

const selectedCollection = computed(() => {
  if (!targetCollectionId.value) return null
  return collections.value.find(c => c.id === targetCollectionId.value) ?? null
})

const targetCollectionTreeItems = computed<ContentLibraryTreeItem[]>(() => {
  if (!selectedCollection.value) return []
  if (selectedCollection.value.type !== 'GROUP') return []

  return buildGroupTreeFromRoot({
    rootId: selectedCollection.value.id,
    allGroupCollections: collections.value,
    labelFn: c => c.title,
  })
})

function buildPublicationText(input: { content?: unknown; authorComment?: unknown }): string {
  const content = typeof input.content === 'string' ? input.content.trim() : ''
  const comment = typeof input.authorComment === 'string' ? input.authorComment.trim() : ''

  if (content && comment) {
    return `${content}\n\n---\n\n${comment}`
  }

  return content || comment || ''
}

async function fetchPublication() {
  if (!props.publicationId) {
    publication.value = null
    return
  }

  publication.value = await api.get<any>(`/publications/${props.publicationId}`)
}

async function fetchCollections() {
  collections.value = await listCollections(selectedScope.value, targetProjectId.value)
}

async function init() {
  if (!isOpen.value) return

  error.value = null
  isLoading.value = true
  try {
    const promises: Promise<any>[] = [fetchPublication(), fetchCollections()]
    // Fetch projects to allow selection
    promises.push(fetchProjects().then(res => projects.value = res))
    
    await Promise.all(promises)
  } catch (e: any) {
    error.value = getApiErrorMessage(e, 'Failed to load data')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, () => {
  if (isOpen.value) {
    selectedScope.value = props.scope
    targetProjectId.value = props.projectId
    init()
  }
})

watch([selectedScope, targetProjectId], () => {
  if (isOpen.value) {
    targetCollectionId.value = null
    fetchCollections()
  }
})

watch(isOpen, (next) => {
  if (!next) {
    isLoading.value = false
    isCreating.value = false
    error.value = null
    publication.value = null
    collections.value = []
    targetCollectionId.value = null
  }
})

function handleSelectCollection(next: unknown) {
  const targetId = (next && typeof next === 'object' && 'value' in next) ? (next as any).value : next
  targetCollectionId.value = (targetId ?? null) as any
}

async function executeAction(groupId?: string) {
  if (!props.publicationId) return
  if (isCreating.value) return

  isCreating.value = true
  try {
    const p = publication.value

    const created = await api.post<any>('/content-library/items', {
      scope: selectedScope.value,
      projectId: selectedScope.value === 'project' ? targetProjectId.value : undefined,
      groupId,
      title: typeof p?.title === 'string' ? p.title : '',
      tags: Array.isArray(p?.tags) ? p.tags : [],
      text: buildPublicationText({ content: p?.content, authorComment: p?.authorComment }),
      meta: {},
      media: Array.isArray(p?.media)
        ? p.media
            .slice()
            .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
            .map((m: any, idx: number) => ({
              mediaId: m?.mediaId ?? m?.media?.id,
              order: typeof m?.order === 'number' ? m.order : idx,
              hasSpoiler: !!m?.hasSpoiler,
            }))
            .filter((m: any) => typeof m.mediaId === 'string' && m.mediaId.length > 0)
        : [],
      publicationId: props.publicationId,
    })

    if (props.mode === 'move') {
      await api.delete(`/publications/${props.publicationId}`)
    }

    isOpen.value = false

    const base = selectedScope.value === 'project' 
      ? `/projects/${targetProjectId.value}/content-library` 
      : '/content-library'

    toast.add({
      title: t('common.success'),
      description: props.mode === 'move' 
        ? t('archive.success_moved') 
        : t('contentLibrary.actions.copyToItemSuccess'),
      color: 'success',
      actions: [
        {
          label: t('common.view', 'View'),
          onClick: () => {
            router.push({ 
              path: base, 
              query: { 
                collectionId: targetCollectionId.value,
                groupId: groupId
              } 
            })
          },
        },
      ],
    } as any)
    
    // If we moved, we must redirect because the current page is deleted
    if (props.mode === 'move') {
      router.push({ 
        path: base, 
        query: { 
          collectionId: targetCollectionId.value,
          groupId: groupId
        } 
      })
    }
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to process publication'),
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

async function handleSelectGroup(groupId: string) {
  if (!groupId) return
  await executeAction(groupId)
}

async function handleActionToSavedView() {
  await executeAction(undefined)
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="props.mode === 'move' ? t('publication.moveToContentLibrary') : t('contentLibrary.actions.copyToContentItem')"
    :ui="{ content: 'max-w-md' }"
  >
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ props.mode === 'move' 
          ? t('contentLibrary.moveModal.toProject') 
          : t('contentLibrary.actions.copyPublicationToItemDescription', 'Select a target project and collection to create a new content item.') 
        }}
      </p>

      <div v-if="error" class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-else class="space-y-3">
        <USelectMenu
          v-model="selectedProjectOption"
          :items="projectOptions"
          value-key="value"
          label-key="label"
          searchable
          :loading="isLoading"
          :placeholder="t('contentLibrary.moveModal.toProject')"
        >
          <template #leading>
            <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <USelectMenu
          :items="collectionOptions"
          value-key="value"
          label-key="label"
          searchable
          :loading="isLoading || isLoading"
          :search-input="{ placeholder: t('contentLibrary.bulk.searchGroups') }"
          :placeholder="t('contentLibrary.bulk.searchGroups')"
          @update:model-value="handleSelectCollection"
        >
          <template #leading>
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
          </template>
        </USelectMenu>

        <div v-if="selectedCollection" class="py-2">
          <div v-if="selectedCollection.type === 'GROUP'" class="max-h-60 overflow-y-auto custom-scrollbar">
            <ContentGroupSelectTree
              v-if="targetCollectionTreeItems.length > 0"
              :items="targetCollectionTreeItems as any"
              @select="handleSelectGroup"
            />
          </div>

          <div v-else-if="selectedCollection.type === 'SAVED_VIEW'" class="p-4 flex justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <UButton
              color="primary"
              :icon="props.mode === 'move' ? 'i-heroicons-arrow-right-circle' : 'i-heroicons-document-duplicate'"
              :loading="isCreating"
              @click="handleActionToSavedView"
            >
              {{ props.mode === 'move' ? t('common.move') : t('common.copy') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
