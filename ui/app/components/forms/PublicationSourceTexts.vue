<script setup lang="ts">
import type { SourceTextItem } from '~/types/publication-form'

interface Props {
  modelValue: SourceTextItem[]
}

interface Emits {
  (e: 'update:modelValue', value: SourceTextItem[]): void
  (e: 'translate', text: string): void
  (e: 'replaceContent', text: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const isOpen = ref(false)
const isAddingNew = ref(false)
const newContent = ref('')

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

function updateContent(index: number, val: string) {
  const updated = [...sourceTexts.value]
  const item = updated[index]
  if (!item) return // Type guard

  updated[index] = {
    ...item,
    content: val
  }
  sourceTexts.value = updated
}

function handleMoveToContent(index: number) {
  const item = sourceTexts.value[index]
  if (!item) return
  
  // 1. Remove from list
  const updated = [...sourceTexts.value]
  updated.splice(index, 1)
  sourceTexts.value = updated
  
  // 2. Emit event to replace content in parent
  emit('replaceContent', item.content)
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

function formatDate(timestamp?: number) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp * 1000))
}

function getTelegramLink(repost: any): string | undefined {
  if (repost.chatUsername && repost.messageId) {
    return `https://t.me/${repost.chatUsername}/${repost.messageId}`
  }
  if (repost.chatId && repost.messageId) {
    const chatIdStr = String(repost.chatId)
    if (chatIdStr.startsWith('-100')) {
      const cleanId = chatIdStr.replace('-100', '')
      return `https://t.me/c/${cleanId}/${repost.messageId}`
    }
  }
  return undefined
}

const { copy } = useClipboard()
const toast = useToast()

function handleCopy(text: string) {
  copy(text)
  toast.add({
    title: 'Copied to clipboard',
    icon: 'i-heroicons-check-circle',
    color: 'success'
  })
}

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
        class="p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 text-sm transition-colors"
      >
        <div class="flex flex-col gap-2">
            <!-- Header with Actions -->
            <div class="flex justify-between items-start gap-3">
                <!-- Meta Info (Voice, etc) -->
                <div class="flex-1">
                     <div v-if="item.meta?.isVoice" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-medium mb-1 border border-primary-200 dark:border-primary-800/50">
                        <UIcon name="i-heroicons-microphone" class="w-3 h-3" />
                        {{ t('sourceTexts.voice') }}
                      </div>
                </div>

                <!-- Action Buttons (Always Visible) -->
                <div class="flex gap-1">
                  <UTooltip :text="t('sourceTexts.moveToContent')">
                    <UButton
                        color="primary"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-arrow-up-tray"
                        @click="handleMoveToContent(index)"
                    />
                  </UTooltip>
                  <UTooltip :text="t('sourceTexts.copy')">
                    <UButton
                        color="primary"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-clipboard"
                        @click="handleCopy(item.content)"
                    />
                  </UTooltip>
                  <UTooltip :text="t('sourceTexts.translate')">
                    <UButton
                        color="primary"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-language"
                        @click="$emit('translate', item.content)"
                    />
                   </UTooltip>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-trash"
                    @click="handleDelete(index)"
                  />
                </div>
            </div>

            <!-- Content Editor (Always Edit Mode) -->
            <UTextarea
                :model-value="item.content"
                autoresize
                :rows="2"
                class="w-full text-sm font-normal"
                @update:model-value="(val) => updateContent(index, val)"
            />

             <!-- Repost Info (Below) -->
             <div v-if="(item.source && item.source !== 'manual') || item.meta?.repost" class="mt-1 flex flex-col gap-1.5">
                <div v-if="item.source && item.source !== 'manual'" class="text-xs text-gray-400 font-mono flex items-center gap-1">
                  <UIcon name="i-heroicons-link" class="w-3 h-3" />
                  {{ item.source }}
                </div>
                
                <!-- Repost Info -->
                <div v-if="item.meta?.repost" class="bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 dark:border-primary-800/30 rounded p-2 text-xs">
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-semibold">
                      <UIcon name="i-heroicons-arrow-path-rounded-square" class="w-3.5 h-3.5" />
                      {{ t('sourceTexts.repostFrom', 'Repost from') }} {{ item.meta.repost.type }}
                    </div>
                    <div v-if="item.meta.repost.date" class="text-[10px] text-gray-400">
                      {{ formatDate(item.meta.repost.date) }}
                    </div>
                  </div>
                  
                  <div class="space-y-1 text-gray-500 dark:text-gray-400 ml-5 text-[11px]">
                    <!-- Chat/Channel Info -->
                    <div v-if="item.meta.repost.chatTitle" class="flex gap-1.5 items-center">
                      <UIcon name="i-heroicons-chat-bubble-left-right" class="w-3 h-3 text-gray-400" />
                      <span class="font-medium text-gray-700 dark:text-gray-300">{{ item.meta.repost.chatTitle }}</span>
                      <span v-if="item.meta.repost.chatUsername" class="text-gray-400">(@{{ item.meta.repost.chatUsername }})</span>
                    </div>

                    <!-- Author Info -->
                    <div v-if="item.meta.repost.authorName || item.meta.repost.authorUsername" class="flex gap-1.5 items-center">
                      <UIcon name="i-heroicons-user" class="w-3 h-3 text-gray-400" />
                      <span class="text-gray-400 mr-0.5">{{ t('sourceTexts.author', 'Author') }}:</span>
                      <span v-if="item.meta.repost.authorName" class="text-gray-600 dark:text-gray-300">{{ item.meta.repost.authorName }}</span>
                      <span v-if="item.meta.repost.authorUsername" class="text-primary-500 dark:text-primary-400">@{{ item.meta.repost.authorUsername }}</span>
                    </div>

                    <!-- IDs and Links -->
                    <div class="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1 pt-1 border-t border-gray-100 dark:border-gray-800/50 font-mono text-[9px] text-gray-400">
                      <div v-if="item.meta.repost.messageId">
                        {{ t('sourceTexts.messageId', 'MSG ID') }}: {{ item.meta.repost.messageId }}
                      </div>
                      <div v-if="item.meta.repost.chatId">
                        {{ t('sourceTexts.chatId', 'CHAT ID') }}: {{ item.meta.repost.chatId }}
                      </div>
                      <div v-if="getTelegramLink(item.meta.repost)">
                        <a :href="getTelegramLink(item.meta.repost)" target="_blank" class="flex items-center gap-0.5 text-primary-500 hover:underline">
                          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-2.5 h-2.5" />
                          {{ t('sourceTexts.viewSource', 'View source') }}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

        </div>
      </div>
    </div>
  </div>
</template>
