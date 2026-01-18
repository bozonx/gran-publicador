<script setup lang="ts">
import type { SourceTextItem } from '~/types/publication-form'

interface Props {
  modelValue: SourceTextItem[]
}

interface Emits {
  (e: 'update:modelValue', value: SourceTextItem[]): void
  (e: 'translate', text: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const isOpen = ref(false)
const isAddingNew = ref(false)
const newContent = ref('')
const editingIndex = ref<number | null>(null)
const editingContent = ref('')

const sourceTexts = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

function handleAdd() {
  if (!newContent.value.trim()) return
  
  const newItem: SourceTextItem = {
    content: newContent.value,
    source: 'manual',
    order: sourceTexts.value.length
  }
  
  sourceTexts.value = [...sourceTexts.value, newItem]
  newContent.value = ''
  isAddingNew.value = false
  isOpen.value = true
}

function handleStartEdit(index: number) {
  const item = sourceTexts.value[index]
  if (!item) return
  
  editingIndex.value = index
  editingContent.value = item.content
}

function handleSaveEdit() {
  if (editingIndex.value === null || !sourceTexts.value) return
  
  const updated = [...sourceTexts.value]
  updated[editingIndex.value] = {
    ...updated[editingIndex.value],
    content: editingContent.value
  }
  
  sourceTexts.value = updated
  editingIndex.value = null
  editingContent.value = ''
}

function handleCancelEdit() {
  editingIndex.value = null
  editingContent.value = ''
}

function handleDelete(index: number) {
  const updated = [...sourceTexts.value]
  updated.splice(index, 1)
  sourceTexts.value = updated
}

function handleDeleteAll() {
  sourceTexts.value = []
  isOpen.value = false
}

defineExpose({
  openTranslateModal: (text: string) => {
    // This will be called from parent
    return text
  }
})
</script>

<template>
  <div class="mb-6 ml-1">
    <div class="flex items-center gap-2 mb-2">
      <UButton
        variant="ghost"
        color="primary"
        size="sm"
        :icon="isOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        @click="isOpen = !isOpen"
      >
        {{ isOpen ? t('sourceTexts.hide') : t('sourceTexts.view') }} ({{ sourceTexts.length }})
      </UButton>
      
      <UButton
        v-if="!isAddingNew"
        variant="soft"
        color="primary"
        size="xs"
        icon="i-heroicons-plus"
        :label="t('sourceTexts.add', 'Add Source Text')"
        @click="isAddingNew = true"
      />
    </div>

    <!-- Add New Source Text Form -->
    <div v-if="isAddingNew" class="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
      <UTextarea
        v-model="newContent"
        :placeholder="t('sourceTexts.placeholder', 'Enter source text here...')"
        autoresize
        :rows="3"
        class="w-full mb-2"
      />
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :label="t('common.cancel')"
          @click="isAddingNew = false"
        />
        <UButton
          color="primary"
          size="sm"
          :label="t('common.add')"
          :disabled="!newContent.trim()"
          @click="handleAdd"
        />
      </div>
    </div>

    <!-- Source Texts List -->
    <div v-if="isOpen && sourceTexts.length > 0" class="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
      <div class="flex justify-end">
        <UButton
          color="error"
          variant="ghost"
          size="xs"
          icon="i-heroicons-trash"
          @click="handleDeleteAll"
        >
          {{ t('sourceTexts.deleteAll') }}
        </UButton>
      </div>

      <div 
        v-for="(item, index) in sourceTexts" 
        :key="index" 
        class="p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 text-sm group hover:border-primary-200 dark:hover:border-primary-800/50 transition-colors"
      >
        <!-- View Mode -->
        <div v-if="editingIndex !== index">
          <div class="flex justify-between items-start gap-3">
            <div class="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300 leading-relaxed font-normal">
              {{ item.content }}
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <UButton
                color="primary"
                variant="ghost"
                size="xs"
                icon="i-heroicons-pencil-square"
                @click="handleStartEdit(index)"
              />
              <UButton
                color="primary"
                variant="ghost"
                size="xs"
                icon="i-heroicons-language"
                :title="t('sourceTexts.translate')"
                @click="$emit('translate', item.content)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-heroicons-trash"
                @click="handleDelete(index)"
              />
            </div>
          </div>
          <div v-if="item.source && item.source !== 'manual'" class="mt-2 text-xs text-gray-400 font-mono flex items-center gap-1">
            <UIcon name="i-heroicons-link" class="w-3 h-3" />
            {{ item.source }}
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-else>
          <UTextarea
            v-model="editingContent"
            autoresize
            :rows="3"
            class="w-full mb-2"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              :label="t('common.cancel')"
              @click="handleCancelEdit"
            />
            <UButton
              color="primary"
              size="xs"
              :label="t('common.save')"
              @click="handleSaveEdit"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
