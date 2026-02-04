<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
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
const deletedSignatures = ref<AuthorSignature[]>([])
const showDeleted = ref(false)

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

const presetItems = computed(() => {
  return [
    PRESET_SIGNATURES.map(p => ({
      label: t(p.contentKey),
      icon: 'i-heroicons-sparkles',
      onSelect: () => handlePresetSelect(p)
    }))
  ]
})

function handlePresetSelect(preset: typeof PRESET_SIGNATURES[0]) {
  const content = t(preset.contentKey)
  if (form.content && !form.content.endsWith('\n')) {
    form.content += '\n'
  }
  form.content += content
}

function openEdit(signature: AuthorSignature) {
  editingSignature.value = signature
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
  const index = signatures.value.findIndex(sig => sig.id === id)
  if (index !== -1) {
    const signature = signatures.value[index]
    
    // Add to session-only deleted list
    if (signature) {
      deletedSignatures.value.push(signature)
    }
    
    // Optimistically remove from main list
    signatures.value.splice(index, 1)
    
    try {
      await remove(id)
    } catch (error) {
      console.error('Failed to delete signature', error)
      await loadSignatures()
    }
  }
}

async function restoreSignature(signature: AuthorSignature) {
  try {
    const input: CreateAuthorSignatureInput = {
      channelId: props.channelId,
      name: signature.name,
      content: signature.content,
      isDefault: false // Don't force default on restore
    }
    await create(input)
    deletedSignatures.value = deletedSignatures.value.filter(sig => sig.id !== signature.id)
    await loadSignatures()
  } catch (error) {
    console.error('Failed to restore signature', error)
  }
}

async function handleSetDefault(id: string) {
  await setDefault(id)
  await loadSignatures()
}

async function handleDragEnd() {
  // Update order for all signatures
  try {
    let order = 0
    for (const sig of signatures.value) {
      await update(sig.id, { order: order++ })
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
      <UiLoadingSpinner size="md" />
    </div>

    <div v-else-if="signatures.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
      <UIcon name="i-heroicons-pencil-square" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ t('authorSignature.none') }}
      </p>
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        color="primary"
        variant="soft"
        @click="openAdd"
      >
        {{ t('common.add') }}
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

    <!-- Deleted Signatures (Session only) -->
    <div v-if="deletedSignatures.length > 0" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        :icon="showDeleted ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        @click="showDeleted = !showDeleted"
      >
        {{ t('channel.deletedTemplates', { count: deletedSignatures.length }) }}
      </UButton>
      
      <div v-if="showDeleted" class="mt-2 space-y-2">
        <div
          v-for="sig in deletedSignatures"
          :key="sig.id"
          class="flex items-center justify-between py-1.5 px-3 bg-gray-50/30 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-gray-400" />
            <div class="text-xs truncate max-w-[200px]">
              <span class="text-gray-500 dark:text-gray-400 italic line-through mr-2">{{ sig.content }}</span>
            </div>
          </div>
          <UButton
            icon="i-heroicons-arrow-path"
            size="xs"
            variant="ghost"
            color="primary"
            class="scale-90"
            @click="restoreSignature(sig)"
          >
            {{ t('common.restore', 'Restore') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <UiAppModal
      v-model:open="isModalOpen"
      :title="editingSignature ? t('common.edit') : t('common.add')"
    >
      <div class="space-y-4">
        <div class="flex justify-end">
          <UDropdownMenu
            :items="presetItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-heroicons-sparkles"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            >
              {{ t('authorSignature.presets.button', 'Preset') }}
            </UButton>
          </UDropdownMenu>
        </div>

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
        <UButton color="primary" :loading="isLoading" @click="handleSave" :disabled="!form.content">
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>

  </div>
</template>
