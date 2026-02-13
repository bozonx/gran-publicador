<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { normalizeTags } from '~/utils/tags'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import ContentBlockEditor from '~/components/forms/content/ContentBlockEditor.vue'

interface ContentBlock {
  id?: string
  text?: string | null
  order: number
  meta?: Record<string, unknown>
  media?: any[]
}

interface ContentItem {
  id: string
  title: string | null
  note: string | null
  tags: string[]
  blocks: ContentBlock[]
}

const props = defineProps<{
  item: ContentItem
  scope: 'project' | 'personal'
  projectId?: string
}>()

const emit = defineEmits<{
  (e: 'save', data: any): void
  (e: 'refresh'): void
  (e: 'create-publication', item: ContentItem): void
}>()

import { getApiErrorMessage } from '~/utils/error'

const { t } = useI18n()
const api = useApi()
const toast = useToast()

const editForm = ref({
  id: props.item.id,
  title: props.item.title || '',
  tags: normalizeTags(props.item.tags || []),
  note: props.item.note || '',
  blocks: JSON.parse(JSON.stringify(props.item.blocks || [])).sort((a: any, b: any) => a.order - b.order),
})

if (editForm.value.blocks.length === 0) {
  editForm.value.blocks.push({ text: '', order: 0, media: [] })
}

const { saveStatus, saveError, forceSave, isIndicatorVisible, indicatorStatus, retrySave } = useAutosave({
  data: toRef(() => editForm.value),
  saveFn: async (data: any) => {
    await saveItem(data)
    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const saveItem = async (formData: typeof editForm.value) => {
  // Atomic update of both item meta and its blocks
  await api.post(`/content-library/items/${formData.id}/sync`, {
    title: formData.title || null,
    tags: formData.tags,
    note: formData.note || null,
    blocks: formData.blocks.map((b, i) => ({
      id: b.id,
      text: b.text?.trim() || '',
      order: i,
      mediaIds: (b.media || []).map((m: any) => m.mediaId || m.id)
    }))
  })
}

const addBlock = () => {
  editForm.value.blocks.push({ text: '', order: editForm.value.blocks.length, media: [] })
}

const removeBlock = (index: number) => {
  editForm.value.blocks.splice(index, 1)
}

const handleReorder = () => {
  editForm.value.blocks.forEach((b, i) => { b.order = i })
}

const detachBlock = async (index: number) => {
  const block = editForm.value.blocks[index]
  if (!block || !block.id) return
  try {
    await api.post(`/content-library/items/${editForm.value.id}/blocks/${block.id}/detach`)
    editForm.value.blocks.splice(index, 1)
    toast.add({ title: t('common.success'), color: 'success' })
    emit('refresh')
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to detach block'),
      color: 'error'
    })
  }
}

const refreshActiveItem = async () => {
  try {
    const item = await api.get<ContentItem>(`/content-library/items/${editForm.value.id}`)
    editForm.value.blocks.forEach(localBlock => {
      if (!localBlock.id) return
      const freshBlock = item.blocks?.find(b => b.id === localBlock.id)
      if (freshBlock) localBlock.media = freshBlock.media
    })
    emit('refresh')
  } catch (e) {
    console.error('Failed to refresh item', e)
  }
}

defineExpose({
  forceSave
})
</script>

<template>
  <div class="space-y-6">
    <!-- Blocks Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <UIcon name="i-heroicons-paper-clip" class="w-4 h-4" />
          {{ t('contentLibrary.sections.blocks') }}
        </h3>
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          icon="i-heroicons-plus"
          @click="addBlock()"
        >
          {{ t('contentLibrary.actions.addBlock') }}
        </UButton>
      </div>

      <VueDraggable
        v-model="editForm.blocks"
        handle=".drag-handle"
        class="space-y-3"
        @end="handleReorder"
      >
        <div v-for="(block, index) in editForm.blocks" :key="block.id || index">
          <ContentBlockEditor
            :model-value="editForm.blocks[index]!"
            :index="index"
            :content-item-id="editForm.id"
            :show-detach="editForm.blocks.length > 1"
            @update:model-value="editForm.blocks[index] = $event"
            @remove="removeBlock(index)"
            @detach="detachBlock(index)"
            @refresh="refreshActiveItem"
          />
        </div>
      </VueDraggable>
    </div>

    <!-- Title Field -->
    <UFormField 
      :label="t('contentLibrary.fields.title', 'Title')"
      class="w-full"
    >
      <template #label>
        <span class="inline-flex items-center gap-2">
          <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('contentLibrary.fields.title', 'Title') }}</span>
          <span class="ml-auto">
             <UiSaveStatusIndicator 
              :status="indicatorStatus" 
              :visible="isIndicatorVisible"
              :error="saveError" 
              show-retry
              @retry="retrySave"
            />
          </span>
        </span>
      </template>
      <UInput 
        v-model="editForm.title"
        :placeholder="t('contentLibrary.fields.titlePlaceholder')"
        class="w-full"
      />
    </UFormField>

    <!-- Tags Field -->
    <UFormField :label="t('contentLibrary.fields.tags')" class="w-full">
      <CommonInputTags
        v-model="editForm.tags"
        :placeholder="t('contentLibrary.fields.tagsPlaceholder')"
        :project-id="props.scope === 'project' ? props.projectId : undefined"
        :user-id="props.scope === 'personal' ? user?.id : undefined"
        class="w-full"
      />
    </UFormField>

    <!-- Note Field -->
    <UFormField :label="t('contentLibrary.fields.note')" class="w-full">
      <UTextarea 
        v-model="editForm.note"
        :placeholder="t('contentLibrary.fields.notePlaceholder')"
        :rows="3"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
