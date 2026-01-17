<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import type { AuthorSignature, CreateAuthorSignatureInput, UpdateAuthorSignatureInput } from '~/types/author-signatures'
import { PRESET_SIGNATURES } from '~/constants/preset-signatures'

const props = defineProps<{
  channelId: string
}>()

const { t } = useI18n()
const {
  fetchByChannel,
  create,
  update,
  remove,
  setDefault,
  isLoading
} = useAuthorSignatures()

const signatures = ref<AuthorSignature[]>([])
const isModalOpen = ref(false)
const isPresetModalOpen = ref(false)
const isDeleting = ref(false)
const editingSignature = ref<AuthorSignature | null>(null)
const isDragging = ref(false)

const form = reactive({
  name: '',
  content: '',
  isDefault: false
})

async function loadSignatures() {
  signatures.value = await fetchByChannel(props.channelId)
}

onMounted(loadSignatures)

function openAdd() {
  editingSignature.value = null
  form.name = ''
  form.content = ''
  form.isDefault = signatures.value.length === 0
  isModalOpen.value = true
}

function openPresetModal() {
  isPresetModalOpen.value = true
}

function handlePresetSelect(preset: typeof PRESET_SIGNATURES[0]) {
  editingSignature.value = null
  form.name = t(preset.nameKey)
  form.content = t(preset.contentKey)
  form.isDefault = signatures.value.length === 0
  isPresetModalOpen.value = false
  isModalOpen.value = true
}

function openEdit(signature: AuthorSignature) {
  editingSignature.value = signature
  form.name = signature.name
  form.content = signature.content
  form.isDefault = signature.isDefault
  isModalOpen.value = true
}

async function handleSave() {
  if (!form.name || !form.content) return

  try {
    if (editingSignature.value) {
      const input: UpdateAuthorSignatureInput = {
        name: form.name,
        content: form.content,
        isDefault: form.isDefault
      }
      await update(editingSignature.value.id, input)
    } else {
      const input: CreateAuthorSignatureInput = {
        channelId: props.channelId,
        name: form.name,
        content: form.content,
        isDefault: form.isDefault
      }
      await create(input)
    }
    isModalOpen.value = false
    await loadSignatures()
  } catch (error) {
    console.error('Failed to save signature', error)
  }
}

async function handleDelete(id: string) {
  if (!confirm(t('authorSignature.delete_confirmation'))) return
  
  isDeleting.value = true
  try {
    await remove(id)
    await loadSignatures()
  } finally {
    isDeleting.value = false
  }
}

async function handleSetDefault(id: string) {
  await setDefault(id)
  await loadSignatures()
}

// Drag and drop handlers
function handleDragStart(event: DragEvent, index: number) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())
  isDragging.value = true
}

function handleDragEnd() {
  isDragging.value = false
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

async function handleDrop(event: DragEvent, targetIndex: number) {
  event.preventDefault()
  if (!event.dataTransfer) return
  
  const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'))
  if (sourceIndex === targetIndex) return
  
  // Reorder locally
  const items = [...signatures.value]
  const [movedItem] = items.splice(sourceIndex, 1)
  items.splice(targetIndex, 0, movedItem)
  
  // Update order field for all items
  const updates = items.map((item, index) => ({
    id: item.id,
    order: index
  }))
  
  // Optimistically update UI
  signatures.value = items
  
  // Update on server
  try {
    for (const { id, order } of updates) {
      await update(id, { order })
    }
  } catch (error) {
    console.error('Failed to update order', error)
    // Reload on error
    await loadSignatures()
  }
  
  isDragging.value = false
}

</script>

<template>
  <div class="space-y-4">
    <Teleport defer v-if="channelId" to="#channel-signatures-actions">
      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-sparkles"
          size="xs"
          color="primary"
          variant="outline"
          @click="openPresetModal"
        >
          {{ t('authorSignature.createFromPreset', 'From Preset') }}
        </UButton>
        <UButton
          icon="i-heroicons-plus"
          size="xs"
          color="primary"
          variant="soft"
          @click="openAdd"
        >
          {{ t('common.add') }}
        </UButton>
      </div>
    </Teleport>

    <div v-if="isLoading && signatures.length === 0" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="signatures.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-pencil-square" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ t('authorSignature.none') }}
      </p>
      <UButton
        icon="i-heroicons-sparkles"
        size="sm"
        color="primary"
        variant="outline"
        @click="openPresetModal"
      >
        {{ t('authorSignature.createFromPreset', 'Create from Preset') }}
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="(sig, index) in signatures"
        :key="sig.id"
        draggable="true"
        @dragstart="handleDragStart($event, index)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
        @drop="handleDrop($event, index)"
        class="flex flex-col p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-all group relative h-full cursor-move"
        :class="{ 'opacity-50': isDragging }"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-bars-3" class="w-4 h-4 text-gray-400 shrink-0" />
              <span class="font-semibold text-gray-900 dark:text-white truncate" :title="sig.name">{{ sig.name }}</span>
              <UBadge v-if="sig.isDefault" size="xs" color="primary" variant="subtle">
                {{ t('authorSignature.is_default') }}
              </UBadge>
            </div>
          </div>
          
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <UTooltip v-if="!sig.isDefault" :text="t('authorSignature.is_default')">
              <UButton
                icon="i-heroicons-star"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="handleSetDefault(sig.id)"
              />
            </UTooltip>
            <UTooltip :text="t('common.edit')">
              <UButton
                icon="i-heroicons-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="openEdit(sig)"
              />
            </UTooltip>
            <UTooltip :text="t('common.delete')">
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="error"
                @click="handleDelete(sig.id)"
              />
            </UTooltip>
          </div>
        </div>
        
        <div class="mt-auto">
          <div class="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 font-mono italic">
            {{ sig.content }}
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingSignature ? t('common.edit') : t('common.add')"
    >
      <div class="space-y-4">
        <UFormField :label="t('common.name')" required>
          <UInput
            v-model="form.name"
            placeholder="e.g. My Website Link"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('post.contentLabel')" required>
          <UTextarea
            v-model="form.content"
            placeholder="[Click here](https://example.com)"
            :rows="4"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="form.isDefault"
          :label="t('authorSignature.is_default')"
        />
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="isLoading" @click="handleSave">
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>

    <!-- Preset Selection Modal -->
    <UiAppModal
      v-model:open="isPresetModalOpen"
      :title="t('authorSignature.presets.title', 'Preset Signatures')"
    >
      <div class="grid grid-cols-1 gap-3">
        <button
          v-for="preset in PRESET_SIGNATURES"
          :key="preset.id"
          @click="handlePresetSelect(preset)"
          class="flex flex-col p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-all text-left group"
        >
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary-500" />
            <span class="font-semibold text-gray-900 dark:text-white">{{ t(preset.nameKey) }}</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 font-mono italic">
            {{ t(preset.contentKey) }}
          </p>
        </button>
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isPresetModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
