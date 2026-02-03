<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
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
  if (!form.content) return

  // Automatically set name from content for backend compatibility
  form.name = form.content.split('\n')[0]?.slice(0, 50) || 'Signature'

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

async function handleDragEnd() {
  // Update order for all signatures
  try {
    for (let i = 0; i < signatures.value.length; i++) {
      await update(signatures.value[i].id, { order: i })
    }
  } catch (error) {
    console.error('Failed to update order', error)
    await loadSignatures()
  }
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

    <div v-else-if="signatures.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
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

    <VueDraggable
      v-else
      v-model="signatures"
      :animation="150"
      handle=".drag-handle"
      class="space-y-3"
      @end="handleDragEnd"
    >
      <div
        v-for="sig in signatures"
        :key="sig.id"
        class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer group"
        @click="openEdit(sig)"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div 
            class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            @click.stop
          >
            <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
              {{ sig.content }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <UIcon 
            v-if="sig.isDefault" 
            name="i-heroicons-star-20-solid" 
            class="w-4 h-4 text-primary-500 mr-2" 
          />
          <div class="w-4 h-4 mr-2" v-else></div>
          
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click.stop="handleDelete(sig.id)"
          />
        </div>
      </div>
    </VueDraggable>

    <!-- Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingSignature ? t('common.edit') : t('common.add')"
    >
      <div class="space-y-4">

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
