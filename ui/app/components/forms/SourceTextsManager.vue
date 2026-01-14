<script setup lang="ts">
import { computed } from 'vue'

interface SourceText {
  content: string
  order: number
  source?: string
}

const props = defineProps<{
  modelValue: SourceText[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SourceText[]): void
}>()

const { t } = useI18n()

const sourceTexts = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val)
})

function addSourceText() {
  const newList = [...sourceTexts.value]
  newList.push({
    content: '',
    order: newList.length,
    source: 'manual'
  })
  sourceTexts.value = newList
}

function removeSourceText(index: number) {
  const newList = [...sourceTexts.value]
  newList.splice(index, 1)
  // Re-order
  newList.forEach((item, i) => {
    item.order = i
  })
  sourceTexts.value = newList
}

function updateContent(index: number, content: string) {
  const newList = [...sourceTexts.value]
  const item = newList[index]
  if (item) {
    newList[index] = { ...item, content }
    sourceTexts.value = newList
  }
}

function moveUp(index: number) {
  if (index <= 0) return
  const newList = [...sourceTexts.value]
  const item = newList[index]!
  const prevItem = newList[index - 1]!
  newList[index] = prevItem
  newList[index - 1] = item
  // Update orders
  newList.forEach((item, i) => {
    item.order = i
  })
  sourceTexts.value = newList
}

function moveDown(index: number) {
  if (index >= sourceTexts.value.length - 1) return
  const newList = [...sourceTexts.value]
  const item = newList[index]!
  const nextItem = newList[index + 1]!
  newList[index] = nextItem
  newList[index + 1] = item
  // Update orders
  newList.forEach((item, i) => {
    item.order = i
  })
  sourceTexts.value = newList
}

function getSourceDisplay(source?: string) {
  if (!source || source === 'manual') return t('sourceTexts.manual')
  
  if (source.startsWith('url:')) {
    const url = source.replace('url:', '')
    try {
      const hostname = new URL(url).hostname
      return hostname
    } catch {
      return url
    }
  }
  
  if (source.startsWith('telegram:')) {
    const parts = source.replace('telegram:', '').split(',')
    if (parts.length >= 1) {
      return `Telegram (${parts[0]})`
    }
    return 'Telegram'
  }
  
  return source
}

function getSourceUrl(source?: string): string | undefined {
  if (!source) return undefined
  if (source.startsWith('url:')) return source.replace('url:', '')
  if (source.startsWith('telegram:')) {
    const parts = source.replace('telegram:', '').split(',')
    if (parts.length >= 2) {
      const chatId = parts[0]
      const msgId = parts[1]
      if (chatId && msgId && chatId.startsWith('-100')) {
        const cleanId = chatId.replace('-100', '')
        return `https://t.me/c/${cleanId}/${msgId}`
      }
    }
  }
  return undefined
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ t('sourceTexts.title') }}
        </h3>
        <CommonInfoTooltip :text="t('sourceTexts.help')" />
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-heroicons-plus"
        size="xs"
        @click="addSourceText"
      >
        {{ t('sourceTexts.add') }}
      </UButton>
    </div>

    <div v-if="sourceTexts.length === 0" class="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
      <p class="text-sm text-gray-500">{{ t('sourceTexts.empty') }}</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(item, index) in sourceTexts"
        :key="index"
        class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="text-xs font-semibold text-gray-500 tabular-nums">#{{ index + 1 }}</span>
            <div class="flex items-center gap-1 overflow-hidden">
              <span class="text-xs text-gray-400 font-medium whitespace-nowrap">{{ t('sourceTexts.source') }}:</span>
              <div class="flex items-center gap-1 overflow-hidden">
                <span class="text-xs text-gray-600 dark:text-gray-300 truncate" :title="item.source">
                  {{ getSourceDisplay(item.source) }}
                </span>
                <UButton
                  v-if="getSourceUrl(item.source)"
                  :to="getSourceUrl(item.source)"
                  target="_blank"
                  icon="i-heroicons-arrow-top-right-on-square"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  square
                  class="h-5 w-5"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <UButton
              icon="i-heroicons-chevron-up"
              size="xs"
              variant="ghost"
              color="neutral"
              square
              :disabled="index === 0"
              @click="moveUp(index)"
            />
            <UButton
              icon="i-heroicons-chevron-down"
              size="xs"
              variant="ghost"
              color="neutral"
              square
              :disabled="index === sourceTexts.length - 1"
              @click="moveDown(index)"
            />
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              variant="ghost"
              color="error"
              square
              @click="removeSourceText(index)"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="p-0">
          <UTextarea
            v-model="item.content"
            :placeholder="t('sourceTexts.contentPlaceholder')"
            variant="none"
            size="sm"
            autoresize
            :rows="2"
            class="w-full"
            @update:model-value="val => updateContent(index, val)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
