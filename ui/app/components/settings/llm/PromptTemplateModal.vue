<script setup lang="ts">
import { reactive, watch, computed } from 'vue'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  mode: 'create' | 'edit'
  template: LlmPromptTemplate | null
  categoryOptions: Array<{ value: string; label: string }>
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', data: { name: string; category: string; note?: string; prompt: string }): void
  (e: 'delete', template: LlmPromptTemplate): void
}>()

const { t } = useI18n()
const CUSTOM_CATEGORY_VALUE = '__custom__'

const formData = reactive({
  name: '',
  category: 'General',
  customCategory: '',
  note: '',
  prompt: ''
})

watch(open, (newVal) => {
  if (newVal) {
    if (props.mode === 'create' || !props.template) {
      formData.name = ''
      formData.category = props.categoryOptions[0]?.value || 'General'
      formData.customCategory = ''
      formData.note = ''
      formData.prompt = ''
    } else {
      formData.name = props.template.name || ''
      const existingValues = props.categoryOptions.map(o => o.value)
      const templateCategory = props.template.category || 'General'
      if (existingValues.includes(templateCategory)) {
        formData.category = templateCategory
        formData.customCategory = ''
      } else {
        formData.category = CUSTOM_CATEGORY_VALUE
        formData.customCategory = templateCategory
      }
      formData.note = props.template.note || ''
      formData.prompt = props.template.prompt
    }
  }
}, { immediate: true })

const canSubmit = computed(() => formData.prompt.trim().length > 0)

function handleSubmit() {
  if (!canSubmit.value) return
  
  const category = formData.category === CUSTOM_CATEGORY_VALUE
    ? formData.customCategory.trim()
    : formData.category

  if (!category) return

  emit('submit', {
    name: formData.name.trim(),
    category,
    note: formData.note.trim() || undefined,
    prompt: formData.prompt
  })
}
</script>

<template>
  <UiAppModal
    v-model:open="open"
    :title="mode === 'create' ? t('llm.addTemplate') : t('llm.editTemplate')"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <UFormField :label="t('llm.templateName')" class="w-full">
        <UInput
          v-model="formData.name"
          :placeholder="t('llm.templateNamePlaceholder')"
          autofocus
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('llm.templateCategory')" class="w-full">
        <USelectMenu
          v-model="formData.category"
          :items="categoryOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>

      <UFormField v-if="formData.category === CUSTOM_CATEGORY_VALUE" :label="t('llm.templateCategory')" class="w-full">
        <UInput
          v-model="formData.customCategory"
          :placeholder="t('llm.templateCategoryPlaceholder')"
          class="w-full"
        />
      </UFormField>
      
      <UFormField :label="t('llm.templateNote')" class="w-full">
        <UInput
          v-model="formData.note"
          :placeholder="t('llm.templateNotePlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('llm.templatePrompt')" required class="w-full">
        <UTextarea
          v-model="formData.prompt"
          :placeholder="t('llm.templatePromptPlaceholder')"
          :rows="6"
          autoresize
          class="font-mono text-sm w-full"
        />
      </UFormField>
    </form>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div>
          <UButton
            v-if="mode === 'edit' && template && !template.isSystem"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            @click="emit('delete', template)"
          >
            {{ t('common.delete') }}
          </UButton>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="open = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="isSubmitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            {{ mode === 'create' ? t('common.create') : t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UiAppModal>
</template>
