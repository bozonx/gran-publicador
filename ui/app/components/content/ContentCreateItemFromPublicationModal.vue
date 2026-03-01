<script setup lang="ts">
import CommonContentDestinationSelect from '../common/CommonContentDestinationSelect.vue'
import { getApiErrorMessage } from '~/utils/error'

interface Props {
  scope: 'project' | 'personal'
  projectId?: string
  publicationId: string | null
}

const props = defineProps<Props>()

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
const selectedScope = ref<'project' | 'personal'>(props.scope)
const targetProjectId = ref<string | null>(props.projectId || null)
const targetCollectionId = ref<string | null>(null)
const targetGroupId = ref<string | null>(null)

// Logic handled by CommonContentDestinationSelect

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

// Collections fetching is handled by the component
async function init() {
  if (!isOpen.value) return

  error.value = null
  isLoading.value = true
  try {
    await fetchPublication()
  } catch (e: any) {
    error.value = getApiErrorMessage(e, 'Failed to load data')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, () => {
  if (isOpen.value) {
    selectedScope.value = props.scope
    targetProjectId.value = props.projectId || null
    init()
  }
})

watch(isOpen, (next) => {
  if (!next) {
    isLoading.value = false
    isCreating.value = false
    error.value = null
    publication.value = null
    targetCollectionId.value = null
    targetGroupId.value = null
  }
})

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
      language: p?.language || undefined,
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

    isOpen.value = false

    const base = selectedScope.value === 'project' 
      ? `/projects/${targetProjectId.value}/content-library` 
      : '/content-library'

    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.actions.copyToItemSuccess'),
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

async function handleSelectGroup(groupId: string | null) {
  if (!groupId) return
  await executeAction(groupId)
}

async function handleActionToSavedView(collectionId: string) {
  targetCollectionId.value = collectionId
  await executeAction(undefined)
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('contentLibrary.actions.copyToContentItem')"
    :ui="{ content: 'max-w-md' }"
  >
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('contentLibrary.actions.copyPublicationToItemDescription', 'Select a target project and collection to create a new content item.') }}
      </p>

      <div v-if="error" class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-else class="space-y-3">
        <CommonContentDestinationSelect
          v-model:scope="selectedScope"
          v-model:project-id="targetProjectId"
          v-model:collection-id="targetCollectionId"
          v-model:group-id="targetGroupId"
          :is-loading="isLoading"
          allow-saved-views
          @select-saved-view="handleActionToSavedView"
        />

        <div v-if="targetGroupId" class="pt-4 flex justify-end">
           <UButton
            color="primary"
            :loading="isCreating"
            @click="handleSelectGroup(targetGroupId)"
          >
            {{ t('common.copy') }}
          </UButton>
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
