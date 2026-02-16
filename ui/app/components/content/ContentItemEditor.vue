<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { normalizeTags } from '~/utils/tags'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'
import { getApiErrorMessage } from '~/utils/error'

interface ContentItemMediaLink {
  id?: string
  mediaId?: string
  order?: number
  hasSpoiler?: boolean
  media?: any
}

interface ContentItem {
  id: string
  title: string | null
  note: string | null
  tags: string[]
  text?: string | null
  meta?: Record<string, unknown>
  media?: ContentItemMediaLink[]
}

const props = defineProps<{
  item: ContentItem
  scope: 'project' | 'personal'
  projectId?: string
  groupId?: string
}>()

const emit = defineEmits<{
  (e: 'save', data: any): void
  (e: 'refresh'): void
  (e: 'create-publication', item: ContentItem): void
}>()

const { t } = useI18n()
const { user } = useAuth()
const api = useApi()
const toast = useToast()

const editForm = ref({
  id: props.item.id,
  title: props.item.title || '',
  tags: normalizeTags(props.item.tags || []),
  note: props.item.note || '',
  text: props.item.text || '',
  meta: JSON.parse(JSON.stringify(props.item.meta || {})),
  media: JSON.parse(JSON.stringify(props.item.media || [])).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
})

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
  // Atomic update of item meta and content
  await api.post(`/content-library/items/${formData.id}/sync`, {
    title: formData.title || null,
    tags: formData.tags,
    note: formData.note || null,
    text: formData.text?.trim() || '',
    meta: formData.meta || {},
    media: (formData.media || []).map((m: any) => ({
      mediaId: m.mediaId || m.media?.id,
      hasSpoiler: m.hasSpoiler ? true : undefined,
    })),
  })
}

async function onAddMedia(media: any[]) {
  const current = editForm.value.media || []
  const next = current.slice()
  for (const item of media) {
    const mediaId = item?.id
    if (!mediaId) continue
    if (next.some((x: any) => (x.mediaId || x.id) === mediaId)) continue
    next.push({ mediaId, hasSpoiler: item.hasSpoiler ? true : undefined, order: next.length })
  }
  editForm.value.media = next
}

async function onReorderMedia(reorderData: any[]) {
  const current = editForm.value.media || []
  const byId = new Map<string, any>()
  for (const item of current) {
    if (item?.id) {
      byId.set(item.id, item)
    }
  }

  const next: any[] = []
  for (let i = 0; i < (reorderData || []).length; i += 1) {
    const id = reorderData[i]?.id
    const existing = id ? byId.get(id) : undefined
    if (existing) {
      next.push({ ...existing, order: i })
      byId.delete(id)
    }
  }

  // Preserve items that were not present in reorderData (defensive).
  for (const item of byId.values()) {
    next.push({ ...item, order: next.length })
  }

  editForm.value.media = next
}

async function onUpdateLinkMedia(_mediaLinkId: string, data: any) {
  const linkId = _mediaLinkId
  if (!linkId) return
  editForm.value.media = (editForm.value.media || []).map((m: any) =>
    m.id === linkId ? { ...m, ...data } : m,
  )
}

async function onCopyMedia(_mediaLinkId: string) {
  const linkId = _mediaLinkId
  if (!linkId) {
    return
  }

  const link = (editForm.value.media || []).find((m: any) => m.id === linkId)
  const mediaId = link?.mediaId || link?.media?.id || null
  if (!mediaId) {
    toast.add({
      title: t('common.error'),
      description: t('common.saveError'),
      color: 'error'
    })
    return
  }

  try {
    await api.post('/content-library/items', {
      scope: props.scope,
      projectId: props.scope === 'project' ? props.projectId : undefined,
      groupId: props.groupId,
      title: '',
      text: '',
      meta: {},
      media: [{ mediaId, order: 0, hasSpoiler: link?.hasSpoiler ? true : false }],
    })

    toast.add({
      title: t('common.success'),
      description: t('contentLibrary.actions.copyToItemSuccess'),
      color: 'success'
    })
    emit('refresh')
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: getApiErrorMessage(e, 'Failed to copy media'),
      color: 'error'
    })
  }
}

defineExpose({
  forceSave
})
</script>

<template>
  <div class="space-y-6">
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

    <UFormField :label="t('contentLibrary.fields.text')" class="w-full">
      <EditorTiptapEditor
        :model-value="editForm.text"
        :placeholder="t('contentLibrary.fields.textPlaceholder')"
        :min-height="150"
        @update:model-value="(v: any) => (editForm.text = v)"
      />
    </UFormField>

    <!-- Tags Field -->
    <UFormField :label="t('contentLibrary.fields.tags')" class="w-full">
      <CommonInputTags
        v-model="editForm.tags"
        :placeholder="t('contentLibrary.fields.tagsPlaceholder')"
        :scope="props.scope"
        :project-id="props.scope === 'project' ? props.projectId : undefined"
        :search-endpoint="'/content-library/tags/search'"
        :group-id="props.groupId"
        :user-id="props.scope === 'personal' ? user?.id : undefined"
        class="w-full"
      />
    </UFormField>

    <div class="pt-2">
      <MediaGallery
        :media="editForm.media || []"
        :editable="true"
        :on-add="onAddMedia"
        :on-reorder="onReorderMedia"
        :on-update-link="onUpdateLinkMedia"
        :on-copy="onCopyMedia"
      />
    </div>

    <!-- Note Field -->
    <UFormField :label="t('contentLibrary.fields.note')" class="w-full">
      <UTextarea 
        v-model="editForm.note"
        :placeholder="t('contentLibrary.fields.notePlaceholder')"
        :rows="3"
        class="w-full"
      />
    </UFormField>

    <div class="mt-2">
      <CommonMetadataEditor
        :model-value="editForm.meta || {}"
        :label="t('common.meta')"
        @update:model-value="(newMeta: any) => (editForm.meta = newMeta)"
      />
    </div>
  </div>
</template>
