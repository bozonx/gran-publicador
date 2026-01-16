<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useAuthorSignatures } from '~/composables/useAuthorSignatures'
import type { AuthorSignature, CreateAuthorSignatureInput, UpdateAuthorSignatureInput } from '~/types/author-signatures'

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
</script>

<template>
  <div class="space-y-4">
    <Teleport defer v-if="channelId" to="#channel-signatures-actions">
      <UButton
        icon="i-heroicons-plus"
        size="xs"
        color="primary"
        variant="soft"
        @click="openAdd"
      >
        {{ t('common.add') }}
      </UButton>
    </Teleport>

    <div v-if="isLoading && signatures.length === 0" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="signatures.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <UIcon name="i-heroicons-pencil-square" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('authorSignature.none') }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="sig in signatures"
        :key="sig.id"
        class="flex flex-col p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-all group relative h-full"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
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
  </div>
</template>
