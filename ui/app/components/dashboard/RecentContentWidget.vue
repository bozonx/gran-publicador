<script setup lang="ts">
import ContentItemCard from '~/components/content/ContentItemCard.vue'
import ContentItemEditor from '~/components/content/ContentItemEditor.vue'
import AppModal from '~/components/ui/AppModal.vue'
import { sanitizeContentPreserveMarkdown } from '~/utils/text'
import { getApiErrorMessage } from '~/utils/error'

const { t } = useI18n()
const api = useApi()
const router = useRouter()
const toast = useToast()

const items = ref<any[]>([])
const isLoading = ref(false)

const isEditModalOpen = ref(false)
const activeItem = ref<any | null>(null)
const editorRef = ref<InstanceType<typeof ContentItemEditor> | null>(null)

const isCreatePublicationModalOpen = ref(false)
const createPublicationModalProjectId = ref<string | undefined>(undefined)
const createPublicationModalAllowProjectSelection = ref(false)
const publicationData = ref({
  title: '',
  content: '',
  mediaIds: [] as Array<{ id: string }>,
  tags: [] as string[],
  note: '',
  contentItemIds: [] as string[]
})

async function fetchRecentContent() {
  isLoading.value = true
  try {
    const res = await api.get<any>('/content-library/items', {
      params: {
        scope: 'personal',
        limit: 10,
        offset: 0,
      },
    })
    items.value = res.items
  } catch (error) {
    console.error('Failed to fetch recent content:', error)
  } finally {
    isLoading.value = false
  }
}

function openEditModal(item: any) {
  activeItem.value = item
  isEditModalOpen.value = true
}

async function handleCloseEditModal() {
  if (editorRef.value) {
    await editorRef.value.forceSave()
  }
  isEditModalOpen.value = false
  activeItem.value = null
  await fetchRecentContent()
}

const isArchivingId = ref<string | null>(null)
async function handleArchive(item: any) {
  isArchivingId.value = item.id
  try {
    await api.post(`/content-library/items/${item.id}/archive`)
    await fetchRecentContent()
    toast.add({ 
      title: t('common.success'), 
      description: t('contentLibrary.actions.moveToTrashSuccess'), 
      color: 'success' 
    })
  } catch (e: any) {
    toast.add({ 
      title: t('common.error'), 
      description: getApiErrorMessage(e, 'Failed to archive'), 
      color: 'error' 
    })
  } finally {
    isArchivingId.value = null
  }
}

function handleCreatePublication(item: any) {
  const texts = (item.blocks || [])
    .map((b: any) => sanitizeContentPreserveMarkdown(b.text || '').trim())
    .filter(Boolean)
  
  createPublicationModalProjectId.value = undefined
  createPublicationModalAllowProjectSelection.value = true
  
  publicationData.value = {
    title: (item.title || '').toString().trim(),
    content: texts.join('\n\n'),
    mediaIds: (item.blocks || [])
      .flatMap((b: any) => (b.media || [])
      .map((m: any) => ({ id: m.mediaId })))
      .filter((m: any) => !!m.id),
    tags: item.tags || [],
    note: item.note || '',
    contentItemIds: [item.id]
  }
  isCreatePublicationModalOpen.value = true
}

onMounted(() => {
  fetchRecentContent()
})
</script>

<template>
  <div v-if="items.length > 0 || isLoading" class="space-y-4">
    <div class="flex items-center justify-between px-1">
      <h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
        <UIcon name="i-heroicons-square-3-stack-3d" class="w-4 h-4" />
        {{ t('dashboard.recent_content', 'Recent content') }}
      </h3>
      <UButton
        to="/content-library"
        variant="ghost"
        size="xs"
        color="primary"
        icon="i-heroicons-arrow-right"
        trailing
      >
        {{ t('common.viewAll') }}
      </UButton>
    </div>

    <div class="relative overflow-hidden">
      <!-- Horizontal scroll container -->
      <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
        <div 
          v-for="i in 5" 
          v-if="isLoading && items.length === 0" 
          :key="i"
          class="min-w-[280px] w-[280px] h-[320px] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"
        ></div>
        
        <div 
          v-for="item in items" 
          :key="item.id"
          class="min-w-[280px] w-[280px] shrink-0 h-full"
        >
          <ContentItemCard
            :item="item"
            hide-checkbox
            :is-archiving="isArchivingId === item.id"
            class="h-full! shadow-sm"
            @click="openEditModal(item)"
            @archive="handleArchive"
            @create-publication="handleCreatePublication"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <AppModal
      v-model:open="isEditModalOpen"
      :title="t('contentLibrary.editTitle', 'Edit content item')"
      :ui="{ content: 'w-[90vw] max-w-5xl' }"
      @close="handleCloseEditModal"
    >
      <ContentItemEditor
        v-if="activeItem"
        ref="editorRef"
        :item="activeItem"
        scope="personal"
        @refresh="fetchRecentContent"
      />
      
      <template #footer>
        <div class="flex justify-between items-center w-full">
           <div class="text-xs text-gray-500 flex gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-paper-airplane"
                @click="handleCreatePublication(activeItem)"
              >
                {{ t('contentLibrary.actions.createPublication') }}
              </UButton>
           </div>
           <UButton 
            color="primary" 
            @click="handleCloseEditModal"
          >
            {{ t('common.done', 'Done') }}
          </UButton>
        </div>
      </template>
    </AppModal>

    <ModalsCreatePublicationModal
      v-if="isCreatePublicationModalOpen"
      v-model:open="isCreatePublicationModalOpen"
      :project-id="createPublicationModalProjectId"
      :allow-project-selection="createPublicationModalAllowProjectSelection"
      :prefilled-title="publicationData.title"
      :prefilled-content="publicationData.content"
      :prefilled-media-ids="publicationData.mediaIds"
      :prefilled-tags="publicationData.tags"
      :prefilled-note="publicationData.note"
      :prefilled-content-item-ids="publicationData.contentItemIds"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
