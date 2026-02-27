<script setup lang="ts">
import type { ChatMessage, LlmContextTag } from '../../types/llm'

interface Props {
  messages: ChatMessage[]
  isGenerating?: boolean
  getContextTagsForMessage: (message: ChatMessage) => LlmContextTag[]
}

defineProps<Props>()
const { t } = useI18n()

function getCleanedContextText(ctx: LlmContextTag): string {
  if (!ctx.promptText) return ctx.label
  return ctx.promptText
    .replace(/<[^>]*>/g, '')
    .trim()
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="messages.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400 opacity-60">
      <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 mb-2" />
      <p class="text-sm">{{ t('llm.chatEmpty') }}</p>
    </div>
    
    <div 
      v-for="(msg, idx) in messages" 
      :key="idx"
      class="flex flex-col"
      :class="msg.role === 'user' ? 'items-end' : 'items-start'"
    >
      <div 
        class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
        :class="msg.role === 'user' 
          ? 'bg-primary text-white dark:bg-primary-600 rounded-tr-none' 
          : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 rounded-tl-none shadow-sm'"
      >
        <div class="whitespace-pre-wrap">{{ msg.content }}</div>

        <!-- Attached context display (only for first user message for now as per original logic) -->
        <div v-if="msg.role === 'user' && idx === 0 && getContextTagsForMessage(msg).length > 0" class="mt-2">
          <div class="flex flex-wrap gap-1.5">
            <UPopover
              v-for="ctx in getContextTagsForMessage(msg)"
              :key="ctx.id"
              mode="hover"
              :popper="{ placement: 'top' }"
            >
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                class="rounded-full! px-2 py-0.5 h-auto max-w-full"
              >
                <span class="truncate max-w-105">{{ ctx.label }}</span>
              </UButton>
              <template #content>
                <div class="p-3 max-w-sm text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {{ getCleanedContextText(ctx) }}
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </div>
      <span class="text-[10px] text-gray-400 mt-1 uppercase font-medium tracking-tight">
        {{ msg.role === 'user' ? t('common.user') : t('common.assistant') }}
      </span>
    </div>
    
    <!-- Generating indicator -->
    <div v-if="isGenerating" class="flex items-start gap-2">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
        <div class="flex gap-1.5">
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
      </div>
    </div>
  </div>
</template>
