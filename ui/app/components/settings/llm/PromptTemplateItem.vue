<script setup lang="ts">
import { computed } from 'vue'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

const props = defineProps<{
  template: LlmPromptTemplate
  showDragHandle?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', template: LlmPromptTemplate): void
  (e: 'copy', template: LlmPromptTemplate): void
  (e: 'hide', template: LlmPromptTemplate): void
  (e: 'unhide', template: LlmPromptTemplate): void
}>()

const { t } = useI18n()

function getTemplateBadge(tpl: LlmPromptTemplate): { label: string; color: 'info' | 'primary' | 'success' } {
  if (tpl.isSystem) {
    return { label: t('llm.system'), color: 'info' }
  }
  if (tpl.projectId) {
    return { label: t('llm.project'), color: 'primary' }
  }
  return { label: t('llm.personal'), color: 'success' }
}

const badge = computed(() => getTemplateBadge(props.template))
</script>

<template>
  <div
    class="flex items-start gap-3 p-4 rounded-lg group border transition-colors relative"
    :class="[
      template.isSystem 
        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50 cursor-default' 
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:border-gray-700 cursor-pointer',
      { 'opacity-60': template.isHidden }
    ]"
    @click="emit('click', template)"
  >
    <div
      v-if="showDragHandle"
      class="drag-handle mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      @click.stop
    >
      <UIcon name="i-heroicons-bars-2" class="w-5 h-5" />
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap mb-1">
        <h4 v-if="template.name" class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {{ template.name }}
        </h4>
        
        <UBadge 
          :color="badge.color" 
          variant="subtle" 
          size="xs"
          class="ml-1"
        >
          {{ badge.label }}
        </UBadge>

        <UBadge v-if="template.isHidden" size="xs" color="neutral" variant="subtle" class="ml-1">
          {{ t('common.hidden') }}
        </UBadge>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 font-mono bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800/50">
        {{ template.prompt }}
      </p>
    </div>

    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <UButton
        icon="i-heroicons-document-duplicate"
        color="neutral"
        variant="ghost"
        size="xs"
        :title="t('common.copy')"
        class="cursor-pointer"
        @click.stop="emit('copy', template)"
      />
      <template v-if="template.isHidden">
        <UButton
          icon="i-heroicons-eye"
          color="primary"
          variant="ghost"
          size="xs"
          :title="t('llm.unhide')"
          class="cursor-pointer"
          @click.stop="emit('unhide', template)"
        />
      </template>
      <template v-else>
        <UButton
          icon="i-heroicons-eye-slash"
          color="neutral"
          variant="ghost"
          size="xs"
          :title="t('llm.hide')"
          class="cursor-pointer"
          @click.stop="emit('hide', template)"
        />
      </template>
    </div>
  </div>
</template>
