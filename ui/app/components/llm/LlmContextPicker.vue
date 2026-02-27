<script setup lang="ts">
import type { LlmContextTag } from '../../types/llm'

interface Props {
  modelValue: LlmContextTag[]
  disabled?: boolean
  isChatEmpty?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: LlmContextTag[]): void
  (e: 'toggle', id: string): void
}>()

const { t } = useI18n()

function toggle(id: string) {
  if (props.disabled) return
  emit('toggle', id)
}

function getCleanedContextText(ctx: LlmContextTag): string {
  if (!ctx.promptText) return ctx.label
  return ctx.promptText
    .replace(/<[^>]*>/g, '')
    .trim()
}
</script>

<template>
  <div class="mb-4">
    <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
      <div class="flex flex-wrap gap-2">
        <UPopover
          v-for="ctx in modelValue"
          :key="ctx.id"
          mode="hover"
          :popper="{ placement: 'top' }"
        >
          <div 
            class="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer"
            :class="{ 'opacity-50 cursor-not-allowed': disabled }"
            @click="toggle(ctx.id)"
          >
            <UCheckbox
              :model-value="ctx.enabled"
              :disabled="disabled"
              @update:model-value="toggle(ctx.id)"
              @click.stop
            />
            <span class="text-xs truncate max-w-105" :class="{ 'opacity-50': disabled }">
              {{ ctx.label }}
            </span>
          </div>
          <template #content>
            <div class="p-3 max-w-sm text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
              {{ getCleanedContextText(ctx) }}
            </div>
          </template>
        </UPopover>
      </div>
    </div>
  </div>
</template>
